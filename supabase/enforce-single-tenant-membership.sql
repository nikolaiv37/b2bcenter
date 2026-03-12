begin;

do $$
begin
  if exists (
    select 1
    from public.tenant_memberships
    group by user_id
    having count(*) > 1
  ) then
    raise exception 'tenant_memberships has users assigned to multiple tenants. Resolve duplicates before adding constraint.';
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'tenant_memberships_one_tenant_per_user'
  ) then
    alter table public.tenant_memberships
      add constraint tenant_memberships_one_tenant_per_user unique (user_id);
  end if;
end $$;

commit;
