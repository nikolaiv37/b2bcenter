-- FIRST_TENANT_BOOTSTRAP.sql
-- Purpose: seed first working tenant + owner/platform state for local testing.
-- Preconditions:
--   1) Run all REQUIRED steps from FINAL_B2BCENTER_MIGRATION_ORDER.md first.
--   2) You already have an auth user in auth.users (create one via app signup or Supabase Auth UI).
--   3) Edit the variables in the DO block before execution.

begin;

do $$
declare
  -- REQUIRED: replace these values
  v_owner_user_id_text text := 'REPLACE_OWNER_AUTH_USER_UUID';
  v_owner_email text := 'owner@example.com';
  v_tenant_name text := 'B2BCenter Local';
  v_tenant_slug text := 'b2bcenter';

  -- optional switches
  v_make_platform_admin boolean := true;
  v_company_slug text := 'b2bcenter-local-company';

  v_owner_user_id uuid;
  v_tenant_id uuid;
  v_company_id uuid;
  v_other_tenant_for_user uuid;
begin
  if v_owner_user_id_text = 'REPLACE_OWNER_AUTH_USER_UUID' then
    raise exception 'Replace v_owner_user_id_text before running FIRST_TENANT_BOOTSTRAP.sql';
  end if;

  v_owner_user_id := v_owner_user_id_text::uuid;

  if not exists (
    select 1 from auth.users u where u.id = v_owner_user_id
  ) then
    raise exception 'auth.users row not found for id %', v_owner_user_id;
  end if;

  -- 1) Ensure tenant exists
  insert into public.tenants (name, slug, status, branding)
  values (v_tenant_name, v_tenant_slug, 'active', '{}'::jsonb)
  on conflict (slug) do update
    set name = excluded.name,
        status = 'active'
  returning id into v_tenant_id;

  -- Guard for single-tenant membership rule (unique(user_id))
  select m.tenant_id into v_other_tenant_for_user
  from public.tenant_memberships m
  where m.user_id = v_owner_user_id
    and m.tenant_id <> v_tenant_id
  limit 1;

  if v_other_tenant_for_user is not null then
    raise exception 'User % is already linked to another tenant (%)', v_owner_user_id, v_other_tenant_for_user;
  end if;

  -- 2) Ensure one onboarded company exists for the tenant
  insert into public.companies (
    name,
    slug,
    tenant_id,
    onboarding_completed
  )
  values (
    v_tenant_name || ' Company',
    v_company_slug,
    v_tenant_id,
    true
  )
  on conflict (slug) do update
    set name = excluded.name,
        tenant_id = excluded.tenant_id,
        onboarding_completed = true
  returning id into v_company_id;

  -- 3) Ensure owner profile exists and is tenant-linked
  insert into public.profiles (
    id,
    email,
    role,
    company_id,
    company_name,
    phone,
    tenant_id,
    invitation_status,
    is_platform_admin
  )
  values (
    v_owner_user_id,
    lower(trim(v_owner_email)),
    'admin',
    v_company_id,
    v_tenant_name || ' Company',
    null,
    v_tenant_id,
    'active',
    v_make_platform_admin
  )
  on conflict (id) do update
    set email = excluded.email,
        role = 'admin',
        company_id = excluded.company_id,
        company_name = excluded.company_name,
        tenant_id = excluded.tenant_id,
        invitation_status = 'active',
        is_platform_admin = excluded.is_platform_admin;

  -- 4) Ensure owner membership exists
  insert into public.tenant_memberships (user_id, tenant_id, role)
  values (v_owner_user_id, v_tenant_id, 'owner')
  on conflict (user_id, tenant_id) do update
    set role = 'owner';

  -- 5) Ensure tenants.owner_user_id is set (column added by platform migration)
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'tenants'
      and column_name = 'owner_user_id'
  ) then
    update public.tenants
    set owner_user_id = v_owner_user_id
    where id = v_tenant_id;
  end if;

  raise notice 'FIRST_TENANT_BOOTSTRAP complete: tenant_id=%, company_id=%, owner_user_id=%',
    v_tenant_id, v_company_id, v_owner_user_id;
end $$;

commit;

-- Optional verification queries:
-- select id, name, slug, status, owner_user_id from public.tenants order by created_at desc;
-- select user_id, tenant_id, role from public.tenant_memberships order by created_at desc;
-- select id, email, role, tenant_id, company_id, is_platform_admin from public.profiles where id = 'REPLACE_OWNER_AUTH_USER_UUID'::uuid;
