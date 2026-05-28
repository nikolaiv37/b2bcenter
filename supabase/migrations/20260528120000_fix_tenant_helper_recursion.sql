-- Fix: infinite recursion in tenant_memberships RLS (HTTP 500 on products/etc.)
--
-- Problem:
--   public.current_tenant_id() and public.is_tenant_admin() both SELECT from
--   public.tenant_memberships and were defined as plain (SECURITY INVOKER)
--   functions. Migration 20260312123100_tenant_memberships_admin_select.sql
--   added a SELECT policy ON public.tenant_memberships whose USING clause calls
--   those same helpers. Evaluating that policy re-enters tenant_memberships,
--   which re-evaluates the policy, which calls the helper again, ...
--     -> ERROR 42P17: infinite recursion detected in policy for relation
--        "tenant_memberships"  (PostgREST surfaces this as HTTP 500).
--
--   Because the products SELECT policy is `tenant_id = public.current_tenant_id()`,
--   every read of products (and every other tenant-scoped table) trips the
--   recursion and returns 500.
--
-- Fix:
--   Mark the two helper functions SECURITY DEFINER with a pinned search_path.
--   A SECURITY DEFINER function runs with the owner's rights and bypasses RLS
--   for its own internal queries, so reading tenant_memberships inside the
--   helper no longer re-evaluates the tenant_memberships policies -> no
--   recursion. This is the standard Supabase pattern for RLS helper functions.
--
--   Behaviour is otherwise unchanged: both helpers still scope strictly to the
--   currently authenticated user via auth.uid().

begin;

create or replace function public.current_tenant_id()
returns uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select tenant_id
  from public.tenant_memberships
  where user_id = auth.uid()
  limit 1
$$;

create or replace function public.is_tenant_admin()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.tenant_memberships
    where user_id = auth.uid()
      and role in ('owner', 'admin')
  )
$$;

commit;
