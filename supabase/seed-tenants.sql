begin;

insert into public.tenants (name, slug, status, branding)
values
  ('Hotfarms', 'hotfarms', 'active', '{}'::jsonb),
  ('Evromar', 'evromar', 'active', '{}'::jsonb)
on conflict (slug) do update
set
  name = excluded.name,
  status = excluded.status,
  branding = excluded.branding,
  updated_at = now();

update public.tenant_domains
set
  is_primary = false,
  updated_at = now()
where tenant_id in (
  select id
  from public.tenants
  where slug in ('hotfarms', 'evromar')
)
and domain not in ('hotfarms.local', 'evromar.local');

insert into public.tenant_domains (tenant_id, domain, verified, is_primary)
select t.id, d.domain, true, true
from public.tenants t
join (
  values
    ('hotfarms', 'hotfarms.local'),
    ('evromar', 'evromar.local')
) as d(slug, domain)
  on d.slug = t.slug
on conflict (domain) do update
set
  tenant_id = excluded.tenant_id,
  verified = true,
  is_primary = true,
  updated_at = now();

insert into public.tenant_memberships (user_id, tenant_id, role)
select m.user_id, t.id, m.role
from public.tenants t
join (
  values
    ('hotfarms', '4b6d9717-f9ea-4670-8adf-cfc00490ace3', 'owner'),
    ('hotfarms', '55d894bb-e72e-4d22-aa85-7fbec3a16c64', 'member'),
    ('evromar', 'fbdb49c2-5fe9-4bb4-b830-9c19646f6416', 'member')
) as m(slug, user_id, role)
  on m.slug = t.slug
on conflict (user_id, tenant_id) do update
set
  role = excluded.role;

commit;
