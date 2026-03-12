begin;

alter table public.profiles
  add column if not exists tenant_id uuid references public.tenants(id);

update public.profiles p
set tenant_id = m.tenant_id
from public.tenant_memberships m
where p.id = m.user_id
  and p.tenant_id is null;

create index if not exists idx_profiles_tenant_id on public.profiles(tenant_id);

commit;
