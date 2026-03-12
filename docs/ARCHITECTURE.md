# Architecture

## System diagram

```text
[Browser: React + Vite SPA]
  - Routes: /auth/*, /dashboard/*
  - State: TanStack Query + Zustand
  - i18n: i18next (en/bg)
          |
          | supabase-js (auth, db, storage, realtime)
          v
[Supabase]
  ├─ Auth (auth.users)
  ├─ Postgres tables (profiles, companies, products, categories, quotes, complaints, wishlist_items, import_configs, ...)
  ├─ Storage buckets (logos, complaints, category-images*)
  └─ Realtime channels (admin orders/complaints views)
          |
          +--> External HTTP integrations from frontend:
                - Resend API (email): https://api.resend.com/emails
                - Stripe checkout bootstrap: /api/create-checkout-session (expected backend, not in repo)
                - XML URL feed fetch (browser fetch in xml parser)
```

`category-images*` bucket is referenced in app code; migration file for bucket creation is UNKNOWN.

## Data flows (top 3)

### Flow 1: Signup -> profile -> company onboarding
1. `supabase.auth.signUp` (`src/app/auth/signup.tsx`).
2. Auth state listener (`useAuth`) loads profile from `profiles` or inserts one with role `company`.
3. `AuthGuard` checks onboarding readiness (`profile.company_id`, `company.onboarding_completed`).
4. Onboarding writes/updates `companies` and links `profiles.company_id` (`src/app/auth/onboarding.tsx`).
5. User is redirected to `/dashboard`.

### Flow 2: Import -> category sync -> products upsert
1. Admin opens Universal wizard (`/dashboard/csv-import`).
2. CSV:
   - parse/detect headers and mappings (`parseCSVFlexible`, `useSmartMapping`).
3. XML:
   - parse XML tree + detect product path (`parseXmlFlexible`, `detectProductPath`).
   - field mapping via XPath-like keys (`useXmlMapping`).
4. Wizard transforms rows to product payloads.
5. `prepareProductsWithCategoryId` finds/creates categories and assigns `category_id`.
6. Wizard batches `upsert` into `products` on conflict `sku`.
7. Query caches invalidated (`products`, `categories`, `category-hierarchy`).

### Flow 3: Company order request -> admin processing
1. Company user adds products to cart (`cartStore`) and submits from `QuoteRequestModal`.
2. App inserts into `quotes` with status `new` and shipping method.
3. Company view maps DB statuses to UI statuses in `/dashboard/orders`.
4. Admin view (`AdminOrdersView`) reads all `quotes`, updates status/internal notes.
5. Optional proforma PDF generation uses company/admin company fields (`ProformaInvoicePDF`).

## Auth model + roles/permissions

### Auth model
- Provider: Supabase Auth (`src/lib/supabase/client.ts`).
- Session persistence + refresh enabled.
- Route protection: `AuthGuard` wraps `/dashboard` routes.

### Roles in app code
- `admin`
- `company`
(older SQL files reference `sales`/`buyer`; current TS types and profile creation use `admin|company`.)

### Permission behavior (effective)
- **Admin-only UI sections:** import page, clients page, category management actions.
- **Company users:** browse products, create orders, see own orders, submit complaints.
- **RLS:** defined by multiple SQL files; key policies include:
  - `profiles`: "Users can view their own profile", "Admins can view all profiles" (`supabase/fix-profiles-rls-final.sql`)
  - `categories`: "Admins can manage categories in their company" (`supabase/create-categories-table.sql`)
  - `import_configs`: company-scoped CRUD + admin all (`supabase/migrations/20260205_import_configs.sql`)
  - `quotes`, `complaints`, `wishlist_items`: per-user plus admin/dev-mode patterns (various SQL files)

## Error handling + logging strategy
- **UI boundary:** React ErrorBoundary with `ErrorFallback` (`src/App.tsx`, `src/components/ErrorFallback.tsx`).
- **Mutation/query errors:** handled via `try/catch` + toasts in pages/hooks.
- **Console logging:** extensive `console.error/warn/log` for diagnostics in auth/import/orders/complaints modules.
- **No centralized backend logging pipeline in repo:** UNKNOWN (likely external Supabase logs + hosting logs).
- **Retry behavior:** TanStack Query default retry is `1`, with window-focus refetch disabled (`src/App.tsx`).
