-- Create categories table for admin category management

create table if not exists public.categories (
  id uuid primary key default uuid_generate_v4(),
  company_id uuid references public.companies(id) on delete cascade,
  name text not null,
  parent_id uuid references public.categories(id) on delete set null,
  image_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Indexes
create index if not exists idx_categories_company_id on public.categories(company_id);
create index if not exists idx_categories_parent_id on public.categories(parent_id);
create index if not exists idx_categories_name on public.categories(name);

-- Updated_at trigger
create trigger update_categories_updated_at
before update on public.categories
for each row
execute function public.update_updated_at_column();

-- Enable RLS
alter table public.categories enable row level security;

-- RLS Policies
-- Read-only for all authenticated users (buyers & admins)
create policy "Anyone can view categories"
  on public.categories
  for select
  using (true);

-- Only admins can insert/update/delete categories for their company
create policy "Admins can manage categories in their company"
  on public.categories
  for all
  using (
    company_id in (
      select company_id from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  )
  with check (
    company_id in (
      select company_id from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  );


