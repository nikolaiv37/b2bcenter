# B2BCENTER PROJECT CONTEXT

> Generated: 2026-05-19 | Repo: b2bcenter | Package name: `furnitrade` v1.0.0

---

## 1. Tech Stack and Package Manager

| Layer | Technology |
|---|---|
| **Runtime** | Node.js 18+ (`.nvmrc`) |
| **Package manager** | npm (lockfile: `package-lock.json`) |
| **Build tool** | Vite 5.4 with `@vitejs/plugin-react-swc` |
| **Language** | TypeScript 5.3, strict mode |
| **Framework** | React 18.2 |
| **Routing** | React Router v6 (lazy-loaded routes) |
| **Styling** | TailwindCSS 3.3 + CSS custom properties (glassmorphism) |
| **UI components** | shadcn/ui (Radix UI primitives) |
| **State management** | Zustand (auth, cart) + TanStack Query v5 (server state) |
| **Forms** | React Hook Form + Zod validation |
| **Backend** | Supabase (PostgreSQL, Auth, Storage, Edge Functions, Realtime) |
| **Payments** | Stripe (frontend client wired, backend not present) |
| **Email** | Resend (client helper exists) |
| **Analytics** | PostHog |
| **i18n** | i18next (en/bg locales) |
| **PDF** | `@react-pdf/renderer` (proforma invoices) |
| **Charts** | Recharts |
| **Deployment** | Vercel (`vercel.json`, `@vercel/speed-insights`) |

---

## 2. App Purpose and Product Positioning

**B2BCenter** (internally named "FurniTrade") is a **single-wholesaler B2B furniture wholesale platform**. It enables:

- **Wholesaler admins** to import product catalogs (CSV/XML), manage categories, track orders/quotes, handle complaints, and manage B2B clients.
- **B2B clients (buyers)** to browse catalogs, add to cart, submit order requests (stored as quotes), track order status, file complaints, save wishlists, and use order templates.

The platform was cut from a multi-tenant SaaS model to a **single-tenant mode** (migration `20260312123000`), with one workspace (`slug = 'b2bcenter'`). Multi-tenant tables remain for compatibility but only one tenant is enforced.

---

## 3. Folder Structure Overview

```
src/
├── App.tsx                    # Root router + provider tree
├── main.tsx                   # Entry point
├── index.css                  # Global styles + glassmorphism
├── app/
│   ├── auth/                  # Login, signup, onboarding, invite flows
│   └── dashboard/             # All protected workspace pages
│       ├── layout.tsx         # Dashboard shell (sidebar, header, cart)
│       ├── overview.tsx       # Dashboard home
│       ├── products/          # Product listing + detail by SKU
│       ├── categories/        # Category browsing + management
│       ├── wishlist/          # User wishlist
│       ├── orders/            # Order tracking (admin + client views)
│       ├── order-templates/   # Saved order templates
│       ├── quotes/            # Quote management
│       ├── complaints/        # Complaints/returns workflow
│       ├── csv-import/        # Universal import wizard (CSV/XML)
│       ├── settings/          # Company + profile settings
│       ├── analytics/         # Analytics dashboard
│       ├── unpaid-balances/   # Unpaid balance tracking
│       ├── clients/           # Admin client management
│       └── distributors/      # (likely alias/legacy)
├── components/
│   ├── ui/                    # shadcn/ui primitives
│   ├── guards/                # Auth/membership/tenant guards
│   ├── import/                # UniversalImportWizard
│   ├── csv-import/            # Legacy CSV wizard
│   ├── shipping/              # Econt shipping components
│   └── [30+ shared components]
├── features/
│   └── order-templates/       # Order template feature module
├── hooks/                     # 19 custom hooks (auth, products, quotes, etc.)
├── lib/
│   ├── supabase/              # Supabase client
│   ├── tenant/                # TenantProvider, resolveTenant, constants
│   ├── app/                   # AppContext (currentAccount, workspaceId)
│   ├── csv/                   # CSV parsing, distributor detection
│   ├── xml/                   # XML parser (in-progress)
│   ├── shipping/              # Econt shipping utilities
│   └── [analytics, i18n, pricing, utils, etc.]
├── stores/                    # Zustand stores (authStore, cartStore)
├── types/                     # TypeScript type definitions
├── locales/                   # en.json, bg.json
├── pages/                     # LandingPage, MainIndexRoute, NotFound, etc.
└── i18n/                      # i18n configuration
```

---

## 4. Routing / Pages Map

