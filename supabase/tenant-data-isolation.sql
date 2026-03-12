begin;

-- Helper: current tenant id for the authenticated user
create or replace function public.current_tenant_id()
returns uuid
language sql
stable
as $$
  select tenant_id
  from public.tenant_memberships
  where user_id = auth.uid()
  limit 1
$$;

-- Helper: tenant admin/owner check
create or replace function public.is_tenant_admin()
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.tenant_memberships
    where user_id = auth.uid()
      and role in ('owner', 'admin')
  )
$$;

-- Add tenant_id columns (nullable first)
alter table public.companies add column if not exists tenant_id uuid;
alter table public.profiles add column if not exists tenant_id uuid;
alter table public.products add column if not exists tenant_id uuid;
alter table public.categories add column if not exists tenant_id uuid;
alter table public.quotes add column if not exists tenant_id uuid;
alter table public.complaints add column if not exists tenant_id uuid;
alter table public.wishlist_items add column if not exists tenant_id uuid;
do $$
begin
  if to_regclass('public.csv_import_history') is not null then
    alter table public.csv_import_history add column if not exists tenant_id uuid;
  end if;
end $$;

-- Defaults for new rows
alter table public.companies alter column tenant_id set default public.current_tenant_id();
alter table public.profiles alter column tenant_id set default public.current_tenant_id();
alter table public.products alter column tenant_id set default public.current_tenant_id();
alter table public.categories alter column tenant_id set default public.current_tenant_id();
alter table public.quotes alter column tenant_id set default public.current_tenant_id();
alter table public.complaints alter column tenant_id set default public.current_tenant_id();
alter table public.wishlist_items alter column tenant_id set default public.current_tenant_id();
do $$
begin
  if to_regclass('public.csv_import_history') is not null then
    alter table public.csv_import_history alter column tenant_id set default public.current_tenant_id();
  end if;
end $$;

-- Backfill tenant_id using tenant_memberships and related tables
update public.profiles p
set tenant_id = tm.tenant_id
from public.tenant_memberships tm
where p.tenant_id is null
  and tm.user_id = p.id;

update public.companies c
set tenant_id = sub.tenant_id
from (
  select distinct on (p.company_id) p.company_id, tm.tenant_id
  from public.profiles p
  join public.tenant_memberships tm on tm.user_id = p.id
  where p.company_id is not null
  order by p.company_id, tm.tenant_id
) as sub
where c.tenant_id is null
  and c.id = sub.company_id;

update public.categories c
set tenant_id = co.tenant_id
from public.companies co
where c.tenant_id is null
  and c.company_id = co.id;

update public.products p
set tenant_id = tm.tenant_id
from public.tenant_memberships tm
where p.tenant_id is null
  and p.supplier_id = tm.user_id::text;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'products'
      and column_name = 'category_id'
  ) then
    update public.products p
    set tenant_id = c.tenant_id
    from public.categories c
    where p.tenant_id is null
      and p.category_id = c.id;
  end if;
end $$;

update public.quotes q
set tenant_id = tm.tenant_id
from public.tenant_memberships tm
where q.tenant_id is null
  and q.user_id::text = tm.user_id::text;

update public.complaints c
set tenant_id = tm.tenant_id
from public.tenant_memberships tm
where c.tenant_id is null
  and c.user_id = tm.user_id;

update public.wishlist_items w
set tenant_id = tm.tenant_id
from public.tenant_memberships tm
where w.tenant_id is null
  and w.user_id = tm.user_id;

do $$
begin
  if to_regclass('public.csv_import_history') is not null then
    update public.csv_import_history h
    set tenant_id = tm.tenant_id
    from public.tenant_memberships tm
    where h.tenant_id is null
      and h.user_id = tm.user_id;
  end if;
end $$;

