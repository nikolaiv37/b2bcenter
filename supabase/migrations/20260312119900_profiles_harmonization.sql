-- Harmonize profiles schema with current app expectations after legacy schema.sql
alter table public.profiles add column if not exists company_name text;
alter table public.profiles add column if not exists phone text;

alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles
  add constraint profiles_role_check check (role in ('admin', 'company'));
