// supabase/functions/create-tenant/index.ts
//
// Edge Function: create-tenant
// Called by platform admins to create a new tenant and send an owner invitation.
//
// POST body: { name, slug, owner_email }
// Auth: requires valid JWT + profiles.is_platform_admin = true
//
// Flow:
//   1. Validate caller is platform admin
//   2. Validate slug uniqueness
//   3. Check owner email not already in another tenant
//   4. Create tenant record
//   5. Create owner invitation (target_role='admin', marker for owner)
//   6. Send invite email via Supabase Auth
//   7. Return tenant + invitation

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

const json = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return json({ error: 'Missing Authorization header' }, 401)
    }

    const body = await req.json()
    const { name, slug: rawSlug, owner_email } = body

    if (!name || !owner_email) {
      return json({ error: 'name and owner_email are required' }, 400)
    }

    const slug = rawSlug ? slugify(rawSlug) : slugify(name)
    if (!slug) {
      return json({ error: 'Could not generate a valid slug from the provided name' }, 400)
    }

    const normalizedEmail = owner_email.toLowerCase().trim()
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    // Verify caller identity
    const userClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: { user }, error: userError } = await userClient.auth.getUser()
    if (userError || !user) {
      return json({ error: 'Unauthorized' }, 401)
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey)

    // Check platform admin
    const { data: callerProfile } = await adminClient
      .from('profiles')
      .select('is_platform_admin')
      .eq('id', user.id)
      .single()

    if (!callerProfile?.is_platform_admin) {
      return json({ error: 'Only platform admins can create tenants' }, 403)
    }

    // Check slug uniqueness
    const { data: existingTenant } = await adminClient
      .from('tenants')
      .select('id')
      .eq('slug', slug)
      .single()

    if (existingTenant) {
      return json({ error: `A workspace with slug "${slug}" already exists` }, 409)
    }

    // Check owner email not in another tenant
    const { data: existingAuthUsers } = await adminClient.auth.admin.listUsers()
    const matchedUser = existingAuthUsers?.users?.find(
      (u) => u.email?.toLowerCase() === normalizedEmail
    )

    if (matchedUser) {
      const { data: existingMembership } = await adminClient
        .from('tenant_memberships')
        .select('tenant_id')
        .eq('user_id', matchedUser.id)
        .single()

      if (existingMembership) {
        return json({ error: 'This email already belongs to another workspace.' }, 409)
      }
    }

    // ── Create tenant ──
    const { data: tenant, error: tenantError } = await adminClient
      .from('tenants')
      .insert({
        name,
        slug,
        status: 'active',
      })
      .select()
      .single()

    if (tenantError) {
      console.error('Tenant creation error:', tenantError)
      return json({ error: `Failed to create tenant: ${tenantError.message}` }, 500)
    }

    // ── Create owner invitation ──
    // Use company_name='__owner__' as a marker so accept-invite assigns 'owner' role
    const { data: invitation, error: invError } = await adminClient
      .from('tenant_invitations')
      .insert({
        tenant_id: tenant.id,
        email: normalizedEmail,
        company_name: '__owner__',
        target_role: 'admin',
        invited_by: user.id,
        status: 'pending',
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      })
      .select()
      .single()

    if (invError) {
      console.error('Invitation creation error:', invError)
      return json({ error: `Tenant created but invitation failed: ${invError.message}` }, 500)
    }

    // ── Send invite email ──
    // Prefer explicit app URL or current request origin (platform app host in local/prod).
    // Generic SITE_URL may point to a tenant/custom domain and cause wrong redirects.
    const rawSiteUrl =
      Deno.env.get('APP_SITE_URL') ||
      req.headers.get('origin') ||
      Deno.env.get('SITE_URL') ||
      supabaseUrl
    const siteUrl = rawSiteUrl.replace(/\/+$/, '')
    const redirectUrl = `${siteUrl}/auth/accept-invite?token=${invitation.token}`

    const { error: emailError } = await adminClient.auth.admin.inviteUserByEmail(
      normalizedEmail,
      {
        redirectTo: redirectUrl,
        data: {
          tenant_id: tenant.id,
          role: 'admin',
          invitation_token: invitation.token,
        },
      }
    )

    if (emailError) {
      console.error('inviteUserByEmail error:', emailError)
      console.warn('Auth invite email failed, but tenant and invitation were created.')
    }

    return json({
      success: true,
      tenant,
      invitation: {
        id: invitation.id,
        token: invitation.token,
        email: normalizedEmail,
      },
      email_sent: !emailError,
    })
  } catch (err) {
    console.error('Unexpected error:', err)
    const message = err instanceof Error ? err.message : 'Internal server error'
    return json({ error: message }, 500)
  }
})
