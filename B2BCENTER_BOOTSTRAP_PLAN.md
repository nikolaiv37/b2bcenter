# B2BCENTER_BOOTSTRAP_PLAN

Generated: 2026-03-12
Goal: bootstrap `b2bcenter` as a standalone project without feature cuts yet.

## 1) Exact local setup steps

1. Confirm Node and npm:
```bash
node -v
npm -v
```
2. Install dependencies:
```bash
cd /Users/nikolaiv37/projects/b2bcenter
npm install
```
3. Prepare `.env` (keys found in code):
```env
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_STRIPE_PUBLISHABLE_KEY=
VITE_RESEND_API_KEY=
VITE_POSTHOG_KEY=
VITE_POSTHOG_HOST=https://app.posthog.com
VITE_DEV_MODE=false
```
4. Verify build:
```bash
npm run build
```
5. Run dev server:
```bash
npm run dev
```
6. Optional quality checks:
```bash
npm run lint
```

## 2) Exact Supabase bootstrap order

Run SQL in this sequence (Supabase SQL Editor), from repo root paths:

1. `supabase/schema.sql`
2. `supabase/add-company-onboarding-fields.sql`
3. `supabase/add-company-invoice-fields.sql`
4. `supabase/add-commission-rate-to-profiles.sql`
5. `supabase/migration-update-products-table-safe.sql`
6. `supabase/create-categories-table.sql`
7. `supabase/add-category-id-to-products.sql`
8. `supabase/add-category-slug-and-unique-constraint.sql`
9. `supabase/optimize-category-indexes.sql`
10. Reconcile quotes table to current app contract:
```sql
DROP TABLE IF EXISTS public.quotes CASCADE;
```
11. `supabase/create-quotes-table.sql`
12. `supabase/add-order-number-column.sql`
13. `supabase/add-shipping-method-column.sql`
14. `supabase/add-quotes-internal-notes.sql`
15. `supabase/add-quotes-admin-rls.sql`
16. `supabase/update-order-status-workflow.sql`
17. `supabase/create-complaints-table.sql`
18. `supabase/fix-complaints-foreign-key.sql`
19. `supabase/add-complaints-internal-notes.sql`
20. `supabase/add-complaints-admin-rls.sql`
21. `supabase/create-wishlist-table.sql`
22. `supabase/fix-wishlist-foreign-key.sql`
23. `supabase/fix-wishlist-rls-policies.sql`
24. `supabase/create-tenants-and-domains.sql`
25. `supabase/tenant-data-isolation.sql`
26. `supabase/add-client-invitations.sql`
27. `supabase/add-target-role-to-invitations.sql`
28. `supabase/lookup-tenant-by-email.sql`
29. `supabase/platform-admin-and-tenant-status.sql`
30. `supabase/platform-admin-auth-no-tenant.sql`
31. `supabase/fix-handle-new-user-tenant-aware.sql`
32. `supabase/create-notifications-table.sql`
33. Optional: `supabase/create-csv-import-mappings.sql`
34. Optional: `supabase/create-econt-integrations-and-shipments.sql`

## 3) Exact storage bucket setup

### A. Buckets from repo SQL
1. Run `supabase/create-logos-storage-bucket.sql`.
2. Ensure `complaints` bucket/policies from `supabase/create-complaints-table.sql` are applied.

### B. Missing in repo but required by code (`category-images`)
Run manually:
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

## 4) Exact smoke test checklist

1. App boots locally (`npm run dev`) and root route renders.
2. Sign up and sign in works.
3. Tenant bootstrap exists (tenant row + membership) and user can reach `/t/<slug>/dashboard`.
4. Onboarding creates/updates company and links profile `company_id`.
5. Product list loads from `products`.
6. Category browse and category manage pages load.
7. Category image upload works (`category-images` bucket).
8. Company logo upload works (`logos` bucket).
9. Create order/quote from cart inserts into `quotes` with `order_number` and `shipping_method`.
10. Orders page loads and admin order status updates persist.
11. Complaint submission with photo upload works (`complaints` bucket).
12. Wishlist add/remove works.
13. Client invite + accept-invite flow works end-to-end.
14. Platform login route works only for platform-admin accounts.

## 5) Recommended "do not cut yet" modules

- Tenant resolution + membership guards (`TenantProvider`, guards, `/t/:slug` route pathing)
- Auth bootstrap + onboarding (`useAuth`, `AuthGuard`, auth pages)
- Company/profile linkage (`companies`, `profiles`, onboarding/settings)
- Catalog core (`products`, `categories`, query hooks)
- Order/quote workflow (`quotes`, orders pages, status mapping)
- Complaints workflow (`complaints` + storage)
- Client management/invites (`tenant_invitations`, accept-invite, membership creation)

## 6) Recommended "safe to cut later" modules

- Platform console UX if single-tenant operations are preferred (`/platform/*`, create/delete tenant flows)
- Custom-domain + multi-host routing complexity (`tenant_domains`, canonical redirects)
- Econt shipment/integration feature set (tables + edge functions)
- Frontend PostHog wiring (can be disabled with env)
- Frontend Resend direct-call path (replace with server-side mail flow later)
- Stripe checkout placeholder API path (`/api/create-checkout-session`) until backend is finalized
- Legacy/overlapping SQL fix files after schema consolidation

## 7) Repo-init note for standalone

`/Users/nikolaiv37/projects/b2bcenter/.git` is currently copied from the source project.
Do not remove it until explicitly confirmed by you.
After confirmation, remove `.git` in `b2bcenter` and initialize a fresh repository for the new GitHub remote.