### Public routes
| Path | Component | Description |
|---|---|---|
| `/` | `MainIndexRoute` | Entry point (likely redirects) |
| `/landing` | `LandingPage` | Marketing/landing page |

### Auth routes
| Path | Component | Description |
|---|---|---|
| `/auth/login` | `LoginPage` | Email/password login |
| `/auth/signup` | `SignupPage` | Registration (guarded by `SignupGuard`) |
| `/auth/onboarding` | `OnboardingPage` | Company profile setup |
| `/auth/accept-invite` | `AcceptInvitePage` | Accept tenant invitation |
| `/auth/client-setup` | `ClientSetupPage` | New client password setup |
| `/auth/owner-setup` | `OwnerSetupPage` | Owner initial setup |

### Dashboard routes (protected by `TenantActiveGuard` → `AuthGuard` → `MembershipGuard`)
| Path | Component | Admin-only? |
|---|---|---|
| `/dashboard` | `DashboardOverview` | No |
| `/dashboard/categories` | `CategoriesPage` | No |
| `/dashboard/categories/:mainCategory` | `CategoriesPage` | No |
| `/dashboard/categories/:mainCategory/:subCategory` | `CategoriesPage` | No |
| `/dashboard/categories/manage` | `ManageCategoriesPage` | Yes |
| `/dashboard/products` | `ProductsPage` | No |
| `/dashboard/products/:sku` | `ProductDetailPage` | No |
| `/dashboard/wishlist` | `WishlistPage` | No |
| `/dashboard/orders` | `OrdersPage` | No (admin sees all) |
| `/dashboard/order-templates` | `OrderTemplatesPage` | No (company users only) |
| `/dashboard/complaints` | `ComplaintsPage` | No |
| `/dashboard/quotes` | `QuotesPage` | No |
| `/dashboard/csv-import` | `CSVImportPage` | Yes |
| `/dashboard/settings` | `SettingsPage` | No |
| `/dashboard/analytics` | `AnalyticsPage` | No |
| `/dashboard/unpaid-balances` | `UnpaidBalancesPage` | No |
| `/dashboard/clients` | `ClientsPage` | Yes |

### Removed routes (single-tenant cut)
- `/platform/*` — removed
- `/t/:slug/*` — removed

---

## 5. Main User Roles and Auth Flow

### Roles
| Role | Description |
|---|---|
| `admin` / `owner` | Wholesaler operator — full dashboard access, import, client management |
| `company` | B2B client — browse catalog, cart, orders, complaints, wishlist |

Role is determined by `membership.role` from `tenant_memberships` table. `isAdmin = membership.role === 'owner' || membership.role === 'admin'`.

### Auth Flow
1. User visits `/auth/login` or `/auth/signup`
2. Supabase email/password auth
3. `TenantProvider` resolves tenant membership (single tenant: `b2bcenter`)
4. `useAuth` loads/creates profile (auto-creates with role `company` if missing)
5. `AuthGuard` checks onboarding; redirects to `/auth/onboarding` if no company profile
6. Onboarding creates `companies` row and links `profiles.company_id`
7. User enters `/dashboard/*` (guarded by `TenantActiveGuard` → `AuthGuard` → `MembershipGuard`)
8. Sign-out clears Supabase session and hard-redirects to `/auth/login`

### Invite flows
- Admin invites clients via `invite-client` edge function → `tenant_invitations` table
- Client accepts via `/auth/accept-invite` → `/auth/client-setup` (sets password only)

---

## 6. Tenant / Workspace / Domain Logic

### Current state: **Single-tenant soft cut**
- One tenant enforced: `slug = 'b2bcenter'`
- `single_tenant_id()` function returns the single tenant UUID
- `enforce_single_tenant_fk()` trigger blocks any `tenant_id` that doesn't match
- All tenant-scoped tables get `tenant_id = single_tenant_id()` by default
- `current_tenant_id()` falls back to `single_tenant_id()` if no membership found

### Tenant tables still present (for compatibility)
- `tenants` — one row enforced
- `tenant_memberships` — user-to-tenant role mapping
- `tenant_domains` — domain verification (not actively used in single-tenant mode)
- `tenant_invitations` — client invite system
- `tenant_integrations` — Econt carrier config

### AppContext API
- `currentAccount` — userId, email, profile, isAdmin, membershipRole
- `currentCompany` — company row data
- `workspaceId` — tenant ID (used for DB queries)
- `workspaceName` — tenant name

---

## 7. Supabase / Database Tables