-- Ensure no null tenant_id remains (safety checks)
do $$
declare csv_null_count bigint;
begin
  if exists (select 1 from public.profiles where tenant_id is null) then
    raise exception 'profiles.tenant_id backfill failed; resolve and rerun';
  end if;
  if exists (select 1 from public.companies where tenant_id is null) then
    raise exception 'companies.tenant_id backfill failed; resolve and rerun';
  end if;
  if exists (select 1 from public.categories where tenant_id is null) then
    raise exception 'categories.tenant_id backfill failed; resolve and rerun';
  end if;
  if exists (select 1 from public.products where tenant_id is null) then
    raise exception 'products.tenant_id backfill failed; resolve and rerun';
  end if;
  if exists (select 1 from public.quotes where tenant_id is null) then
    raise exception 'quotes.tenant_id backfill failed; resolve and rerun';
  end if;
  if exists (select 1 from public.complaints where tenant_id is null) then
    raise exception 'complaints.tenant_id backfill failed; resolve and rerun';
  end if;
  if exists (select 1 from public.wishlist_items where tenant_id is null) then
    raise exception 'wishlist_items.tenant_id backfill failed; resolve and rerun';
  end if;
  if to_regclass('public.csv_import_history') is not null then
    execute 'select count(*) from public.csv_import_history where tenant_id is null'
      into csv_null_count;
    if csv_null_count > 0 then
      raise exception 'csv_import_history.tenant_id backfill failed; resolve and rerun';
    end if;
  end if;
end $$;

-- Make tenant_id required
alter table public.profiles alter column tenant_id set not null;
alter table public.companies alter column tenant_id set not null;
alter table public.categories alter column tenant_id set not null;
alter table public.products alter column tenant_id set not null;
alter table public.quotes alter column tenant_id set not null;
alter table public.complaints alter column tenant_id set not null;
alter table public.wishlist_items alter column tenant_id set not null;
do $$
begin
  if to_regclass('public.csv_import_history') is not null then
    alter table public.csv_import_history alter column tenant_id set not null;
  end if;
end $$;

-- Indexes
create index if not exists idx_profiles_tenant_id on public.profiles(tenant_id);
create index if not exists idx_companies_tenant_id on public.companies(tenant_id);
create index if not exists idx_categories_tenant_id on public.categories(tenant_id);
create index if not exists idx_products_tenant_id on public.products(tenant_id);
create index if not exists idx_quotes_tenant_id on public.quotes(tenant_id);
create index if not exists idx_complaints_tenant_id on public.complaints(tenant_id);
create index if not exists idx_wishlist_items_tenant_id on public.wishlist_items(tenant_id);
do $$
begin
  if to_regclass('public.csv_import_history') is not null then
    execute 'create index if not exists idx_csv_import_history_tenant_id on public.csv_import_history(tenant_id)';
  end if;
end $$;

-- Update unique constraints for tenant scoping
alter table public.products drop constraint if exists products_sku_unique;
alter table public.products drop constraint if exists products_sku_key;
create unique index if not exists idx_products_tenant_sku_unique on public.products(tenant_id, sku);

alter table public.wishlist_items drop constraint if exists wishlist_items_user_id_product_sku_key;
create unique index if not exists idx_wishlist_items_tenant_user_sku_unique
  on public.wishlist_items(tenant_id, user_id, product_sku);

-- Drop all existing policies for affected tables
do $$
declare r record;
begin
  for r in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename in (
        'companies',
        'profiles',
        'products',
        'categories',
        'quotes',
        'complaints',
        'wishlist_items',
        'csv_import_history'
      )
  loop
    execute format('drop policy if exists %I on %I.%I', r.policyname, r.schemaname, r.tablename);
  end loop;
end $$;

-- Enable RLS
alter table public.companies enable row level security;
alter table public.profiles enable row level security;
alter table public.products enable row level security;
alter table public.categories enable row level security;
alter table public.quotes enable row level security;
alter table public.complaints enable row level security;
alter table public.wishlist_items enable row level security;
do $$
begin
  if to_regclass('public.csv_import_history') is not null then
    alter table public.csv_import_history enable row level security;
  end if;
end $$;

-- Companies policies
create policy "tenant_companies_select"
  on public.companies for select
  using (tenant_id = public.current_tenant_id());

create policy "tenant_companies_insert"
  on public.companies for insert
  with check (tenant_id = public.current_tenant_id());

create policy "tenant_companies_update_own"
  on public.companies for update
  using (
    tenant_id = public.current_tenant_id()
    and id in (select company_id from public.profiles where id = auth.uid())
  )
  with check (
    tenant_id = public.current_tenant_id()
    and id in (select company_id from public.profiles where id = auth.uid())
  );

-- Profiles policies
create policy "tenant_profiles_select"
  on public.profiles for select
  using (tenant_id = public.current_tenant_id());

create policy "tenant_profiles_insert"
  on public.profiles for insert
  with check (tenant_id = public.current_tenant_id() and id = auth.uid());

