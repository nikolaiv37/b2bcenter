# FINAL_B2BCENTER_MIGRATION_ORDER

Generated: 2026-03-12
Scope: final reconciliation pass before any SQL execution.
Compared sources:
- `CURRENT_PLATFORM_SETUP.md`
- `B2BCENTER_BOOTSTRAP_PLAN.md`
- `docs/RUNBOOK.md` and current repo SQL/code

## Reconciliation decisions

1. The runbook references `supabase/fix-profiles-rls-final.sql` and `supabase/migrations/20260205_import_configs.sql`.
2. Current codebase is tenant-first (`tenants`, `tenant_memberships`, `tenant_domains`, tenant guards in router/auth).
3. Many `fix-*` SQL files are legacy/overlapping and are superseded by `tenant-data-isolation.sql` + platform auth migrations.
4. Fresh bootstrap should use the minimum deterministic set plus two small manual harmonization blocks.

## Verification of requested files

### `supabase/fix-profiles-rls-final.sql`
- Decision: **Do not run for fresh bootstrap**.
- Why:
- Its RLS policy set is from pre-tenant history and is superseded by `supabase/tenant-data-isolation.sql` + `supabase/platform-admin-auth-no-tenant.sql`.
- Running it wholesale increases policy churn and recursion risk in a new environment.
- Still-needed effect from history: profiles role contract for app code (`admin`/`company`). This is handled by a targeted manual SQL step below.

### `supabase/migrations/20260205_import_configs.sql`
- Decision: **Not runnable / not required**.
- Why:
- `supabase/migrations/` does not exist in this repo.
- Current runtime code does not directly query `import_configs`.

## Final required execution order (fresh Supabase project)

Run in this exact order.

1. `supabase/schema.sql`  
Reason: base tables/functions/triggers.

2. Manual harmonization block (required; run in SQL editor):
```sql
-- App code writes these profile fields, but no repo migration adds them from schema.sql baseline.
alter table public.profiles add column if not exists company_name text;
alter table public.profiles add column if not exists phone text;

-- App runtime uses roles 'admin' | 'company'.
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles
  add constraint profiles_role_check check (role in ('admin', 'company'));
```
Reason: aligns baseline schema with current app write paths.

3. `supabase/add-company-onboarding-fields.sql`  
Reason: onboarding fields + company onboarding completion semantics.

4. `supabase/add-company-invoice-fields.sql`  
Reason: settings/invoice fields used by UI.

5. `supabase/add-commission-rate-to-profiles.sql`  
Reason: commission features query/update `profiles.commission_rate`.

6. `supabase/migration-update-products-table-safe.sql`  
Reason: aligns `products` columns used by import/catalog code.

7. `supabase/create-categories-table.sql`  
Reason: category browse/manage and import mapping depend on it.

8. `supabase/add-category-slug-and-unique-constraint.sql`  
Reason: slug routes and uniqueness behavior.

9. `supabase/add-category-id-to-products.sql`  
Reason: normalized category linkage (`products.category_id`).

10. `supabase/optimize-category-indexes.sql`  
Reason: production-safe index coverage for category pages.

11. Reconcile quotes table shape (required manual SQL):
```sql
drop table if exists public.quotes cascade;
```
Reason: `schema.sql` quote shape is legacy and not compatible with current app fields.

12. `supabase/create-quotes-table.sql`  
Reason: current orders/quotes UI expects this table contract.

13. `supabase/add-order-number-column.sql`  
Reason: app displays and depends on `quotes.order_number`.

14. `supabase/add-shipping-method-column.sql`  
Reason: app writes/reads `quotes.shipping_method`.

15. `supabase/add-quotes-internal-notes.sql`  
Reason: admin order notes UI expects `quotes.internal_notes`.

16. `supabase/create-complaints-table.sql`  
Reason: complaints module + photo flow.

17. `supabase/add-complaints-internal-notes.sql`  
Reason: admin complaints notes UI expects this column.

18. `supabase/create-wishlist-table.sql`  
Reason: wishlist module runtime dependency.

19. `supabase/create-tenants-and-domains.sql`  
Reason: tenant core tables (`tenants`, `tenant_domains`, `tenant_memberships`).

20. `supabase/tenant-data-isolation.sql`  
Reason: tenant-scoped columns/defaults/RLS used throughout app/guards.

21. `supabase/add-client-invitations.sql`  
Reason: invite/accept flow depends on `tenant_invitations` and RPC.

22. `supabase/add-target-role-to-invitations.sql`  
Reason: invite role branching (`admin` vs `company`).

23. `supabase/lookup-tenant-by-email.sql`  
Reason: platform login pre-auth workspace lookup.

24. `supabase/platform-admin-and-tenant-status.sql`  
Reason: `is_platform_admin`, owner linkage, platform-console policies.

25. `supabase/platform-admin-auth-no-tenant.sql`  
Reason: platform admin auth checks without tenant membership.

26. `supabase/fix-handle-new-user-tenant-aware.sql`  
Reason: prevents trigger failures after tenant non-null constraints.

27. `supabase/create-notifications-table.sql`  
Reason: notification bell/runtime notification RPCs.

28. `supabase/create-logos-storage-bucket.sql`  
Reason: company logo uploads.

29. Ensure complaints bucket policies from `supabase/create-complaints-table.sql` are applied.  
Reason: complaints photo uploads.

30. Manual create missing `category-images` bucket (required by code):
```sql
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
```