### Core tables used by app
| Table | Purpose |
|---|---|
| `profiles` | User profiles (role, company_id, commission_rate, etc.) |
| `companies` | Company data (EIK, VAT, IBAN, MOL, etc.) |
| `products` | Product catalog (SKU-based, category_id, weboffer_price) |
| `categories` | Normalized categories (hierarchy, slugs) |
| `quotes` | Orders/quotes (status workflow, items as JSONB, backorder flag) |
| `complaints` | Complaints/returns with internal notes |
| `wishlist_items` | Per-user wishlist (SKU-based) |
| `notifications` | In-app notifications |
| `order_templates` | Saved order templates per user |
| `tenant_memberships` | User-to-tenant role mapping |
| `tenants` | Single tenant row |
| `tenant_invitations` | Client invite tokens |
| `tenant_integrations` | Econt carrier configuration |
| `shipments` | Econt shipment records |
| `csv_import_history` | Import logging (exists but not wired in UI) |
| `csv_distributor_mappings` | Column mapping persistence (exists but not used) |
| `category_synonyms` | Category synonym mapping (exists but not used) |
| `import_configs` | Import configuration storage (used by XML path only) |

### No standalone `orders` table
Orders are stored as `quotes` with status workflow. The UI maps between quote statuses and order display statuses.

### Storage buckets
- `complaints` — complaint attachments
- `logos` — company logos (public)
- `category-images` — category images

### 36 migration files
Latest migrations:
- `20260409113000_create_order_templates_table.sql`
- `20260409143000_add_backorder_flag_to_quotes.sql`

---

## 8. Important Environment Variables

| Variable | Required | Notes |
|---|---|---|
| `VITE_SUPABASE_URL` | Yes | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Yes | Supabase anon key |
| `VITE_DEV_MODE` | No | Enables local/dev fallback flows |
| `VITE_STRIPE_PUBLISHABLE_KEY` | Optional | Stripe frontend bootstrap |
| `VITE_RESEND_API_KEY` | Optional | Email client helper |
| `VITE_POSTHOG_KEY` | Optional | PostHog analytics |
| `VITE_POSTHOG_HOST` | Optional | Defaults to PostHog cloud |

**No longer used:** `VITE_SINGLE_TENANT_MODE`

---

## 9. Current Feature Inventory

| Feature | Status | Notes |
|---|---|---|
| Auth (login/signup) | Working | Supabase email/password |
| Onboarding | Working | Creates company + links profile |
| Invite flow | Working | Edge function + accept/setup pages |
| Product catalog browsing | Working | Filters, search, detail by SKU |
| Categories (normalized) | Working | Hierarchy, breadcrumbs, management |
| Cart (Zustand) | Working | Persisted, drawer UI |
| Order/quote submission | Working | Cart → quotes table |
| Order tracking | Working | Status workflow with mapping |
| Order templates | Working | Saved templates per user |
| Complaints/returns | Working | File upload, internal notes |
| Wishlist | Working | SKU-based, persists across catalog updates |
| CSV import wizard | Working | Auto-detect distributor, column/category mapping, batched upsert |
| XML import | Partial | Parser/mapping exist, persistence incomplete |
| Client management | Working | Admin view, invite, commission rate |
| Unpaid balances | Working | Quote-based tracking |
| Notifications | Working | Bell UI, DB table, real-time |
| Analytics dashboard | Working | Overview charts, stats |
| Settings (company + profile) | Working | Hash-based sections |
| Dark mode | Working | Toggle, persisted |
| i18n (EN/BG) | Working | Detected from browser, persisted |
| Econt shipping | Working | Edge functions, settings UI, shipment panel |
| Proforma invoice PDF | Working | `@react-pdf/renderer` |
| Landing page | Exists | `/landing` |
| Stripe checkout | Not implemented | Frontend client exists, no backend |
| Resend emails | Not implemented | Client helper exists, no integration |

---

## 10. What is Finished / Working

- **Auth pipeline**: login, signup, onboarding, invite accept, client setup, owner setup
- **Dashboard layout**: sidebar with role-based nav, header with user menu, cart drawer
- **Product catalog**: listing, filtering, detail view, category browsing
- **Normalized categories**: CRUD, hierarchy, slug-based URLs, image support
- **Cart + order flow**: add to cart, submit as quote, track status
- **Order templates**: save/load/delete templates per user
- **Complaints**: create with file upload, admin internal notes, status tracking
- **Wishlist**: add/remove, SKU-based persistence
- **CSV import**: full wizard with auto-detection, mapping, validation, batched upsert
- **Client management**: admin view, invite flow, commission rates
- **Econt integration**: settings, calculate, create label, track, delete
- **Notifications**: bell UI, DB-backed, real-time updates
- **i18n**: full EN/BG translations
- **Dark mode**: toggle with persistence
- **Single-tenant DB**: soft cut enforced via triggers

