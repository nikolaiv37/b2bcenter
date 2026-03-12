# B2BCENTER_BOOTSTRAP_PLAN

## 1) Local setup
1. `npm install`
2. Create `.env` with:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - optional: `VITE_DEV_MODE`, `VITE_POSTHOG_*`, `VITE_STRIPE_PUBLISHABLE_KEY`, `VITE_RESEND_API_KEY`
3. `npm run dev`
4. `npm run build` (must pass before deploy)

## 2) Supabase bootstrap order
Use `supabase/migrations` in timestamp order.

Key requirement:
- Before running `20260312122700_first_tenant_bootstrap_auto.sql`, ensure at least one `auth.users` row exists.

Latest critical migrations:
- `20260312122900_create_econt_integrations_and_shipments.sql`
- `20260312123000_single_tenant_soft_cut.sql`

## 3) Storage setup
Buckets required by current app:
- `complaints`
- `logos`
- `category-images`

They are created by migrations and should exist after DB bootstrap.

## 4) Smoke test checklist
1. Login works on `/auth/login`.
2. Redirect lands on `/dashboard`.
3. `/platform/*` and `/t/:slug/*` are not used.
4. Product list and category pages load.
5. Quote/order creation works.
6. Complaints upload flow works.
7. Wishlist works.
8. CSV import wizard reaches final step and upserts data.
9. Econt settings page loads and can read/write settings.

## 5) Do not cut yet
- `useAuth`, `TenantProvider`, `MembershipGuard`, onboarding/auth flow
- Orders/quotes pipeline
- CSV/XML import + category sync
- Econt integration (`tenant_integrations`, `shipments`, edge functions)

## 6) Safe to cut later
- Remaining platform-admin DB flags/policies if no operational dependency remains
- Legacy root SQL duplicates in `supabase/*.sql` (keep migration versions as source of truth)
- Extra tenant-domain display metadata not needed in UI

## 7) Current architecture stance
- Frontend is now routed as single-tenant (`/dashboard` only workspace entry).
- DB is soft-cut single-tenant (tenant schema kept, one tenant enforced).
- This preserves behavior and integration safety while reducing multitenant surface.