create policy "tenant_profiles_update_own"
  on public.profiles for update
  using (tenant_id = public.current_tenant_id() and id = auth.uid())
  with check (tenant_id = public.current_tenant_id() and id = auth.uid());

-- Products policies
create policy "tenant_products_select"
  on public.products for select
  using (tenant_id = public.current_tenant_id());

create policy "tenant_products_insert_admin"
  on public.products for insert
  with check (tenant_id = public.current_tenant_id() and public.is_tenant_admin());

create policy "tenant_products_update_admin"
  on public.products for update
  using (tenant_id = public.current_tenant_id() and public.is_tenant_admin())
  with check (tenant_id = public.current_tenant_id() and public.is_tenant_admin());

create policy "tenant_products_delete_admin"
  on public.products for delete
  using (tenant_id = public.current_tenant_id() and public.is_tenant_admin());

-- Categories policies
create policy "tenant_categories_select"
  on public.categories for select
  using (tenant_id = public.current_tenant_id());

create policy "tenant_categories_insert_admin"
  on public.categories for insert
  with check (tenant_id = public.current_tenant_id() and public.is_tenant_admin());

create policy "tenant_categories_update_admin"
  on public.categories for update
  using (tenant_id = public.current_tenant_id() and public.is_tenant_admin())
  with check (tenant_id = public.current_tenant_id() and public.is_tenant_admin());

create policy "tenant_categories_delete_admin"
  on public.categories for delete
  using (tenant_id = public.current_tenant_id() and public.is_tenant_admin());

-- Quotes policies
create policy "tenant_quotes_select"
  on public.quotes for select
  using (
    tenant_id = public.current_tenant_id()
    and (public.is_tenant_admin() or user_id::text = auth.uid()::text)
  );

create policy "tenant_quotes_insert"
  on public.quotes for insert
  with check (
    tenant_id = public.current_tenant_id()
    and user_id::text = auth.uid()::text
  );

create policy "tenant_quotes_update"
  on public.quotes for update
  using (
    tenant_id = public.current_tenant_id()
    and (public.is_tenant_admin() or user_id::text = auth.uid()::text)
  )
  with check (
    tenant_id = public.current_tenant_id()
    and (public.is_tenant_admin() or user_id::text = auth.uid()::text)
  );

create policy "tenant_quotes_delete_admin"
  on public.quotes for delete
  using (tenant_id = public.current_tenant_id() and public.is_tenant_admin());

-- Complaints policies
create policy "tenant_complaints_select"
  on public.complaints for select
  using (
    tenant_id = public.current_tenant_id()
    and (public.is_tenant_admin() or user_id = auth.uid())
  );

create policy "tenant_complaints_insert"
  on public.complaints for insert
  with check (
    tenant_id = public.current_tenant_id()
    and user_id = auth.uid()
  );

create policy "tenant_complaints_update_own_pending"
  on public.complaints for update
  using (
    tenant_id = public.current_tenant_id()
    and user_id = auth.uid()
    and status = 'pending'
  )
  with check (
    tenant_id = public.current_tenant_id()
    and user_id = auth.uid()
    and status = 'pending'
  );

create policy "tenant_complaints_update_admin"
  on public.complaints for update
  using (tenant_id = public.current_tenant_id() and public.is_tenant_admin())
  with check (tenant_id = public.current_tenant_id() and public.is_tenant_admin());

-- Wishlist policies
create policy "tenant_wishlist_select"
  on public.wishlist_items for select
  using (tenant_id = public.current_tenant_id() and user_id = auth.uid());

create policy "tenant_wishlist_insert"
  on public.wishlist_items for insert
  with check (tenant_id = public.current_tenant_id() and user_id = auth.uid());

create policy "tenant_wishlist_delete"
  on public.wishlist_items for delete
  using (tenant_id = public.current_tenant_id() and user_id = auth.uid());

-- CSV import history policies
do $$
begin
  if to_regclass('public.csv_import_history') is not null then
    execute 'create policy "tenant_csv_import_history_select"
      on public.csv_import_history for select
      using (
        tenant_id = public.current_tenant_id()
        and (user_id = auth.uid() or public.is_tenant_admin())
      )';

    execute 'create policy "tenant_csv_import_history_insert"
      on public.csv_import_history for insert
      with check (
        tenant_id = public.current_tenant_id()
        and user_id = auth.uid()
      )';
  end if;
end $$;

commit;
