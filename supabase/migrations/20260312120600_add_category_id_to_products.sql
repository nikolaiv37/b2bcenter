-- Add category_id foreign key to products so catalog can use normalized categories

alter table public.products
  add column if not exists category_id uuid;

-- Postgres does not support "add constraint if not exists",
-- so we drop it first (if present) and then re-create it.
alter table public.products
  drop constraint if exists products_category_id_fkey;

alter table public.products
  add constraint products_category_id_fkey
  foreign key (category_id) references public.categories(id)
  on delete set null;

create index if not exists idx_products_category_id
  on public.products(category_id);
