begin;

-- ============================================================================
-- Pricing Policies (Phase 1 — schema only)
--
-- Adds client-specific pricing rules with priority:
--   1. Product-specific discount  (pricing_policy_items.scope = 'product')
--   2. Category-specific discount (pricing_policy_items.scope = 'category')
--   3. Default discount           (pricing_policies.default_discount)
--
-- Discounts are stored as decimal rates (0.10 = 10%, 0.50 = 50%).
--
-- This migration only creates the new tables, indexes, and RLS. It does NOT:
--   * touch profiles.commission_rate or any other existing column
--   * modify products, categories, quotes, or any existing RLS policy
--   * backfill any data
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Table: pricing_policies
-- One active policy per (tenant, client). Created/managed by tenant admins.
-- ---------------------------------------------------------------------------
create table if not exists public.pricing_policies (
  id                uuid primary key default gen_random_uuid(),
  tenant_id         uuid not null default public.current_tenant_id(),
  client_user_id    uuid not null references public.profiles(id) on delete cascade,
  name              text not null,
  default_discount  numeric(5,4) not null default 0,
  is_active         boolean not null default true,
  created_by        uuid references auth.users(id),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  constraint pricing_policies_tenant_client_unique
    unique (tenant_id, client_user_id),
  constraint pricing_policies_default_discount_range
    check (default_discount >= 0 and default_discount <= 0.5)
);

-- Indexes (the unique table constraint already creates a btree on
-- (tenant_id, client_user_id) so we do not duplicate that).
create index if not exists idx_pricing_policies_tenant_id
  on public.pricing_policies(tenant_id);

create index if not exists idx_pricing_policies_tenant_active
  on public.pricing_policies(tenant_id)
  where is_active = true;

-- Reuse the shared updated_at trigger function created earlier in the project
-- (see 20260312122900_create_econt_integrations_and_shipments.sql).
drop trigger if exists update_pricing_policies_updated_at on public.pricing_policies;
create trigger update_pricing_policies_updated_at
  before update on public.pricing_policies
  for each row
  execute function public.update_updated_at_column();


-- ---------------------------------------------------------------------------
-- Table: pricing_policy_items
-- A policy has 0..N overrides. Each item is either a product-SKU override or
-- a category override, never both (XOR enforced via CHECK).
--
-- Product overrides key on SKU (not product_id) because CSV re-imports
-- replace product rows; SKU is the stable identifier (same reasoning as
-- wishlist_items.product_sku).
-- ---------------------------------------------------------------------------
create table if not exists public.pricing_policy_items (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null default public.current_tenant_id(),
  policy_id    uuid not null references public.pricing_policies(id) on delete cascade,
  scope        text not null,
  product_sku  text,
  category_id  uuid references public.categories(id) on delete cascade,
  discount     numeric(5,4) not null,
  created_at   timestamptz not null default now(),
  constraint pricing_policy_items_scope_valid
    check (scope in ('product', 'category')),
  constraint pricing_policy_items_discount_range
    check (discount >= 0 and discount <= 0.5),
  constraint pricing_policy_items_target_xor
    check (
      (scope = 'product'  and product_sku is not null and category_id is null)
      or
      (scope = 'category' and category_id is not null and product_sku is null)
    )
);

-- Prevent duplicate overrides for the same target inside one policy.
-- PostgreSQL treats NULLs as distinct in UNIQUE constraints, so a composite
-- UNIQUE over the nullable target columns does not reliably block duplicates.
-- Use two partial unique indexes scoped per scope value instead.
create unique index if not exists idx_pricing_policy_items_unique_product
  on public.pricing_policy_items(policy_id, product_sku)
  where scope = 'product';

create unique index if not exists idx_pricing_policy_items_unique_category
  on public.pricing_policy_items(policy_id, category_id)
  where scope = 'category';

create index if not exists idx_pricing_policy_items_policy_id
  on public.pricing_policy_items(policy_id);

create index if not exists idx_pricing_policy_items_tenant_sku
  on public.pricing_policy_items(tenant_id, product_sku)
  where scope = 'product';

create index if not exists idx_pricing_policy_items_tenant_category
  on public.pricing_policy_items(tenant_id, category_id)
  where scope = 'category';


-- ---------------------------------------------------------------------------
-- Row-Level Security
-- ---------------------------------------------------------------------------
alter table public.pricing_policies      enable row level security;
alter table public.pricing_policy_items  enable row level security;

-- ---- pricing_policies ----------------------------------------------------

-- Admin (owner/admin via tenant_memberships) — full CRUD inside own tenant.
drop policy if exists "pricing_policies_admin_all" on public.pricing_policies;
create policy "pricing_policies_admin_all"
  on public.pricing_policies
  as permissive
  for all
  to authenticated
  using (
    tenant_id = public.current_tenant_id()
    and public.is_tenant_admin()
  )
  with check (
    tenant_id = public.current_tenant_id()
    and public.is_tenant_admin()
  );

-- Client — read-only access to their own active policy.
drop policy if exists "pricing_policies_client_read_own_active" on public.pricing_policies;
create policy "pricing_policies_client_read_own_active"
  on public.pricing_policies
  as permissive
  for select
  to authenticated
  using (
    tenant_id = public.current_tenant_id()
    and client_user_id = auth.uid()
    and is_active = true
  );

-- ---- pricing_policy_items ------------------------------------------------

drop policy if exists "pricing_policy_items_admin_all" on public.pricing_policy_items;
create policy "pricing_policy_items_admin_all"
  on public.pricing_policy_items
  as permissive
  for all
  to authenticated
  using (
    tenant_id = public.current_tenant_id()
    and public.is_tenant_admin()
  )
  with check (
    tenant_id = public.current_tenant_id()
    and public.is_tenant_admin()
  );

-- Client — read-only access to items that belong to their own active policy
-- within the same tenant.
drop policy if exists "pricing_policy_items_client_read_own_active" on public.pricing_policy_items;
create policy "pricing_policy_items_client_read_own_active"
  on public.pricing_policy_items
  as permissive
  for select
  to authenticated
  using (
    tenant_id = public.current_tenant_id()
    and exists (
      select 1
      from public.pricing_policies p
      where p.id              = pricing_policy_items.policy_id
        and p.tenant_id       = pricing_policy_items.tenant_id
        and p.client_user_id  = auth.uid()
        and p.is_active       = true
    )
  );

-- ---------------------------------------------------------------------------
-- Table-level grants
-- Required because Postgres' default privileges do not grant DML to the
-- authenticated role. RLS still applies on top of these grants.
-- No grants to anon. No public grants.
-- ---------------------------------------------------------------------------
grant select, insert, update, delete on public.pricing_policies      to authenticated;
grant select, insert, update, delete on public.pricing_policy_items  to authenticated;

commit;
