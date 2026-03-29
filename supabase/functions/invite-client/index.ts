// supabase/functions/invite-client/index.ts
//
// Edge Function: invite-client
// Called by tenant admins to invite a new client company OR a team member.
//
// POST body: { email, company_name?, commission_rate?, tenant_id, target_role? }
//   target_role: 'company' (default) = client invite
//                'admin'             = team member invite
//
// Flow:
//   1. Validate caller is admin/owner of the tenant (or platform admin)
//   2. Check single-tenant membership rule for the target email
//   3. Create (or update) the tenant_invitations record -> get token
//   4. Invite user via Supabase Auth with token in redirectTo
//   5. Create stub profile (NO membership -- that happens on accept only)
//   6. Return the invitation record

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
    const { email, company_name, commission_rate, phone, address, tenant_id, target_role: rawTargetRole } = body

    if (!email || !tenant_id) {
      return new Response(
        JSON.stringify({ error: 'email and tenant_id are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const target_role: 'admin' | 'company' = rawTargetRole === 'admin' ? 'admin' : 'company'
    const isTeamInvite = target_role === 'admin'

    const normalizedEmail = email.toLowerCase().trim()
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

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

    // Check caller authorization: must be tenant admin/owner OR platform admin
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
        return new Response(JSON.stringify({ error: 'Only tenant admins can send invitations' }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
    }

    const commissionDecimal = (!isTeamInvite && commission_rate)
      ? Math.min(Math.max(Number(commission_rate) / 100, 0), 0.5)
      : 0

    // ── Single-tenant membership check ──
    // Look up whether the target email already belongs to a user with a
    // membership in a DIFFERENT tenant. If so, block the invite.
    const { data: existingAuthUser } = await adminClient.auth.admin.listUsers()
    const matchedUser = existingAuthUser?.users?.find(
      (u) => u.email?.toLowerCase() === normalizedEmail
    )

    if (matchedUser) {
      const { data: existingMembership } = await adminClient
        .from('tenant_memberships')
        .select('tenant_id')
        .eq('user_id', matchedUser.id)
        .single()

      if (existingMembership && existingMembership.tenant_id !== tenant_id) {
        return new Response(
          JSON.stringify({ error: 'This email already belongs to another workspace.' }),
          { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    }

    // ── Step 1: Create / update invitation record ──

    const { data: existingInvite } = await adminClient
      .from('tenant_invitations')
      .select('id, status, token')
      .eq('tenant_id', tenant_id)
      .eq('email', normalizedEmail)
      .single()

    if (existingInvite?.status === 'accepted') {
      return new Response(
        JSON.stringify({ error: 'This email has already accepted an invitation' }),
        { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    let invitation: { id: string; token: string; [k: string]: unknown } | null = null

    const invitationPayload = {
      tenant_id,
      email: normalizedEmail,
      company_name: isTeamInvite ? null : (company_name || null),
      commission_rate: commissionDecimal,
      target_role,
      invited_by: user.id,
      status: 'pending' as const,
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    }

    if (existingInvite) {
      const { data, error } = await adminClient
        .from('tenant_invitations')
        .update({
          ...invitationPayload,
          expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        })
        .eq('id', existingInvite.id)
        .select()
        .single()

      if (error) {
        return new Response(
          JSON.stringify({ error: `Failed to update invitation: ${error.message}` }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      invitation = data
    } else {
      const { data, error } = await adminClient
        .from('tenant_invitations')
        .insert(invitationPayload)
        .select()
        .single()

      if (error) {
        return new Response(
          JSON.stringify({ error: `Failed to create invitation: ${error.message}` }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      invitation = data
    }

    // ── Step 2: Invite user via Supabase Auth ──
    // Prefer explicit app URL or current request origin to avoid stale SITE_URL
    // sending invites to an unrelated tenant/custom domain.
    const rawSiteUrl =
      Deno.env.get('APP_SITE_URL') ||
      req.headers.get('origin') ||
      Deno.env.get('SITE_URL') ||
      supabaseUrl
    const siteUrl = rawSiteUrl.replace(/\/+$/, '')
    const redirectUrl = `${siteUrl}/auth/accept-invite?token=${invitation!.token}`

    const profileRole = isTeamInvite ? 'admin' : 'company'

    const { data: inviteData, error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(
      normalizedEmail,
      {
        redirectTo: redirectUrl,
        data: {
          tenant_id,
          role: profileRole,
          company_name: isTeamInvite ? null : (company_name || null),
          invitation_token: invitation!.token,
        },
      }
    )

    if (inviteError) {
      console.error('inviteUserByEmail error:', inviteError)
      console.warn('Auth invite email failed, but invitation record was created.')
    }

    // ── Step 3: Create stub profile (NO membership) ──
    const authUserId = inviteData?.user?.id
    let profileId: string | null = null

    if (authUserId) {
      const { data: profileData, error: profileError } = await adminClient
        .from('profiles')
        .upsert({
          id: authUserId,
          email: normalizedEmail,
          role: profileRole,
          company_name: isTeamInvite ? null : (company_name || null),
          commission_rate: commissionDecimal,
          phone: isTeamInvite ? null : (phone || null),
          address: isTeamInvite ? null : (address || null),
          invitation_status: 'invited',
          tenant_id,
        }, { onConflict: 'id' })
        .select('id')
        .single()

      if (profileError) {
        console.error('Profile upsert error:', profileError)
      } else {
        profileId = profileData?.id ?? null
      }

      if (profileId) {
        await adminClient
          .from('tenant_invitations')
          .update({ profile_id: profileId })
          .eq('id', invitation!.id)
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        invitation,
        profile_id: profileId,
        email_sent: !inviteError,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    console.error('Unexpected error:', err)
    const message = err instanceof Error ? err.message : 'Internal server error'
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
