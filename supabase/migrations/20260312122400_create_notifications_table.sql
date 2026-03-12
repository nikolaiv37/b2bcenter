-- Notifications table for real-time in-app notifications
-- Per-user rows with fan-out handled by RPC function

begin;

-- ============================================================
-- 1. Table
-- ============================================================
create table if not exists public.notifications (
  id          uuid default gen_random_uuid() primary key,
  tenant_id   uuid not null references public.tenants(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  actor_id    uuid references auth.users(id) on delete set null,
  type        text not null,
  entity_type text,
  entity_id   text,
  metadata    jsonb not null default '{}',
  read_at     timestamptz,
  created_at  timestamptz default now()
);

-- ============================================================
-- 2. Indexes
-- ============================================================
create index if not exists idx_notifications_user_tenant
  on public.notifications(user_id, tenant_id, created_at desc);

create index if not exists idx_notifications_unread
  on public.notifications(user_id, tenant_id) where read_at is null;

-- ============================================================
-- 3. Enable RLS
-- ============================================================
alter table public.notifications enable row level security;

-- ============================================================
-- 4. RLS Policies (strict: no INSERT policy)
-- ============================================================

-- Users can only read their own notifications
create policy "notifications_select_own"
  on public.notifications for select
  using (user_id = auth.uid());

-- Users can only update read_at on their own notifications
create policy "notifications_update_own"
  on public.notifications for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- No INSERT or DELETE policies: inserts happen only via the
-- SECURITY DEFINER RPC below; deletes are not exposed to clients.

-- ============================================================
-- 5. Realtime – enable for the notifications table
-- ============================================================
alter publication supabase_realtime add table public.notifications;

-- ============================================================
-- 6. RPC: create_notification (SECURITY DEFINER)
--    Resolves recipients and batch-inserts per-user rows.
-- ============================================================
create or replace function public.create_notification(
  p_type            text,
  p_entity_type     text default null,
  p_entity_id       text default null,
  p_metadata        jsonb default '{}',
  p_target_audience text default 'admins',      -- 'admins' | 'company' | 'all_companies' | 'user'
  p_target_company_id uuid default null,         -- required when p_target_audience = 'company'
  p_target_user_id  uuid default null            -- required when p_target_audience = 'user'
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant_id uuid;
  v_actor_id  uuid;
begin
  -- Derive tenant and actor from the authenticated session
  v_actor_id  := auth.uid();
  v_tenant_id := public.current_tenant_id();

  -- Guard: caller must belong to a tenant
  if v_tenant_id is null then
    raise exception 'No tenant context for the current user';
  end if;

  -- Insert one notification row per resolved recipient (excluding the actor)
  insert into public.notifications (tenant_id, user_id, actor_id, type, entity_type, entity_id, metadata)
  select
    v_tenant_id,
    p.id,           -- recipient user_id
    v_actor_id,
    p_type,
    p_entity_type,
    p_entity_id,
    p_metadata
  from public.profiles p
  where p.tenant_id = v_tenant_id
    and p.id != v_actor_id   -- don't notify yourself
    and (
      -- Notify all admins in the tenant
      (p_target_audience = 'admins' and p.role = 'admin')
      or
      -- Notify all users of a specific company
      (p_target_audience = 'company' and p.company_id = p_target_company_id)
      or
      -- Notify all company-role users in the tenant (e.g. catalog_updated)
      (p_target_audience = 'all_companies' and p.role = 'company')
      or
      -- Notify a single specific user (e.g. order status change -> the user who placed it)
      (p_target_audience = 'user' and p.id = p_target_user_id)
    );
end;
$$;

-- Grant execute to authenticated users only
revoke all on function public.create_notification(text, text, text, jsonb, text, uuid, uuid) from public;
revoke all on function public.create_notification(text, text, text, jsonb, text, uuid, uuid) from anon;
grant execute on function public.create_notification(text, text, text, jsonb, text, uuid, uuid) to authenticated;

commit;
