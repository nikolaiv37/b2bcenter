-- Fix: allow tenant admins/owners to read all memberships in their tenant.
--
-- Problem:
--   The existing "tenant_memberships_select_own" policy only lets users see
--   their own membership row.  useQueryClients builds a membershipRole map from
--   ALL tenant memberships so it can distinguish accepted clients (role='member')
--   from pending invites (invitation_status='invited').  With only the own-row
--   policy in place admins can never see client membership rows, so the map is
--   always empty and the filter falls back to invitation_status === 'invited'.
--   Once a client completes their setup flow (invitation_status → 'active') they
--   vanish from the clients page entirely.
--
-- Fix:
--   Add a separate policy that lets tenant admins/owners SELECT all membership
--   rows that belong to their tenant.

begin;

create policy "tenant_memberships_select_admin"
  on public.tenant_memberships
  for select
  using (
    tenant_id = public.current_tenant_id()
    and public.is_tenant_admin()
  );

commit;
