// supabase/functions/deactivate-client/index.ts
//
// Edge Function: deactivate-client
// Called by tenant admins to remove a client's workspace access.
// This is a soft removal: the tenant_memberships row is deleted, which
// blocks dashboard access. The profile, company, quotes, and orders
// remain intact for history.
//
// POST body: { client_id, tenant_id }
//
// Flow:
//   1. Validate caller is admin/owner of the tenant
//   2. Verify the target client exists and belongs to this tenant
//   3. Delete the tenant_memberships row for this user+tenant
//   4. Return success

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
    const { client_id, tenant_id } = body

    if (!client_id || !tenant_id) {
      return new Response(
        JSON.stringify({ error: 'client_id and tenant_id are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

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
        return new Response(JSON.stringify({ error: 'Only tenant admins can deactivate clients' }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
    }

    // Verify the target client has a membership in this tenant
    const { data: targetMembership, error: membershipLookupError } = await adminClient
      .from('tenant_memberships')
      .select('user_id, role')
      .eq('user_id', client_id)
      .eq('tenant_id', tenant_id)
      .single()

    if (membershipLookupError || !targetMembership) {
      return new Response(
        JSON.stringify({ error: 'Client not found in this workspace' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Prevent admins from removing owners or other admins
    if (targetMembership.role !== 'member') {
      return new Response(
        JSON.stringify({ error: `Cannot deactivate a user with role "${targetMembership.role}". Only client accounts can be deactivated.` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Prevent self-deactivation
    if (client_id === user.id) {
      return new Response(
        JSON.stringify({ error: 'You cannot deactivate your own account' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Delete the tenant_memberships row — this revokes dashboard access
    const { error: deleteError } = await adminClient
      .from('tenant_memberships')
      .delete()
      .eq('user_id', client_id)
      .eq('tenant_id', tenant_id)

    if (deleteError) {
      return new Response(
        JSON.stringify({ error: `Failed to deactivate client: ${deleteError.message}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({
        success: true,
        client_id,
        message: 'Client access revoked. Order history is preserved.',
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    console.error('Unexpected error in deactivate-client:', err)
    const message = err instanceof Error ? err.message : 'Internal server error'
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
