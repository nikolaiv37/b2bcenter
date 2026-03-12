# CURRENT_PLATFORM_SETUP

Generated: 2026-03-12
Scanned source of truth: `src/`, `supabase/`, `package.json`, `README.md`, `docs/` (docs treated as secondary when conflicting with code).

## 1) Environment variables read in code

### Frontend / Vite (app runtime)
- `VITE_SUPABASE_URL` (`src/lib/supabase/client.ts`, complaints/orders dev links)
- `VITE_SUPABASE_ANON_KEY` (`src/lib/supabase/client.ts`)
- `VITE_STRIPE_PUBLISHABLE_KEY` (`src/lib/stripeClient.ts`)
- `VITE_RESEND_API_KEY` (`src/lib/resendClient.ts`)
- `VITE_POSTHOG_KEY` (`src/lib/analytics.ts`)
- `VITE_POSTHOG_HOST` (`src/lib/analytics.ts`)
- `VITE_DEV_MODE` (`useCSVImport`, `QuoteRequestModal`, orders/complaints modules)

### Build/runtime flags
- `ANALYZE` (`vite.config.ts`)
- `NODE_ENV` (`src/App.tsx`, `src/components/ErrorFallback.tsx`)
- `DEV` (Vite built-in, used in tenant constants + i18n debug)

### Supabase Edge Functions (`supabase/functions/*`)
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `APP_SITE_URL` (invite redirect base)
- `SITE_URL` (fallback invite redirect base)
- `ECONT_CREDENTIALS_ENCRYPTION_KEY`

## 2) Supabase SQL files relevant for fresh bootstrap

### Core schema and core feature tables
- `supabase/schema.sql`
- `supabase/migration-update-products-table-safe.sql`
- `supabase/create-categories-table.sql`
- `supabase/add-category-id-to-products.sql`
- `supabase/add-category-slug-and-unique-constraint.sql`
- `supabase/optimize-category-indexes.sql`
- `supabase/create-quotes-table.sql`
- `supabase/add-order-number-column.sql`
- `supabase/add-shipping-method-column.sql`
- `supabase/add-quotes-internal-notes.sql`
- `supabase/add-quotes-admin-rls.sql`
- `supabase/update-order-status-workflow.sql`
- `supabase/create-complaints-table.sql`
- `supabase/fix-complaints-foreign-key.sql`
- `supabase/add-complaints-internal-notes.sql`
- `supabase/add-complaints-admin-rls.sql`
- `supabase/create-wishlist-table.sql`
- `supabase/fix-wishlist-foreign-key.sql`
- `supabase/fix-wishlist-rls-policies.sql`
- `supabase/add-company-onboarding-fields.sql`
- `supabase/add-company-invoice-fields.sql`
- `supabase/add-commission-rate-to-profiles.sql`

### Multi-tenant + platform/invite system
- `supabase/create-tenants-and-domains.sql`
- `supabase/tenant-data-isolation.sql`
- `supabase/add-client-invitations.sql`
- `supabase/add-target-role-to-invitations.sql`
- `supabase/lookup-tenant-by-email.sql`
- `supabase/platform-admin-and-tenant-status.sql`
- `supabase/platform-admin-auth-no-tenant.sql`
- `supabase/fix-handle-new-user-tenant-aware.sql`

### Extra but currently referenced features
- `supabase/create-notifications-table.sql`
- `supabase/create-csv-import-mappings.sql`
- `supabase/create-econt-integrations-and-shipments.sql`

### Storage setup SQL in repo
- `supabase/create-logos-storage-bucket.sql`
- `supabase/create-complaints-table.sql` (contains complaints bucket SQL/policies)

## 3) Recommended migration order (code-driven)

