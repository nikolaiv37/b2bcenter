-- Required by src/app/dashboard/categories/manage.tsx
insert into storage.buckets (id, name, public)
values ('category-images', 'category-images', true)
on conflict (id) do nothing;

create policy "Users can upload category images"
on storage.objects for insert
to authenticated
with check (bucket_id = 'category-images');

create policy "Anyone can view category images"
on storage.objects for select
using (bucket_id = 'category-images');

create policy "Users can update category images"
on storage.objects for update
to authenticated
using (bucket_id = 'category-images')
with check (bucket_id = 'category-images');

create policy "Users can delete category images"
on storage.objects for delete
to authenticated
using (bucket_id = 'category-images');
