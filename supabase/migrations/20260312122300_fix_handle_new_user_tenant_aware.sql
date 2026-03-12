-- Fix: make handle_new_user trigger tenant-aware
--
-- After the tenant-data-isolation migration, profiles.tenant_id is NOT NULL
-- with a default of current_tenant_id(). But in trigger context (e.g. when
-- an admin invites a user via Supabase Auth), there is no auth session, so
-- current_tenant_id() returns NULL and the INSERT fails.
--
-- This update makes the trigger skip profile creation when there's no tenant
-- context. The invite-client edge function creates the profile explicitly
-- with the correct tenant_id.

create or replace function public.handle_new_user()
returns trigger as $$
declare
  _tenant_id uuid;
begin
  -- Resolve tenant from the authenticated session (if any)
  _tenant_id := public.current_tenant_id();

  -- If no tenant context (admin invite, service-role call), skip automatic
  -- profile creation. The calling code is responsible for creating the profile.
  if _tenant_id is null then
    return new;
  end if;

  insert into public.profiles (id, email, role, tenant_id)
  values (new.id, new.email, 'company', _tenant_id)
  on conflict (id) do nothing;

  return new;
end;
$$ language plpgsql security definer;