1. `supabase/schema.sql`
2. `supabase/add-company-onboarding-fields.sql`
3. `supabase/add-company-invoice-fields.sql`
4. `supabase/add-commission-rate-to-profiles.sql`
5. `supabase/migration-update-products-table-safe.sql`
6. `supabase/create-categories-table.sql`
7. `supabase/add-category-id-to-products.sql`
8. `supabase/add-category-slug-and-unique-constraint.sql`
9. `supabase/optimize-category-indexes.sql`
10. Quotes path: drop/recreate to match current app contract, then apply quote add-ons
- `DROP TABLE IF EXISTS public.quotes CASCADE;`
- `supabase/create-quotes-table.sql`
- `supabase/add-order-number-column.sql`
- `supabase/add-shipping-method-column.sql`
- `supabase/add-quotes-internal-notes.sql`
- `supabase/add-quotes-admin-rls.sql`
- `supabase/update-order-status-workflow.sql`
11. `supabase/create-complaints-table.sql`
12. `supabase/fix-complaints-foreign-key.sql`
13. `supabase/add-complaints-internal-notes.sql`
14. `supabase/add-complaints-admin-rls.sql`
15. `supabase/create-wishlist-table.sql`
16. `supabase/fix-wishlist-foreign-key.sql`
17. `supabase/fix-wishlist-rls-policies.sql`
18. `supabase/create-tenants-and-domains.sql`
19. `supabase/tenant-data-isolation.sql`
20. `supabase/add-client-invitations.sql`
21. `supabase/add-target-role-to-invitations.sql`
22. `supabase/lookup-tenant-by-email.sql`
23. `supabase/platform-admin-and-tenant-status.sql`
24. `supabase/platform-admin-auth-no-tenant.sql`
25. `supabase/fix-handle-new-user-tenant-aware.sql`
26. `supabase/create-notifications-table.sql`
27. Optional: `supabase/create-csv-import-mappings.sql`
28. Optional: `supabase/create-econt-integrations-and-shipments.sql`
29. Storage bucket SQL (`logos`, `complaints`) + manual `category-images` bucket (not present in repo SQL)

## 4) Storage buckets referenced in code

### Directly referenced in frontend code
- `logos` (`src/components/CompanyForm.tsx`)
- `complaints` (`src/app/dashboard/complaints/NewComplaintTab.tsx`)
- `category-images` (`src/app/dashboard/categories/manage.tsx`)

### Bucket SQL found in repo
- `logos` (explicit SQL file)
- `complaints` (inside complaints SQL)
- `category-images`: no bucket creation/policy SQL found in `supabase/*.sql`

## 5) Routes / pages

### Router paths in `src/App.tsx`
- `/`
- `/landing`
- `/auth/login`
- `/auth/signup`
- `/auth/onboarding`
- `/auth/accept-invite`
- `/auth/client-setup`
- `/auth/owner-setup`
- `/platform/tenants`
- `/platform/tenants/:id`
- `/dashboard`
- `/dashboard/categories`
- `/dashboard/categories/:mainCategory`
- `/dashboard/categories/:mainCategory/:subCategory`
- `/dashboard/categories/manage`
- `/dashboard/products`
- `/dashboard/products/:sku`
- `/dashboard/wishlist`
- `/dashboard/orders`
- `/dashboard/complaints`
- `/dashboard/quotes`
- `/dashboard/csv-import`
- `/dashboard/settings`
- `/dashboard/analytics`
- `/dashboard/unpaid-balances`
- `/dashboard/clients`
- `/t/:slug` (with nested tenant auth/dashboard equivalents)
- `*` (fallback)

### Page/component route modules present
- `src/app/auth/*`
- `src/app/dashboard/*`
- `src/app/platform/*`
- `src/pages/*` (`LandingPage`, `MainIndexRoute`, `TenantEntry`, `TenantSelector`, `NoAccessPortal`, `NoTenantState`, `PortalNotFound`, `TenantInactive`, `NotFound`)

## 6) Direct references to requested tables

