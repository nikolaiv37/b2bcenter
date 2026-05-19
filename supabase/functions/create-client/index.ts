// supabase/functions/create-client/index.ts
//
// Edge Function: create-client
// Called by tenant admins to manually create a new B2B client with a
// temporary password. The client can log in immediately.
//
// POST body: { email, company_name, commission_rate, password, tenant_id }
//
// Flow:
//   1. Validate caller is admin/owner of the tenant
//   2. Check email is not already in use
//   3. Create Supabase auth user with the provided password
//   4. Create profile with role='company', invitation_status='active'
//   5. Create company record if company_name provided
//   6. Link profile.company_id to the new company
//   7. Create tenant_membership with role='member'
//   8. Return success

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing Authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const body = await req.json()
    const { email, company_name, commission_rate, password, tenant_id } = body

    if (!email || !password || !tenant_id) {
      return new Response(
        JSON.stringify({ error: 'email, password, and tenant_id are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (password.length < 6) {
      return new Response(
        JSON.stringify({ error: 'Password must be at least 6 characters' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const normalizedEmail = email.toLowerCase().trim()
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    // Verify caller is authenticated
    const userClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: { user }, error: userError } = await userClient.auth.getUser()
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey)

    // Check caller authorization
    const { data: callerProfile } = await adminClient
      .from('profiles')
      .select('is_platform_admin')
      .eq('id', user.id)
      .single()

    const isPlatformAdmin = callerProfile?.is_platform_admin === true

    if (!isPlatformAdmin) {
      const { data: membership } = await adminClient
        .from('tenant_memberships')
        .select('role')
        .eq('user_id', user.id)
        .eq('tenant_id', tenant_id)
        .single()

      if (!membership || !['owner', 'admin'].includes(membership.role)) {
        return new Response(JSON.stringify({ error: 'Only tenant admins can create clients' }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
    }

    // Check if email already exists in auth.users
    const { data: existingAuthUsers } = await adminClient.auth.admin.listUsers()
    const matchedUser = existingAuthUsers?.users?.find(
      (u) => u.email?.toLowerCase() === normalizedEmail
    )

    if (matchedUser) {
      // Check if this user already has a membership in this tenant
      const { data: existingMembership } = await adminClient
        .from('tenant_memberships')
        .select('id')
        .eq('user_id', matchedUser.id)
        .eq('tenant_id', tenant_id)
        .single()

      if (existingMembership) {
        return new Response(
          JSON.stringify({ error: 'A client with this email already exists in your workspace.' }),
          { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // User exists but not in this tenant — in single-tenant mode this shouldn't happen,
      // but block it anyway
      const { data: otherMembership } = await adminClient
        .from('tenant_memberships')
        .select('tenant_id')
        .eq('user_id', matchedUser.id)
        .single()

      if (otherMembership && otherMembership.tenant_id !== tenant_id) {
        return new Response(
          JSON.stringify({ error: 'This email already belongs to another workspace.' }),
          { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    }

    const commissionDecimal = commission_rate
      ? Math.min(Math.max(Number(commission_rate) / 100, 0), 0.5)
      : 0

    // Step 1: Create the auth user with the provided password
    const { data: authUserData, error: authError } = await adminClient.auth.admin.createUser({
      email: normalizedEmail,
      password,
      email_confirm: true, // Skip email confirmation — admin is creating the account
      user_metadata: {
        company_name: company_name || null,
      },
    })

    if (authError) {
      if (authError.status === 422) {
        return new Response(
          JSON.stringify({ error: 'A user with this email already exists.' }),
          { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      return new Response(
        JSON.stringify({ error: `Failed to create user: ${authError.message}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const authUserId = authUserData.user.id

    // Step 2: Create company record if company_name provided
    let companyId: string | null = null
    if (company_name && company_name.trim()) {
      // Generate a slug from company name
      const slug = company_name.trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
        + '-' + Date.now().toString(36)

      const { data: companyData, error: companyError } = await adminClient
        .from('companies')
        .insert({
          name: company_name.trim(),
          slug,
          tenant_id,
        })
        .select('id')
        .single()

      if (companyError) {
        console.error('Company creation error:', companyError)
        // Non-fatal — continue without company
      } else {
        companyId = companyData?.id ?? null
      }
    }

    // Step 3: Create profile
    const { error: profileError } = await adminClient
      .from('profiles')
      .insert({
        id: authUserId,
        email: normalizedEmail,
        role: 'company',
        company_name: company_name?.trim() || null,
        commission_rate: commissionDecimal,
        company_id: companyId,
        invitation_status: 'active',
        tenant_id,
      })
      .select('id')
      .single()

    if (profileError) {
      console.error('Profile creation error:', profileError)
      // If profile creation fails, we should ideally clean up the auth user,
      // but for now log and return error
      return new Response(
        JSON.stringify({ error: `Failed to create profile: ${profileError.message}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Step 4: Create tenant membership
    const { error: membershipError } = await adminClient
      .from('tenant_memberships')
      .insert({
        user_id: authUserId,
        tenant_id,
        role: 'member',
      })

    if (membershipError) {
      console.error('Membership creation error:', membershipError)
      return new Response(
        JSON.stringify({ error: `Failed to create membership: ${membershipError.message}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({
        success: true,
        client: {
          id: authUserId,
          email: normalizedEmail,
          company_name: company_name?.trim() || null,
          commission_rate: commissionDecimal,
        },
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    console.error('Unexpected error in create-client:', err)
    const message = err instanceof Error ? err.message : 'Internal server error'
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