## Optional files (safe but not required for first boot)

- `supabase/create-csv-import-mappings.sql`  
Reason: CSV analytics/synonym infra; core import path can boot without it.

- `supabase/create-econt-integrations-and-shipments.sql`  
Reason: shipping integrations module only.

- `supabase/update-order-status-workflow.sql`  
Reason: useful for migrating legacy data; fresh DB usually has no rows.

- `supabase/sample-data.sql`, `supabase/seed-tenants.sql`  
Reason: test/demo seeding only.

## Files that should NOT be run for fresh bootstrap

- `supabase/fix-profiles-rls-final.sql`  
Reason: superseded by tenant/platform policy stack; avoid policy churn.

- `supabase/fix-profiles-rls-simple.sql`
- `supabase/fix-profiles-rls-recursion.sql`
- `supabase/fix-profiles-rls-complete.sql`
- `supabase/fix-distributor-rls-recursion.sql`  
Reason: same superseded pre-tenant RLS-fix lineage.

- `supabase/fix-companies-insert-policy.sql`
- `supabase/fix-companies-insert-policy-alternative.sql`
- `supabase/fix-companies-update-policy.sql`
- `supabase/fix-companies-update-policy-final.sql`  
Reason: superseded by tenant-data-isolation policy rebuild.

- `supabase/fix-quotes-rls-policy.sql`
- `supabase/add-quotes-admin-rls.sql`  
Reason: redundant once tenant-data-isolation policies are in place.

- `supabase/fix-complaints-rls-policies.sql`
- `supabase/add-complaints-admin-rls.sql`  
Reason: redundant once tenant-data-isolation policies are in place.

- `supabase/fix-wishlist-rls-policies.sql`
- `supabase/fix-wishlist-foreign-key.sql`  
Reason: create table script already compatible for fresh DB; tenant-data-isolation replaces policies.

- `supabase/fix-complaints-foreign-key.sql`
- `supabase/add-complaints-internal-notes-fix.sql`
- `supabase/add-complaints-internal-notes-fix 2.sql`  
Reason: repair scripts for drifted/legacy states.

- `supabase/add-tenant-id-to-profiles.sql`  
Reason: covered by `tenant-data-isolation.sql`.

- `supabase/migration-update-products-table.sql`  
Reason: older non-safe variant; use `migration-update-products-table-safe.sql`.

- `supabase/fix-supplier-id-type.sql`
- `supabase/fix-supplier-id-constraint.sql`  
Reason: legacy alignment helpers not needed in fresh sequence.

- `supabase/enforce-single-tenant-membership.sql`  
Reason: `create-tenants-and-domains.sql` already enforces `unique(user_id)`.

- `supabase/check-profiles-structure.sql`  
Reason: diagnostic only.

- `supabase/cleanup-orphaned-companies.sql`  
Reason: destructive cleanup utility, not bootstrap.

- `supabase/migrations/20260205_import_configs.sql`  
Reason: file does not exist in repo.

## Are tenant/membership/platform tables required for current code to boot?

- **Yes** for functional boot into workspace/dashboard paths.
- App startup and guards query `tenants`, `tenant_domains`, `tenant_memberships`.
- Platform login flow requires tenant lookup RPC and platform-admin profile fields.

## Must first tenant + owner membership be created manually?

- **Yes** (or via the app's invitation flow after initial platform setup).
- For predictable local testing, seed one tenant and one owner membership directly after migrations.
- Use `FIRST_TENANT_BOOTSTRAP.sql` for this step.

## Exact post-migration validation checklist

Run these checks after migrations and first-tenant seed.

1. Core tables exist:
```sql
select table_name
from information_schema.tables
where table_schema = 'public'
  and table_name in (
    'profiles','companies','products','categories','quotes','complaints','wishlist_items',
    'tenants','tenant_domains','tenant_memberships','tenant_invitations','notifications'
  )
order by table_name;
```

2. Required columns exist:
```sql
select table_name, column_name
from information_schema.columns
where table_schema = 'public'
  and (
    (table_name = 'profiles' and column_name in ('tenant_id','company_name','phone','commission_rate','invitation_status','is_platform_admin')) or
    (table_name = 'quotes' and column_name in ('tenant_id','order_number','shipping_method','internal_notes','user_id')) or
    (table_name = 'products' and column_name in ('tenant_id','supplier_id','category_id'))
  )
order by table_name, column_name;
```

3. Profile role constraint is correct:
```sql
select conname, pg_get_constraintdef(oid)
from pg_constraint
where conrelid = 'public.profiles'::regclass
  and conname = 'profiles_role_check';
```

4. Key functions exist:
```sql
select routine_name
from information_schema.routines
where routine_schema = 'public'
  and routine_name in (
    'current_tenant_id','is_tenant_admin','is_platform_admin',
    'lookup_tenant_by_email','get_invitation_by_token','create_notification'
  )
order by routine_name;
```

5. Bucket existence:
```sql
select id, public
from storage.buckets
where id in ('logos','complaints','category-images')
order by id;
```

6. First tenant state exists:
```sql
select t.id, t.slug, t.owner_user_id, m.user_id, m.role
from public.tenants t
left join public.tenant_memberships m on m.tenant_id = t.id
order by t.created_at desc;
```

7. App smoke check:
- Login with seeded owner user.
- Open `/t/<slug>/dashboard`.
- Verify products/categories/orders/complaints/wishlist pages load without relation/column errors.
