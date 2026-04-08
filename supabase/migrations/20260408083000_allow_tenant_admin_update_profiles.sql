begin;

drop policy if exists "tenant_profiles_update_admin" on public.profiles;

create policy "tenant_profiles_update_admin"
  on public.profiles
  for update
  using (
    tenant_id = public.current_tenant_id()
    and public.is_tenant_admin()
  )
  with check (
    tenant_id = public.current_tenant_id()
    and public.is_tenant_admin()
  );

commit;
