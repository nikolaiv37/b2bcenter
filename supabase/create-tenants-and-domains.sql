create extension if not exists "pgcrypto";

create table if not exists public.tenants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  status text not null default 'active' check (status in ('active', 'suspended')),
  branding jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.tenant_domains (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  domain text not null,
  verified boolean not null default false,
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tenant_domains_domain_lowercase_chk check (domain = lower(domain))
);

create unique index if not exists tenant_domains_domain_key on public.tenant_domains (domain);
create unique index if not exists tenant_domains_primary_per_tenant on public.tenant_domains (tenant_id) where is_primary;

create table if not exists public.tenant_memberships (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'admin', 'member')),
  created_at timestamptz not null default now(),
  unique (user_id, tenant_id),
  unique (user_id)
);

alter table public.tenants enable row level security;
alter table public.tenant_domains enable row level security;
alter table public.tenant_memberships enable row level security;

revoke all on table public.tenants from anon;
grant select (id, name, slug, status, branding) on table public.tenants to anon;
grant select (id, name, slug, status, branding) on table public.tenants to authenticated;

create policy "tenants_public_select"
  on public.tenants
  for select
  using (true);

revoke all on table public.tenant_domains from anon;
grant select (tenant_id, domain, verified, is_primary) on table public.tenant_domains to anon;
grant select (tenant_id, domain, verified, is_primary) on table public.tenant_domains to authenticated;

revoke all on table public.tenant_memberships from anon;
grant select on table public.tenant_memberships to authenticated;

create policy "tenant_domains_public_select_verified"
  on public.tenant_domains
  for select
  using (verified = true);

create policy "tenant_memberships_select_own"
  on public.tenant_memberships
  for select
  using (auth.uid() = user_id);
