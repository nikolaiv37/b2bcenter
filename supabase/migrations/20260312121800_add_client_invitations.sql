-- Migration: Client Invitations
-- Adds support for tenant admins to invite new client companies via email.
--
-- Creates:
--   tenant_invitations  – tracks each invite (token, email, status, tenant)
--   invitation_status   – column on profiles to distinguish Active vs Invited
--
-- RLS:
--   Only tenant admins/owners can SELECT / INSERT / UPDATE invitations for their tenant.

begin;

-- ──────────────────────────────────────────────
-- 1. tenant_invitations table
-- ──────────────────────────────────────────────

create table if not exists public.tenant_invitations (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.tenants(id) on delete cascade,
  email       text not null,
  company_name text,                      -- optional: pre-filled company name
  commission_rate numeric(5,4) default 0, -- optional: default commission (0-0.50)
  token       text not null unique default encode(gen_random_bytes(32), 'hex'),
  status      text not null default 'pending'
                check (status in ('pending', 'accepted', 'expired', 'revoked')),
  invited_by  uuid references auth.users(id),
  profile_id  uuid references public.profiles(id), -- set when invite is accepted
  created_at  timestamptz not null default now(),
  accepted_at timestamptz,
  expires_at  timestamptz not null default (now() + interval '7 days'),

  -- One active invite per email per tenant
  unique (tenant_id, email)
);

create index if not exists idx_tenant_invitations_tenant on public.tenant_invitations(tenant_id);
create index if not exists idx_tenant_invitations_token  on public.tenant_invitations(token);
create index if not exists idx_tenant_invitations_email  on public.tenant_invitations(email);

-- ──────────────────────────────────────────────
-- 2. Add invitation_status to profiles
-- ──────────────────────────────────────────────

do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'profiles'
      and column_name = 'invitation_status'
  ) then
    alter table public.profiles
      add column invitation_status text not null default 'active'
        check (invitation_status in ('active', 'invited'));
  end if;
end $$;

-- ──────────────────────────────────────────────
-- 3. RLS for tenant_invitations
-- ──────────────────────────────────────────────

alter table public.tenant_invitations enable row level security;

-- Admins/owners can view invitations for their tenant
create policy "tenant_invitations_select_admin"
  on public.tenant_invitations for select
  using (
    tenant_id = public.current_tenant_id()
    and public.is_tenant_admin()
  );

-- Admins/owners can create invitations for their tenant
create policy "tenant_invitations_insert_admin"
  on public.tenant_invitations for insert
  with check (
    tenant_id = public.current_tenant_id()
    and public.is_tenant_admin()
  );

-- Admins/owners can update invitations (resend, revoke) for their tenant
create policy "tenant_invitations_update_admin"
  on public.tenant_invitations for update
  using (
    tenant_id = public.current_tenant_id()
    and public.is_tenant_admin()
  )
  with check (
    tenant_id = public.current_tenant_id()
    and public.is_tenant_admin()
  );

-- Allow the accept-invite edge function (service role) to read by token.
-- The service role bypasses RLS, so no extra policy is needed for that path.

-- Also allow anon to look up an invitation by token (for the accept page)
-- but only expose minimal fields via a function (see below).
create or replace function public.get_invitation_by_token(invite_token text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  result json;
begin
  select json_build_object(
    'id', i.id,
    'email', i.email,
    'company_name', i.company_name,
    'status', i.status,
    'tenant_name', t.name,
    'tenant_slug', t.slug,
    'expires_at', i.expires_at
  )
  into result
  from public.tenant_invitations i
  join public.tenants t on t.id = i.tenant_id
  where i.token = invite_token
  limit 1;

  return result; -- null if not found
end;
$$;

grant execute on function public.get_invitation_by_token(text) to anon;
grant execute on function public.get_invitation_by_token(text) to authenticated;

commit;
