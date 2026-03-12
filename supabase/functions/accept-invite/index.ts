// supabase/functions/accept-invite/index.ts
//
// Edge Function: accept-invite
// Called when an invited user completes signup and accepts their invitation.
//
// POST body: { token }
// Auth: requires valid JWT (the user who just signed up / logged in)
//
// This is the SOLE place where tenant_memberships are created for invited users.
// It enforces the single-tenant-per-user rule and handles the owner role.
//
// Returns 200 with { success: true/false, error?, error_code? }

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

const json = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return json({ success: false, error: 'Not authenticated. Please log in first.', error_code: 'no_auth' })
    }

    const { token } = await req.json()
    if (!token) {
      return json({ success: false, error: 'Missing invitation token.', error_code: 'no_token' })
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    const userClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: { user }, error: userError } = await userClient.auth.getUser()
    if (userError || !user) {
      return json({ success: false, error: 'Session expired. Please log in again.', error_code: 'unauthorized' })
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey)

    // Look up invitation
    const { data: invitation, error: invError } = await adminClient
      .from('tenant_invitations')
      .select('*')
      .eq('token', token)
      .single()

    if (invError || !invitation) {
      return json({ success: false, error: 'Invitation not found. It may have been revoked.', error_code: 'not_found' })
    }

    const { data: tenantData } = await adminClient
      .from('tenants')
      .select('slug, name')
      .eq('id', invitation.tenant_id)
      .single()

    if (invitation.status === 'accepted') {
      return json({
        success: false,
        error: 'This invitation has already been accepted.',
        error_code: 'already_accepted',
        tenant_slug: tenantData?.slug,
        tenant_name: tenantData?.name,
      })
    }

    if (invitation.status !== 'pending') {
      return json({
        success: false,
        error: `This invitation is ${invitation.status}.`,
        error_code: 'invalid_status',
      })
    }

    if (new Date(invitation.expires_at) < new Date()) {
      await adminClient
        .from('tenant_invitations')
        .update({ status: 'expired' })
        .eq('id', invitation.id)

      return json({
        success: false,
        error: 'This invitation has expired. Please ask the admin to resend it.',
        error_code: 'expired',
      })
    }

    if (user.email?.toLowerCase() !== invitation.email.toLowerCase()) {
      return json({
        success: false,
        error: `This invitation is for ${invitation.email}. You are signed in as ${user.email}. Please sign out and use the correct account.`,
        error_code: 'email_mismatch',
        expected_email: invitation.email,
        current_email: user.email,
        tenant_name: tenantData?.name,
      })
    }

    // ── Single-tenant membership enforcement ──
    const { data: existingMembership } = await adminClient
      .from('tenant_memberships')
      .select('tenant_id')
      .eq('user_id', user.id)
      .single()

    if (existingMembership && existingMembership.tenant_id !== invitation.tenant_id) {
      return json({
        success: false,
        error: 'This email already belongs to another workspace.',
        error_code: 'single_tenant_conflict',
      })
    }

    // ── Accept the invitation ──

    // Derive roles from target_role (backward compat: null/missing = 'company')
    const targetRole = invitation.target_role || 'company'
    const isTeamInvite = targetRole === 'admin'
    const profileRole = isTeamInvite ? 'admin' : 'company'

    // Determine membership role. If invitation metadata marks this as
    // an owner invite (set by create-tenant flow), use 'owner'.
    const isOwnerInvite = invitation.commission_rate === -1 || invitation.company_name === '__owner__'
    const membershipRole = isOwnerInvite ? 'owner' : (isTeamInvite ? 'admin' : 'member')

    // Update invitation
    await adminClient
      .from('tenant_invitations')
      .update({
        status: 'accepted',
        accepted_at: new Date().toISOString(),
        profile_id: user.id,
      })
      .eq('id', invitation.id)

    // Upsert profile
    await adminClient
      .from('profiles')
      .upsert({
        id: user.id,
        email: user.email!,
        role: profileRole,
        company_name: (isTeamInvite || isOwnerInvite) ? null : (invitation.company_name || null),
        commission_rate: isOwnerInvite ? 0 : (isTeamInvite ? 0 : (invitation.commission_rate || 0)),
        invitation_status: isTeamInvite ? 'active' : 'invited',
        tenant_id: invitation.tenant_id,
      }, { onConflict: 'id' })

    // ── Create tenant membership (the ONLY place this happens for invites) ──
    const { error: membershipError } = await adminClient
      .from('tenant_memberships')
      .upsert({
        user_id: user.id,
        tenant_id: invitation.tenant_id,
        role: membershipRole,
      }, { onConflict: 'user_id,tenant_id' })

    if (membershipError) {
      // Handle unique constraint violation (single-tenant rule)
      if (membershipError.code === '23505') {
        return json({
          success: false,
          error: 'This email already belongs to another workspace.',
          error_code: 'single_tenant_conflict',
        })
      }
      console.error('Membership creation error:', membershipError)
      return json({
        success: false,
        error: 'Failed to create workspace membership. Please try again.',
        error_code: 'membership_failed',
      })
    }

    // ── Set tenants.owner_user_id if this is an owner invite ──
    if (isOwnerInvite) {
      await adminClient
        .from('tenants')
        .update({ owner_user_id: user.id })
        .eq('id', invitation.tenant_id)
    }

    return json({
      success: true,
      invitation_id: invitation.id,
      tenant_slug: tenantData?.slug,
      tenant_name: tenantData?.name,
      membership_role: membershipRole,
      profile_role: profileRole,
      setup_flow: isOwnerInvite ? 'owner_setup' : 'client_setup',
    })
  } catch (err) {
    console.error('accept-invite error:', err)
    return json({
      success: false,
      error: 'An unexpected error occurred. Please try again.',
      error_code: 'internal',
    })
  }
})