### `profiles`
Runtime direct Supabase calls:
- `supabase/functions/accept-invite/index.ts`
- `supabase/functions/create-tenant/index.ts`
- `supabase/functions/invite-client/index.ts`
- `supabase/functions/delete-tenant/index.ts`
- `src/components/guards/PlatformAdminGuard.tsx`
- `src/hooks/useAuth.ts`
- `src/hooks/useMutationClient.ts`
- `src/hooks/useMutationDistributor.ts`
- `src/hooks/useQueryClients.ts`
- `src/hooks/useQueryDistributors.ts`
- `src/hooks/useQueryTeamMembers.ts`
- `src/components/OrderDetailsSheet.tsx`
- `src/app/auth/onboarding.tsx`
- `src/app/auth/client-setup.tsx`
- `src/app/auth/owner-setup.tsx`
- `src/app/auth/platform-login.tsx`
- `src/app/dashboard/orders/index.tsx`
- `src/app/dashboard/orders/AdminOrdersView.tsx`
- `src/app/dashboard/complaints/AdminComplaintsView.tsx`
SQL files mentioning `profiles`: multiple (`schema.sql`, tenant/platform migrations, RLS fix files, invitation/onboarding files).

### `companies`
Runtime direct Supabase calls:
- `src/hooks/useAuth.ts`
- `src/components/AuthGuard.tsx`
- `src/components/OrderDetailsSheet.tsx`
- `src/app/auth/onboarding.tsx`
- `src/app/dashboard/orders/index.tsx`
- `src/app/dashboard/settings/index.tsx`
- `src/app/dashboard/complaints/AdminComplaintsView.tsx`
SQL files mentioning `companies`: `schema.sql`, `add-company-onboarding-fields.sql`, `add-company-invoice-fields.sql`, `tenant-data-isolation.sql`, and related policy/fix files.

### `products`
Runtime direct Supabase calls:
- `src/hooks/useQueryProducts.ts`
- `src/hooks/useCSVImport.ts`
- `src/components/csv-import/CSVImportWizard.tsx`
- `src/components/csv-import/steps/CategoryMappingStep.tsx`
- `src/lib/category-migration.ts`
- `src/lib/category-sync-from-import.ts`
- `src/app/dashboard/products/index.tsx`
- `src/app/dashboard/categories/index.tsx`
- `src/app/dashboard/categories/manage.tsx`
- `src/app/dashboard/overview.tsx`
- `src/app/dashboard/layout.tsx`
- `src/app/dashboard/wishlist/index.tsx`
- `src/app/dashboard/analytics/index.tsx`
- `src/app/platform/tenants/[id]/index.tsx`
- `supabase/functions/delete-tenant/index.ts`
SQL files mentioning `products`: `schema.sql`, both products migration files, category/product linkage files, tenant isolation, index/constraint files.

### `categories`
Runtime direct Supabase calls:
- `src/hooks/useCategoryHierarchy.ts`
- `src/lib/category-migration.ts`
- `src/lib/category-sync-from-import.ts`
- `src/app/dashboard/categories/manage.tsx`
- `src/app/dashboard/products/index.tsx`
- `src/components/csv-import/CSVImportWizard.tsx`
- `src/app/platform/tenants/[id]/index.tsx`
SQL files mentioning `categories`: `create-categories-table.sql`, `add-category-slug-and-unique-constraint.sql`, `add-category-id-to-products.sql`, `tenant-data-isolation.sql`, `platform-admin-and-tenant-status.sql`, `optimize-category-indexes.sql`.

### `quotes`
Runtime direct Supabase calls:
- `src/hooks/useMutationQuote.ts`
- `src/hooks/useUnpaidBalance.ts`
- `src/hooks/useQueryClients.ts`
- `src/hooks/useCompanyUnpaidBalances.ts`
- `src/components/QuoteRequestModal.tsx`
- `src/app/dashboard/quotes/index.tsx`
- `src/app/dashboard/orders/index.tsx`
- `src/app/dashboard/orders/AdminOrdersView.tsx`
- `src/app/dashboard/overview.tsx`
- `src/app/dashboard/layout.tsx`
- `src/app/dashboard/analytics/index.tsx`
- `src/app/dashboard/complaints/NewComplaintTab.tsx`
- `src/app/dashboard/complaints/MyComplaintsTab.tsx`
- `src/app/dashboard/complaints/AdminComplaintsView.tsx`
SQL files mentioning `quotes`: `create-quotes-table.sql`, `add-order-number-column.sql`, `add-shipping-method-column.sql`, `add-quotes-internal-notes.sql`, `add-quotes-admin-rls.sql`, `update-order-status-workflow.sql`, `tenant-data-isolation.sql`, `schema.sql`.

