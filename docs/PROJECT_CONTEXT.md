# Project Context = stable

## Product one-liner
FurniTrade is a single-wholesaler B2B catalog + order operations app where company users browse products, place quote/orders, and admins manage catalog, clients, complaints, and workflows.

## Target users
- **Admin (platform owner / wholesaler ops):** manages imports, products, categories, clients, orders, complaints, analytics.
- **Company user (B2B client):** signs up, completes onboarding, browses catalog, adds to cart, submits orders, tracks status, files complaints.

## Primary user journeys

### 1) Signup -> onboarding -> first dashboard access
1. User signs up at `/auth/signup` (`src/app/auth/signup.tsx`).
2. User logs in at `/auth/login` (`src/app/auth/login.tsx`).
3. `useAuth` loads or auto-creates profile with role `company` (`src/hooks/useAuth.ts`).
4. `AuthGuard` checks onboarding; if missing company profile, redirects to `/auth/onboarding` (`src/components/AuthGuard.tsx`).
5. Onboarding creates/updates `companies` row and links `profiles.company_id` (`src/app/auth/onboarding.tsx`).
6. User enters protected dashboard routes under `/dashboard/*` (`src/App.tsx`).

### 2) Import products (current CSV + current XML path)
1. Admin opens `/dashboard/csv-import` (`src/app/dashboard/csv-import/index.tsx`).
2. Admin uses Universal Import Wizard (`src/components/import/UniversalImportWizard.tsx`).
3. CSV path:
   - Upload + detect distributor and columns (`src/hooks/useSmartMapping.ts`, `src/lib/csv/distributors.ts`).
   - Category mapping (including main/subcategory handling).
   - Validation and import via batched `upsert` into `products`.
4. XML path (in-progress but functional basics):
   - Parse XML tree and detect product path (`src/lib/xml/parser.ts`, `src/hooks/useXmlMapping.ts`).
   - Map XPath-like fields to standard fields.
   - Validate and import through same batch upsert path.
5. Category sync writes/links `categories` + `products.category_id` non-destructively (`src/lib/category-sync-from-import.ts`).

### 3) Browse products -> cart -> submit order
1. Company user browses `/dashboard/products` (`src/app/dashboard/products/index.tsx`).
2. Adds items to persisted cart store (`src/stores/cartStore.ts`).
3. Submits order from cart via `QuoteRequestModal` -> inserts into `quotes` table (used as orders source) (`src/components/QuoteRequestModal.tsx`).
4. Company user tracks own orders in `/dashboard/orders`; admin sees all in `AdminOrdersView` (`src/app/dashboard/orders/index.tsx`, `src/app/dashboard/orders/AdminOrdersView.tsx`).
5. Status mapping between DB and UI is handled in code (`mapStatus`, `mapStatusToDb`).

## Core modules
- **Auth + session:** `src/hooks/useAuth.ts`, `src/components/AuthGuard.tsx`, `src/stores/authStore.ts`
- **Onboarding + company profile:** `src/app/auth/onboarding.tsx`, `src/components/CompanyForm.tsx`, `src/app/dashboard/settings/index.tsx`
- **Dashboard + navigation:** `src/app/dashboard/layout.tsx`, `src/components/SidebarNav.tsx`
- **Catalog/products:** `src/app/dashboard/products/index.tsx`, `src/hooks/useQueryProducts.ts`
- **Categories (normalized):** `src/app/dashboard/categories/index.tsx`, `src/app/dashboard/categories/manage.tsx`, `src/hooks/useCategoryHierarchy.ts`
- **Imports (CSV/XML):** `src/components/import/UniversalImportWizard.tsx`, `src/components/csv-import/CSVImportWizard.tsx`, `src/hooks/useSmartMapping.ts`, `src/hooks/useXmlMapping.ts`
- **Orders/quotes workflow:** `src/app/dashboard/orders/*`, `src/app/dashboard/quotes/index.tsx`, `src/hooks/useMutationQuote.ts`
- **Complaints/returns:** `src/app/dashboard/complaints/*`
- **Clients admin module:** `src/app/dashboard/clients/index.tsx`, `src/hooks/useQueryClients.ts`
- **Analytics:** `src/app/dashboard/overview.tsx`, `src/app/dashboard/analytics/index.tsx`, `src/lib/analytics.ts`
- **Wishlist:** `src/app/dashboard/wishlist/index.tsx`, `src/hooks/useWishlist.ts`
- **Unpaid balances:** `src/app/dashboard/unpaid-balances/index.tsx`, `src/hooks/useCompanyUnpaidBalances.ts`

## Current status

| Area | Status | Evidence |
|---|---|---|
| Auth + onboarding | Implemented | `/auth/*`, `useAuth`, `AuthGuard`, onboarding creates company/profile link |
| Product browsing + filters + cart | Implemented | `src/app/dashboard/products/index.tsx`, `cartStore` |
| Orders workflow (quotes as orders source) | Implemented with legacy mapping | `src/app/dashboard/orders/*`, `quotes` table status mapping in code |
| Complaints workflow | Implemented | `src/app/dashboard/complaints/*`, `supabase/create-complaints-table.sql` |
| Categories normalized model | Implemented | `categories` table migrations + `products.category_id` + hierarchy hook |
| CSV import wizard | Implemented | `CSVImportWizard`, `useSmartMapping`, `csv/*` libs |
| XML import wizard | In-progress (usable but incomplete) | `UniversalImportWizard`, `useXmlMapping`, XML parser/validator; config save/load exists but not wired in UI |
| Mapping persistence for CSV | Planned/partial infra only | `csv_distributor_mappings`, `category_synonyms`, `csv_import_history` SQL exists; app currently uses hardcoded presets in `src/lib/csv/distributors.ts` |
| Billing/Stripe checkout backend | Planned/partial | Frontend client exists (`src/lib/stripeClient.ts`), backend endpoint `/api/create-checkout-session` not present in repo |

## Key UX decisions and tone (BG/EN i18n)
- App supports **English and Bulgarian** via i18next (`src/lib/i18n.ts`, `src/locales/en.json`, `src/locales/bg.json`).
- Language is detected from localStorage/browser and persisted in `i18nextLng`.
- Tone is ops-focused B2B, with BG-specific compliance messaging (EIK, VAT, IBAN, MOL) especially in landing + proforma flow.
- UI uses glassmorphism style components (`GlassCard`, custom styles in `src/index.css`).
- Admin-only controls are enforced in UI in many places (e.g. import page, clients page), with RLS expected to backstop DB-level access.
