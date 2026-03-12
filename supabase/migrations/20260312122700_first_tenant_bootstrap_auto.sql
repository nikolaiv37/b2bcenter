-- Bootstrap first tenant/platform owner for fresh standalone b2bcenter projects.
-- Safe to rerun.

begin;

do $$
declare
  v_owner_user_id uuid;
  v_owner_email text;
  v_tenant_name text := 'B2BCenter';
  v_tenant_slug text := 'b2bcenter';
  v_company_slug text;
  v_tenant_id uuid;
  v_company_id uuid;
  v_existing_membership_tenant_id uuid;
begin
  -- Pick the oldest existing auth user as initial owner.
  select u.id, lower(trim(u.email))
    into v_owner_user_id, v_owner_email
  from auth.users u
  where u.email is not null
    and trim(u.email) <> ''
  order by u.created_at asc
  limit 1;

  if v_owner_user_id is null then
    raise exception 'No auth.users row found. Create one user first, then rerun this migration.';
  end if;

  v_company_slug := v_tenant_slug || '-' || substring(v_owner_user_id::text from 1 for 8) || '-company';

  insert into public.tenants (name, slug, status, branding)
  values (v_tenant_name, v_tenant_slug, 'active', '{}'::jsonb)
  on conflict (slug) do update
    set name = excluded.name,
        status = 'active'
  returning id into v_tenant_id;

  if v_tenant_id is null then
    select t.id into v_tenant_id
    from public.tenants t
    where t.slug = v_tenant_slug
    limit 1;
  end if;

  select tm.tenant_id
    into v_existing_membership_tenant_id
  from public.tenant_memberships tm
  where tm.user_id = v_owner_user_id
  limit 1;

  if v_existing_membership_tenant_id is not null
     and v_existing_membership_tenant_id <> v_tenant_id then
    raise exception
      'Bootstrap blocked: owner user % is already linked to tenant %',
      v_owner_user_id,
      v_existing_membership_tenant_id;
  end if;

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

  if v_company_id is null then
    select c.id into v_company_id
    from public.companies c
    where c.slug = v_company_slug
    limit 1;
  end if;

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
    v_owner_email,
    'admin',
    v_company_id,
    v_tenant_name || ' Company',
    null,
    v_tenant_id,
    'active',
    true
  )
  on conflict (id) do update
    set email = excluded.email,
        role = 'admin',
        company_id = excluded.company_id,
        company_name = excluded.company_name,
        tenant_id = excluded.tenant_id,
        invitation_status = 'active',
        is_platform_admin = true;

  insert into public.tenant_memberships (user_id, tenant_id, role)
  values (v_owner_user_id, v_tenant_id, 'owner')
  on conflict (user_id, tenant_id) do update
    set role = 'owner';

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

  raise notice
    'Bootstrap complete: owner_user_id=%, tenant_id=%, company_id=%',
    v_owner_user_id,
    v_tenant_id,
    v_company_id;
end $$;

commit;
