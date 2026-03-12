-- lookup_tenant_by_email(email) → { slug, name } | null
--
-- Pre-auth lookup: given an email address, returns the tenant slug and name
-- if the user has a membership, or null otherwise.
--
-- Security considerations:
--   • SECURITY DEFINER so it can join auth.users ↔ tenant_memberships ↔ tenants
--   • Returns only slug + name — no IDs, no role, no user existence confirmation
--   • Callable by anon (needed before sign-in)
--   • For rate limiting, pair with an Edge Function or API gateway in production

create or replace function public.lookup_tenant_by_email(lookup_email text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  result json;
begin
  select json_build_object('slug', t.slug, 'name', t.name)
  into result
  from auth.users u
  join public.tenant_memberships tm on tm.user_id = u.id
  join public.tenants t on t.id = tm.tenant_id
  where u.email = lower(trim(lookup_email))
  limit 1;

  return result; -- null when no match
end;
$$;

-- Allow pre-auth (anon) and authenticated callers
grant execute on function public.lookup_tenant_by_email(text) to anon;
grant execute on function public.lookup_tenant_by_email(text) to authenticated;