### `complaints`
Runtime direct Supabase calls:
- `src/app/dashboard/complaints/NewComplaintTab.tsx`
- `src/app/dashboard/complaints/MyComplaintsTab.tsx`
- `src/app/dashboard/complaints/AdminComplaintsView.tsx`
SQL files mentioning `complaints`: `create-complaints-table.sql` + complaints fix/admin/internal-notes files + `tenant-data-isolation.sql`.

### `wishlist_items`
Runtime direct Supabase calls:
- `src/hooks/useWishlist.ts`
SQL files mentioning `wishlist_items`: `create-wishlist-table.sql`, `fix-wishlist-foreign-key.sql`, `fix-wishlist-rls-policies.sql`, `tenant-data-isolation.sql`.

### `import_configs`
Runtime direct Supabase calls:
- None found in current `src/` and `supabase/functions/` code.
Code/docs mismatch:
- Docs mention `import_configs` and a migration path `supabase/migrations/20260205_import_configs.sql`, but `supabase/migrations/` does not exist in this repo.

## 7) Auth flow summary

1. `TenantProvider` resolves host/path into `{domainKind, tenant, membership}` using `tenants`, `tenant_domains`, `tenant_memberships`.
2. Root route dispatches:
- marketing host -> landing page
- app host (no tenant) -> workspace selector/login flow
- tenant host or `/t/:slug` -> tenant entry/dashboard
3. `useAuth` listens to `supabase.auth.onAuthStateChange`, loads/creates tenant-scoped `profiles`, then loads linked `companies`.
4. `AuthGuard` protects dashboard routes; redirects to onboarding when company/profile linkage is incomplete.
5. Invite flow:
- Email links hit `/auth/accept-invite`
- edge function `accept-invite` validates token + email, upserts `profiles`, creates `tenant_memberships`.
6. Platform admin flow:
- `/platform/*` guarded by `profiles.is_platform_admin`
- platform login uses `lookup_tenant_by_email` pre-auth and routes either to `/platform/tenants` or tenant dashboard.

## 8) Known risky areas for fresh clone bootstrapping

- `schema.sql` is legacy and conflicts with current app expectations for `quotes` (shape mismatch).
- SQL history is fragmented (many overlapping `fix-*` scripts); policy conflicts are likely if run blindly.
- `category-images` storage bucket is used in app but missing SQL bootstrap file.
- `import_configs` is referenced in docs but no runtime usage and missing migration file in repo.
- `delete-tenant` edge function references `client_invitations`, which has no corresponding SQL in this repo.
- Tenant bootstrap is mandatory for dashboard access; no tenant + no membership means blocked flows.
- Host constants still point to `centivon` domains (`centivon.com`, `centivon.vercel.app`, local centivon hosts).

## 9) Shared multitenant assumptions still in code

- Domain-aware tenant resolution (`marketing` vs `app` vs `tenant`).
- `/t/:slug` routing plus custom-domain tenant resolution via `tenant_domains`.
- RLS and queries depend on `tenant_id` across core tables.
- Membership-gated dashboard (`tenant_memberships`, `MembershipGuard`).
- Platform console (`/platform/*`) and platform admin role (`profiles.is_platform_admin`).
- Edge functions for tenant lifecycle (`create-tenant`, `delete-tenant`, `invite-client`, `accept-invite`).

## 10) Likely breakpoints in a fresh standalone project

- Missing first tenant + owner membership will prevent dashboard access.
- Missing quote/table migration alignment leads to runtime select/insert errors in orders/quotes screens.
- Missing storage buckets/policies breaks logo/category/complaint uploads.
- Missing edge-function env vars (`SUPABASE_*`, `APP_SITE_URL`) breaks invites.
- If app/domain constants are not re-pointed from `centivon`, domain guards may route incorrectly.
