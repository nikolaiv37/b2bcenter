begin;

create table if not exists public.order_templates (
  id uuid default gen_random_uuid() primary key,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  source_quote_id integer references public.quotes(id) on delete set null,
  items jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_order_templates_tenant_user_created
  on public.order_templates(tenant_id, user_id, created_at desc);

create index if not exists idx_order_templates_source_quote_id
  on public.order_templates(source_quote_id);

create or replace function public.update_order_templates_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists order_templates_updated_at_trigger on public.order_templates;
create trigger order_templates_updated_at_trigger
  before update on public.order_templates
  for each row
  execute function public.update_order_templates_updated_at();

alter table public.order_templates enable row level security;

drop policy if exists "order_templates_select_own" on public.order_templates;
create policy "order_templates_select_own"
  on public.order_templates for select
  using (
    tenant_id = public.current_tenant_id()
    and user_id = auth.uid()
  );

drop policy if exists "order_templates_insert_own" on public.order_templates;
create policy "order_templates_insert_own"
  on public.order_templates for insert
  with check (
    tenant_id = public.current_tenant_id()
    and user_id = auth.uid()
  );

drop policy if exists "order_templates_delete_own" on public.order_templates;
create policy "order_templates_delete_own"
  on public.order_templates for delete
  using (
    tenant_id = public.current_tenant_id()
    and user_id = auth.uid()
  );

commit;