---

## 11. What is Unfinished / Broken / Risky

| Area | Issue | Risk |
|---|---|---|
| **XML import** | Parser exists but persistence/config save-load not wired in UI | Medium |
| **Stripe checkout** | Frontend client wired, no `/api/create-checkout-session` backend | Low (optional) |
| **Resend emails** | Client helper exists, no actual email sending integration | Low (optional) |
| **CSV mapping persistence** | Tables exist (`csv_distributor_mappings`, `category_synonyms`) but not used by current UI | Low |
| **Import history** | `csv_import_history` table exists but not wired in UI | Low |
| **`products` upsert conflict** | Conflict key is global `sku`, no explicit company scoping | Medium |
| **XML CORS** | Client-side XML URL fetch may fail due to CORS | Medium |
| **`category-images` bucket** | Referenced in app but migration for bucket creation may be missing | Medium |
| **Legacy `schema.sql`** | Root-level schema is outdated vs migrations (migration files are source of truth) | Low |
| **`orders` table** | Defined in legacy schema but not used; orders stored as `quotes` | Low |
| **Platform admin features** | Deprecated by single-tenant cut, some DB flags remain | Low |
| **No down-migrations** | No rollback framework for DB migrations | Medium |
| **`src/lib/xml/parser.ts`** | Ends with `export type { Builder }` without local import | Low (may cause TS issues) |

---

## 12. Current Branding References

| Reference | Value | Location |
|---|---|---|
| Package name | `furnitrade` | `package.json` |
| Internal slug | `b2bcenter` | Migration `20260312123000` (`single_tenant_id()`) |
| Display name fallback | `B2BCenter` | `SidebarNav.tsx` |
| Design system name | `FurniTrade Design System` | `design-system.md` |
| Color palette | Neutral: `#F7F7F8`, `#2F243A`, `#444054` | `design-system.md`, `index.css` |
| Style | Glassmorphism | `index.css`, component classes |
| Logo fallback | Blue gradient with first letter | `SidebarNav.tsx`, `layout.tsx` |

---

## 13. Important Scripts from package.json

| Script | Command | Description |
|---|---|---|
| `dev` | `vite` | Start dev server (port 5173) |
| `build` | `tsc && vite build` | Type-check + production build |
| `preview` | `vite preview` | Preview production build |
| `lint` | `eslint . --ext ts,tsx --report-unused-disable-directives --max-warnings 0` | Lint check |

---

## 14. Files ChatGPT Should Inspect First

| Priority | File | Why |
|---|---|---|
| 1 | `src/App.tsx` | Full route map + provider tree |
| 2 | `src/hooks/useAuth.ts` | Auth state, profile creation, tenant handling |
| 3 | `src/lib/tenant/TenantProvider.tsx` | Tenant resolution + membership |
| 4 | `src/lib/app/AppContext.tsx` | App-facing context API |
| 5 | `src/types/index.ts` | All TypeScript types |
| 6 | `src/app/dashboard/layout.tsx` | Dashboard shell + nav structure |
| 7 | `src/components/SidebarNav.tsx` | Navigation items + role-based visibility |
| 8 | `supabase/migrations/20260312123000_single_tenant_soft_cut.sql` | Single-tenant enforcement |
| 9 | `docs/PROJECT_CONTEXT.md` | Existing product context |
| 10 | `docs/ARCHITECTURE.md` | System architecture |
| 11 | `docs/RUNBOOK.md` | Bootstrap + deployment instructions |
| 12 | `CURRENT_PLATFORM_SETUP.md` | Current platform state snapshot |

---

## 15. Recommended Next Steps for Coding

1. **Wire XML import config persistence UI** — save/load mapping configs in `import_configs` table
2. **Add import history logging** — surface `csv_import_history` in the import wizard
3. **Fix `products` upsert conflict scoping** — use `(tenant_id, sku)` or `(company_id, sku)` as conflict target
4. **Implement Stripe checkout backend** — add `/api/create-checkout-session` endpoint
5. **Integrate Resend for transactional emails** — order confirmations, quote approvals, complaint updates
6. **Add `category-images` bucket migration** if missing
7. **Clean up legacy `schema.sql`** or mark it as deprecated
8. **Add E2E or integration tests** for CSV import, order flow, and complaints
9. **Consider removing unused tables** (`csv_distributor_mappings`, `category_synonyms`) if not needed
10. **Add down-migration discipline** for future schema changes
