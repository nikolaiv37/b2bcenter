begin;

-- Soft-cut to single-tenant mode.
-- Keep tenant tables/columns to avoid risky rewrites, but enforce one workspace ID everywhere.

create or replace function public.single_tenant_id()
returns uuid
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_tenant_id uuid;
begin
  -- Prefer the standalone slug used by bootstrap migrations.
  select t.id
    into v_tenant_id
  from public.tenants t
  where t.slug = 'b2bcenter'
  order by t.created_at asc
  limit 1;

  if v_tenant_id is null then
    select t.id
      into v_tenant_id
    from public.tenants t
    order by t.created_at asc
    limit 1;
  end if;

  return v_tenant_id;
end;
$$;

grant execute on function public.single_tenant_id() to anon;
grant execute on function public.single_tenant_id() to authenticated;

-- Keep existing RLS logic functional, but stop depending strictly on membership lookup.
create or replace function public.current_tenant_id()
returns uuid
language sql
stable
security definer
set search_path = public, auth
as $$
  select coalesce(
    (
      select tm.tenant_id
      from public.tenant_memberships tm
      where tm.user_id = auth.uid()
      limit 1
    ),
    public.single_tenant_id()
  )
$$;

grant execute on function public.current_tenant_id() to anon;
grant execute on function public.current_tenant_id() to authenticated;

-- Enforce "only one tenant row" for future writes.
create or replace function public.enforce_single_tenant_row()
returns trigger
language plpgsql
as $$
begin
  if exists (
    select 1
    from public.tenants t
    where t.id <> coalesce(new.id, '00000000-0000-0000-0000-000000000000'::uuid)
  ) then
    raise exception 'single-tenant mode: additional tenant rows are blocked';
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_single_tenant_row on public.tenants;
create trigger enforce_single_tenant_row
before insert or update on public.tenants
for each row execute function public.enforce_single_tenant_row();

-- Enforce tenant_id = single_tenant_id() across tenant-scoped tables.
create or replace function public.enforce_single_tenant_fk()
returns trigger
language plpgsql
as $$
declare
  v_single_tenant_id uuid;
begin
  v_single_tenant_id := public.single_tenant_id();

  if v_single_tenant_id is null then
    raise exception 'single_tenant_id() is null; seed first tenant before writing %', tg_table_name;
  end if;

  if new.tenant_id is null then
    new.tenant_id := v_single_tenant_id;
  end if;

  if new.tenant_id <> v_single_tenant_id then
    raise exception 'single-tenant mode: %.tenant_id must be % (got %)', tg_table_name, v_single_tenant_id, new.tenant_id;
  end if;

  return new;
end;
$$;

-- Normalize defaults/backfill where needed.
do $$
declare
  table_name text;
begin
  foreach table_name in array ARRAY[
    'companies',
    'profiles',
    'products',
    'categories',
    'quotes',
    'complaints',
    'wishlist_items',
    'tenant_domains',
    'tenant_memberships',
    'tenant_invitations',
    'notifications',
    'tenant_integrations',
    'shipments',
    'csv_import_history'
  ]
  loop
    if to_regclass(format('public.%I', table_name)) is null then
      continue;
    end if;

    if not exists (
      select 1
      from information_schema.columns c
      where c.table_schema = 'public'
        and c.table_name = table_name
        and c.column_name = 'tenant_id'
    ) then
      continue;
    end if;

    execute format('alter table public.%I alter column tenant_id set default public.single_tenant_id()', table_name);
    execute format('update public.%I set tenant_id = public.single_tenant_id() where tenant_id is null', table_name);

    execute format('drop trigger if exists enforce_single_tenant_%I on public.%I', table_name, table_name);
    execute format(
      'create trigger enforce_single_tenant_%I before insert or update on public.%I for each row execute function public.enforce_single_tenant_fk()',
      table_name,
      table_name
    );
  end loop;
end $$;

-- Platform-only RPC is obsolete in single-tenant login flow.
drop function if exists public.lookup_tenant_by_email(text);

-- Remove platform-console RLS extras that are no longer needed.
drop policy if exists "tenants_platform_admin_update" on public.tenants;
drop policy if exists "tenants_platform_admin_insert" on public.tenants;
drop policy if exists "tenant_memberships_platform_admin_select" on public.tenant_memberships;
drop policy if exists "tenant_memberships_platform_admin_delete" on public.tenant_memberships;
drop policy if exists "profiles_platform_admin_select" on public.profiles;
drop policy if exists "tenant_invitations_platform_admin_select" on public.tenant_invitations;
drop policy if exists "tenant_invitations_platform_admin_insert" on public.tenant_invitations;
drop policy if exists "products_platform_admin_select" on public.products;
drop policy if exists "categories_platform_admin_select" on public.categories;

commit;
