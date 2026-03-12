-- Confirm owner auth users after bootstrap to allow immediate password login.
-- Safe to rerun.

begin;

do $$
begin
  update auth.users u
  set email_confirmed_at = coalesce(u.email_confirmed_at, now()),
      updated_at = now()
  where u.id in (
    select tm.user_id
    from public.tenant_memberships tm
    where tm.role = 'owner'
  )
    and u.email_confirmed_at is null;
end $$;

commit;
