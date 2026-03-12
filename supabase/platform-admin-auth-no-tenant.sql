-- Fix: allow platform-admin auth checks without tenant membership
--
-- Problem:
-- - App-host platform admin accounts can exist without tenant membership.
-- - Tenant-scoped profile RLS can hide their own profile when current_tenant_id() is null.
--
-- This migration adds a minimal self-select policy and hardens is_platform_admin()
-- to run as SECURITY DEFINER, so platform admin checks work consistently.

begin;

create or replace function public.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and is_platform_admin = true
  )
$$;

grant execute on function public.is_platform_admin() to authenticated;

drop policy if exists "profiles_self_select" on public.profiles;
create policy "profiles_self_select"
  on public.profiles
  for select
  using (id = auth.uid());

commit;
