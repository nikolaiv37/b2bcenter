// supabase/functions/delete-tenant/index.ts
//
// Edge Function: delete-tenant
// Called by platform admins to permanently delete a tenant and cleanup tenant-linked data.
//
// POST body: { tenant_id, delete_member_accounts?: boolean }
// Auth: requires valid JWT + profiles.is_platform_admin = true

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

type JsonRecord = Record<string, unknown>

const json = (body: JsonRecord, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })

function isIgnorableMissingTableError(error: { code?: string; message?: string } | null) {
  if (!error) return false
  const message = (error.message || '').toLowerCase()
  return (
    error.code === '42P01' ||
    error.code === 'PGRST204' ||
    error.code === 'PGRST205' ||
    message.includes('could not find the table') ||
    message.includes('schema cache')
  )
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
    const tenantId = typeof body?.tenant_id === 'string' ? body.tenant_id : ''
    const deleteMemberAccounts = body?.delete_member_accounts !== false

    if (!tenantId) {
      return json({ error: 'tenant_id is required' }, 400)
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    })
    const adminClient = createClient(supabaseUrl, serviceRoleKey)

    const {
      data: { user },
      error: userError,
    } = await userClient.auth.getUser()

    if (userError || !user) {
      return json({ error: 'Unauthorized' }, 401)
    }

    const { data: callerProfile } = await adminClient
      .from('profiles')
      .select('is_platform_admin')
      .eq('id', user.id)
      .single()

    if (!callerProfile?.is_platform_admin) {
      return json({ error: 'Only platform admins can delete tenants' }, 403)
    }

    const { data: tenant, error: tenantFetchError } = await adminClient
      .from('tenants')
      .select('id, name, slug, owner_user_id')
      .eq('id', tenantId)
      .single()

    if (tenantFetchError || !tenant) {
      return json({ error: 'Tenant not found' }, 404)
    }

    const { data: membershipRows, error: membershipFetchError } = await adminClient
      .from('tenant_memberships')
      .select('user_id')
      .eq('tenant_id', tenantId)

    if (membershipFetchError) {
      return json({ error: `Failed to fetch tenant memberships: ${membershipFetchError.message}` }, 500)
    }

    const membershipUserIds = Array.from(
      new Set((membershipRows || []).map((row) => row.user_id).filter(Boolean))
    ) as string[]

    const { data: invitationRows } = await adminClient
      .from('tenant_invitations')
      .select('email')
      .eq('tenant_id', tenantId)

    const invitationEmails = Array.from(
      new Set(
        (invitationRows || [])
          .map((row) => (typeof row.email === 'string' ? row.email.trim().toLowerCase() : ''))
          .filter(Boolean)
      )
    )

    // Collect auth users to optionally delete:
    // 1) members of this tenant
    // 2) invited users (created by inviteUserByEmail) even if they never accepted
    const candidateUserIds = new Set<string>(membershipUserIds)
    if (deleteMemberAccounts && invitationEmails.length > 0) {
      let page = 1
      const perPage = 1000

      while (true) {
        const { data, error } = await adminClient.auth.admin.listUsers({ page, perPage })
        if (error) {
          console.warn('listUsers failed while collecting invitees:', error.message)
          break
        }

        const users = data?.users ?? []
        for (const authUser of users) {
          const email = authUser.email?.trim().toLowerCase()
          if (email && invitationEmails.includes(email)) {
            candidateUserIds.add(authUser.id)
          }
        }

        if (users.length < perPage) break
        page += 1
      }
    }

    const platformAdminCandidateIds = new Set<string>()
    if (candidateUserIds.size > 0) {
      const { data: candidateProfiles, error: candidateProfilesError } = await adminClient
        .from('profiles')
        .select('id, is_platform_admin')
        .in('id', Array.from(candidateUserIds))

      if (candidateProfilesError && !isIgnorableMissingTableError(candidateProfilesError)) {
        console.warn('Failed to prefetch candidate profiles:', candidateProfilesError.message)
      } else {
        for (const row of candidateProfiles || []) {
          if (row.is_platform_admin === true) {
            platformAdminCandidateIds.add(row.id)
          }
        }
      }
    }

    // Delete tenant-scoped application rows first (best effort for optional tables).
    const tenantScopedTables = [
      'notifications',
      'client_invitations',
      'csv_import_history',
      // Must come before profiles/companies because tenant_invitations.profile_id
      // can reference public.profiles without ON DELETE CASCADE.
      'tenant_invitations',
      'tenant_memberships',
      'tenant_domains',
      'wishlist_items',
      'complaints',
      'quotes',
      'products',
      'categories',
      'companies',
      'profiles',
    ]

    for (const table of tenantScopedTables) {
      const { error } = await adminClient.from(table).delete().eq('tenant_id', tenantId)
      if (error && !isIgnorableMissingTableError(error)) {
        console.error(`Failed deleting from ${table}:`, error)
        return json({ error: `Failed cleaning table "${table}": ${error.message}` }, 500)
      }
    }

    // Some tables may reference profiles/auth users but not tenant_id directly.
    // Null out / delete references if the table exists.
    if (candidateUserIds.size > 0) {
      const { error: invitedByNullError } = await adminClient
        .from('client_invitations')
        .update({ invited_by: null })
        .in('invited_by', Array.from(candidateUserIds))

      if (invitedByNullError && !isIgnorableMissingTableError(invitedByNullError)) {
        console.warn('client_invitations invited_by cleanup warning:', invitedByNullError.message)
      }

      const { error: profileIdDeleteError } = await adminClient
        .from('client_invitations')
        .delete()
        .in('profile_id', Array.from(candidateUserIds))

      if (profileIdDeleteError && !isIgnorableMissingTableError(profileIdDeleteError)) {
        console.warn('client_invitations profile_id cleanup warning:', profileIdDeleteError.message)
      }
    }

    // Finally delete tenant (frees the slug)
    const { error: tenantDeleteError } = await adminClient
      .from('tenants')
      .delete()
      .eq('id', tenantId)

    if (tenantDeleteError) {
      console.error('Tenant delete failed:', tenantDeleteError)
      return json({ error: `Failed to delete tenant: ${tenantDeleteError.message}` }, 500)
    }

    let deletedMemberAccounts = 0
    let skippedMemberAccounts = 0
    const skippedReasons: Array<{ user_id: string; reason: string }> = []

    if (deleteMemberAccounts && candidateUserIds.size > 0) {
      for (const userId of candidateUserIds) {
        // Avoid deleting the currently logged-in platform admin if they somehow end up in the set.
        if (userId === user.id) {
          skippedMemberAccounts += 1
          skippedReasons.push({ user_id: userId, reason: 'current-caller' })
          continue
        }

        const { data: remainingMemberships, error: remainingMembershipsError } = await adminClient
          .from('tenant_memberships')
          .select('id', { count: 'exact' })
          .eq('user_id', userId)

        if (remainingMembershipsError) {
          skippedMemberAccounts += 1
          skippedReasons.push({ user_id: userId, reason: 'membership-check-failed' })
          continue
        }

        if ((remainingMemberships?.length ?? 0) > 0) {
          skippedMemberAccounts += 1
          skippedReasons.push({ user_id: userId, reason: 'still-has-membership' })
          continue
        }

        if (platformAdminCandidateIds.has(userId)) {
          skippedMemberAccounts += 1
          skippedReasons.push({ user_id: userId, reason: 'platform-admin' })
          continue
        }

        // Remove profile row first in case FK auth.users <- profiles is non-cascade.
        const { error: profileDeleteError } = await adminClient
          .from('profiles')
          .delete()
          .eq('id', userId)

        if (profileDeleteError && !isIgnorableMissingTableError(profileDeleteError)) {
          console.warn(`Profile delete failed for ${userId}:`, profileDeleteError.message)
        }

        const { error: deleteUserError } = await adminClient.auth.admin.deleteUser(userId)
        if (deleteUserError) {
          skippedMemberAccounts += 1
          skippedReasons.push({ user_id: userId, reason: `auth-delete-failed:${deleteUserError.message}` })
          continue
        }

        deletedMemberAccounts += 1
      }
    }

    return json({
      success: true,
      summary: {
        deleted_tenant_id: tenant.id,
        deleted_tenant_slug: tenant.slug,
        deleted_member_accounts: deletedMemberAccounts,
        skipped_member_accounts: skippedMemberAccounts,
      },
      skipped_accounts: skippedReasons,
    })
  } catch (err) {
    console.error('Unexpected error in delete-tenant:', err)
    const message = err instanceof Error ? err.message : 'Internal server error'
    return json({ error: message }, 500)
  }
})
