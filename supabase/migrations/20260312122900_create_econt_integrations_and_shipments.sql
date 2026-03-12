begin;

-- Ensure shared updated_at trigger function exists (used across the project)
create or replace function public.update_updated_at_column()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.tenant_integrations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  provider text not null,
  enabled boolean not null default false,
  environment text not null default 'demo' check (environment in ('demo', 'prod')),
  credentials jsonb not null default '{}'::jsonb,
  defaults jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tenant_integrations_provider_not_blank check (length(trim(provider)) > 0)
);

create unique index if not exists idx_tenant_integrations_tenant_provider
  on public.tenant_integrations(tenant_id, provider);
create index if not exists idx_tenant_integrations_tenant_id
  on public.tenant_integrations(tenant_id);

create table if not exists public.shipments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  quote_id integer references public.quotes(id) on delete set null,
  carrier text not null,
  receiver jsonb not null default '{}'::jsonb,
  destination jsonb not null default '{}'::jsonb,
  parcels_count integer not null default 1 check (parcels_count > 0),
  weight_kg numeric(10,3) not null default 1 check (weight_kg > 0),
  cod_amount numeric(12,2),
  declared_value numeric(12,2),
  price_amount numeric(12,2),
  currency text not null default 'BGN',
  econt_waybill_number text,
  econt_label_data jsonb,
  status text not null default 'draft',
  last_synced_at timestamptz,
  tracking_last_requested_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint shipments_carrier_not_blank check (length(trim(carrier)) > 0),
  constraint shipments_status_check check (
    status in (
      'draft',
      'calculated',
      'created',
      'cancelled',
      'in_transit',
      'delivered',
      'returned',
      'error'
    )
  )
);

create index if not exists idx_shipments_tenant_id
  on public.shipments(tenant_id);
create index if not exists idx_shipments_tenant_quote_id
  on public.shipments(tenant_id, quote_id);
create index if not exists idx_shipments_tenant_carrier
  on public.shipments(tenant_id, carrier);
create index if not exists idx_shipments_econt_waybill_number
  on public.shipments(econt_waybill_number)
  where econt_waybill_number is not null;
create index if not exists idx_shipments_tracking_last_requested_at
  on public.shipments(tracking_last_requested_at)
  where tracking_last_requested_at is not null;

-- updated_at triggers
DROP TRIGGER IF EXISTS update_tenant_integrations_updated_at ON public.tenant_integrations;
create trigger update_tenant_integrations_updated_at
before update on public.tenant_integrations
for each row
execute function public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_shipments_updated_at ON public.shipments;
create trigger update_shipments_updated_at
before update on public.shipments
for each row
execute function public.update_updated_at_column();

alter table public.tenant_integrations enable row level security;
alter table public.shipments enable row level security;

-- Tenant integrations: only tenant owner/admin can read/write
DROP POLICY IF EXISTS "tenant_integrations_select_admin" ON public.tenant_integrations;
create policy "tenant_integrations_select_admin"
  on public.tenant_integrations for select
  using (
    tenant_id = public.current_tenant_id()
    and public.is_tenant_admin()
  );

DROP POLICY IF EXISTS "tenant_integrations_insert_admin" ON public.tenant_integrations;
create policy "tenant_integrations_insert_admin"
  on public.tenant_integrations for insert
  with check (
    tenant_id = public.current_tenant_id()
    and public.is_tenant_admin()
  );

DROP POLICY IF EXISTS "tenant_integrations_update_admin" ON public.tenant_integrations;
create policy "tenant_integrations_update_admin"
  on public.tenant_integrations for update
  using (
    tenant_id = public.current_tenant_id()
    and public.is_tenant_admin()
  )
  with check (
    tenant_id = public.current_tenant_id()
    and public.is_tenant_admin()
  );

DROP POLICY IF EXISTS "tenant_integrations_delete_admin" ON public.tenant_integrations;
create policy "tenant_integrations_delete_admin"
  on public.tenant_integrations for delete
  using (
    tenant_id = public.current_tenant_id()
    and public.is_tenant_admin()
  );

-- Shipments: tenant-isolated. Members can use shipment features via app/edge functions.
DROP POLICY IF EXISTS "tenant_shipments_select" ON public.shipments;
create policy "tenant_shipments_select"
  on public.shipments for select
  using (
    tenant_id = public.current_tenant_id()
    and auth.uid() is not null
  );

DROP POLICY IF EXISTS "tenant_shipments_insert" ON public.shipments;
create policy "tenant_shipments_insert"
  on public.shipments for insert
  with check (
    tenant_id = public.current_tenant_id()
    and auth.uid() is not null
  );

DROP POLICY IF EXISTS "tenant_shipments_update" ON public.shipments;
create policy "tenant_shipments_update"
  on public.shipments for update
  using (
    tenant_id = public.current_tenant_id()
    and auth.uid() is not null
    and public.is_tenant_admin()
  )
  with check (
    tenant_id = public.current_tenant_id()
    and auth.uid() is not null
    and public.is_tenant_admin()
  );

DROP POLICY IF EXISTS "tenant_shipments_delete_admin" ON public.shipments;
create policy "tenant_shipments_delete_admin"
  on public.shipments for delete
  using (
    tenant_id = public.current_tenant_id()
    and public.is_tenant_admin()
  );

grant select, insert, update, delete on public.tenant_integrations to authenticated;
grant select, insert, update, delete on public.shipments to authenticated;

commit;
