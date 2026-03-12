# CURRENT_PLATFORM_SETUP

Snapshot after the single-tenant cut for `b2bcenter`.

## 1) Runtime model
- Frontend: React + Vite SPA
- Workspace entry: `/dashboard` only
- Removed route surfaces:
  - `/platform/*`
  - `/t/:slug/*`
- Auth: Supabase email/password + onboarding/invite flows

## 2) Environment variables used in code
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_DEV_MODE`
- `VITE_STRIPE_PUBLISHABLE_KEY` (optional)
- `VITE_RESEND_API_KEY` (optional)
- `VITE_POSTHOG_KEY` (optional)
- `VITE_POSTHOG_HOST` (optional)

## 3) Supabase SQL source of truth
- Primary source: `supabase/migrations/*`
- Latest migration chain includes:
  - `20260312122900_create_econt_integrations_and_shipments.sql`
  - `20260312123000_single_tenant_soft_cut.sql`

## 4) Tenant model status
- Tenant tables are still present (`tenants`, `tenant_memberships`, `tenant_domains`).
- App still resolves membership for dashboard guards.
- DB now enforces one tenant ID in soft-cut mode (migration 23000).

## 5) Storage buckets
- `complaints`
- `logos`
- `category-images`

## 6) Core tables directly referenced by current app
- `profiles`
- `companies`
- `products`
- `categories`
- `quotes`
- `complaints`
- `wishlist_items`
- `tenant_invitations`
- `notifications`
- `tenant_integrations` (Econt)
- `shipments` (Econt)

## 7) Auth flow summary
1. `/auth/login` (email/password)
2. `AuthGuard` + `MembershipGuard`
3. Onboarding (`/auth/onboarding`) links profile/company
4. Redirect to `/dashboard`

## 8) Known bootstrap risks
- `20260312122700_first_tenant_bootstrap_auto.sql` fails if no `auth.users` row exists.
- If Econt migration (22900) is skipped, integration UI will fail at runtime.
- If Vercel env vars are missing, app fails with Supabase URL/anon key error.

## 9) Obsolete pieces removed/disabled
- Frontend platform login and tenant selector UX removed.
- Standalone `supabase/lookup-tenant-by-email.sql` removed.
- Supabase edge functions `create-tenant` and `delete-tenant` removed.
- `lookup_tenant_by_email` RPC dropped by migration 23000.
