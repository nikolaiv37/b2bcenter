-- Migration: Platform admin fields + tenant status standardization
--
-- 1. Add profiles.is_platform_admin flag
-- 2. Add tenants.owner_user_id
-- 3. Change tenant status from ('active','inactive') to ('active','suspended')
-- 4. Add platform-console indexes
-- 5. RLS: allow platform admins to read all tenants & memberships

begin;

-- ──────────────────────────────────────────────
-- 1. profiles.is_platform_admin
-- ──────────────────────────────────────────────

do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'profiles'
      and column_name = 'is_platform_admin'
  ) then
    alter table public.profiles
      add column is_platform_admin boolean not null default false;
  end if;
end $$;

-- ──────────────────────────────────────────────
-- 2. tenants.owner_user_id
-- ──────────────────────────────────────────────

do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'tenants'
      and column_name = 'owner_user_id'
  ) then
    alter table public.tenants
      add column owner_user_id uuid references auth.users(id);
  end if;
end $$;

-- Backfill owner_user_id from existing 'owner' memberships
update public.tenants t
set owner_user_id = tm.user_id
from public.tenant_memberships tm
where t.owner_user_id is null
  and tm.tenant_id = t.id
  and tm.role = 'owner';

-- ──────────────────────────────────────────────
-- 3. Tenant status: inactive -> suspended
-- ──────────────────────────────────────────────

-- Backfill any existing 'inactive' rows first
update public.tenants set status = 'suspended' where status = 'inactive';

-- Drop old check, add new one
alter table public.tenants drop constraint if exists tenants_status_check;
alter table public.tenants
  add constraint tenants_status_check check (status in ('active', 'suspended'));

-- ──────────────────────────────────────────────
-- 4. Indexes for platform console queries
-- ──────────────────────────────────────────────

create index if not exists idx_tenants_status on public.tenants(status);
create index if not exists idx_tenants_created_at on public.tenants(created_at);
create index if not exists idx_tenants_owner_user_id on public.tenants(owner_user_id);
create index if not exists idx_profiles_is_platform_admin on public.profiles(is_platform_admin) where is_platform_admin = true;

-- ──────────────────────────────────────────────
-- 5. Helper function: is_platform_admin()
-- ──────────────────────────────────────────────

create or replace function public.is_platform_admin()
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and is_platform_admin = true
  )
$$;

-- ──────────────────────────────────────────────
-- 6. RLS: platform admins can read all tenants (full row)
-- ──────────────────────────────────────────────

-- Grant additional columns to authenticated users who are platform admins.
-- The existing tenants_public_select policy already allows SELECT for all,
-- but column grants are limited. Grant full row access to authenticated.
grant select on table public.tenants to authenticated;

-- Platform admins can update tenants (suspend/resume, set owner)
drop policy if exists "tenants_platform_admin_update" on public.tenants;
create policy "tenants_platform_admin_update"
  on public.tenants
  for update
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

-- Platform admins can insert tenants
drop policy if exists "tenants_platform_admin_insert" on public.tenants;
create policy "tenants_platform_admin_insert"
  on public.tenants
  for insert
  with check (public.is_platform_admin());

-- Platform admins can read all memberships (cross-tenant)
drop policy if exists "tenant_memberships_platform_admin_select" on public.tenant_memberships;
create policy "tenant_memberships_platform_admin_select"
  on public.tenant_memberships
  for select
  using (public.is_platform_admin());

-- Platform admins can read all profiles (cross-tenant)
drop policy if exists "profiles_platform_admin_select" on public.profiles;
create policy "profiles_platform_admin_select"
  on public.profiles
  for select
  using (public.is_platform_admin());

-- Platform admins can read all invitations (cross-tenant)
drop policy if exists "tenant_invitations_platform_admin_select" on public.tenant_invitations;
create policy "tenant_invitations_platform_admin_select"
  on public.tenant_invitations
  for select
  using (public.is_platform_admin());

-- Platform admins can insert invitations (for owner invites when creating tenants)
drop policy if exists "tenant_invitations_platform_admin_insert" on public.tenant_invitations;
create policy "tenant_invitations_platform_admin_insert"
  on public.tenant_invitations
  for insert
  with check (public.is_platform_admin());

-- Platform admins can read all products (for tenant detail stats)
drop policy if exists "products_platform_admin_select" on public.products;
create policy "products_platform_admin_select"
  on public.products
  for select
  using (public.is_platform_admin());

-- Platform admins can read all categories (for tenant detail stats)
drop policy if exists "categories_platform_admin_select" on public.categories;
create policy "categories_platform_admin_select"
  on public.categories
  for select
  using (public.is_platform_admin());

-- Platform admins can delete memberships (for removing members from tenant detail)
drop policy if exists "tenant_memberships_platform_admin_delete" on public.tenant_memberships;
create policy "tenant_memberships_platform_admin_delete"
  on public.tenant_memberships
  for delete
  using (public.is_platform_admin());

commit;
