# Runbook

## Local setup

### Prerequisites
- Node.js 18+
- npm
- Supabase project

### Install + run
```bash
npm install
npm run dev
```

App runs at `http://localhost:5173` (Vite default).

### Build + preview
```bash
npm run build
npm run preview
```

### Lint
```bash
npm run lint
```

### Tests
- `UNKNOWN` (no test script in `package.json`).
- Likely location if added later: `package.json` scripts + `src/**/*.test.ts(x)`.

## Environment variables
Create `.env` in repo root.

| Variable | Meaning | Secret |
|---|---|---|
| `VITE_SUPABASE_URL` | Supabase project URL | SECRET |
| `VITE_SUPABASE_ANON_KEY` | Supabase anon/public key | SECRET |
| `VITE_STRIPE_PUBLISHABLE_KEY` | Stripe publishable key for frontend checkout bootstrap | SECRET |
| `VITE_RESEND_API_KEY` | Resend API key (currently used directly from frontend code) | SECRET |
| `VITE_POSTHOG_KEY` | PostHog project key | SECRET |
| `VITE_POSTHOG_HOST` | PostHog host (default `https://app.posthog.com`) | No |
| `VITE_DEV_MODE` | Enables dev-mode fallback IDs in several flows | No |

Do not commit real values.

## Supabase setup, migrations, deployment notes

### Baseline DB setup
1. In Supabase SQL editor, run:
   - `supabase/schema.sql` (baseline; older model)
2. Apply newer feature migrations used by current app (important):
   - `supabase/add-company-onboarding-fields.sql`
   - `supabase/add-company-invoice-fields.sql`
   - `supabase/fix-profiles-rls-final.sql`
   - `supabase/migration-update-products-table-safe.sql`
   - `supabase/create-categories-table.sql`
   - `supabase/add-category-id-to-products.sql`
   - `supabase/add-category-slug-and-unique-constraint.sql`
   - `supabase/create-quotes-table.sql`
   - `supabase/add-order-number-column.sql`
   - `supabase/add-shipping-method-column.sql`
   - `supabase/create-complaints-table.sql`
   - `supabase/fix-complaints-foreign-key.sql`
   - `supabase/create-wishlist-table.sql`
   - `supabase/migrations/20260205_import_configs.sql`

> Note: there are many "fix-*" SQL files in repo that overlap and may conflict. Use with care.

### Storage buckets
- Required by code:
  - `logos` (see `supabase/create-logos-storage-bucket.sql`)
  - `complaints` (see `supabase/create-complaints-table.sql` comments/policies)
  - `category-images` (referenced in app; migration file for bucket creation is UNKNOWN)

### Hosting/deploy
- SPA rewrite config exists for Vercel (`vercel.json`).
- Typical deploy path:
  1. `npm run build`
  2. Deploy `dist/` to Vercel/Netlify
  3. Configure same env vars in hosting project

## Migrations and rollback notes

### Forward migration notes
- Prefer idempotent migration files (`IF NOT EXISTS`/`ADD COLUMN IF NOT EXISTS`).
- Validate RLS after each migration (profiles/companies/categories/quotes/import configs).

### Rollback strategy
- There is **no formal rollback framework** in repo (no migration tool config, no down migrations).
- Practical rollback options:
  1. Restore from Supabase backup/snapshot.
  2. Manually reverse specific migration statements.
  3. For app-only rollback, deploy previous Git commit and keep DB schema backward-compatible.

### High-risk migration areas
- Role constraint changes in `profiles` (`admin/company` vs older role sets).
- `products` schema evolutions (`company_id` -> `supplier_id`, `category_id` additions).
- Status workflow assumptions in `quotes` (`new/pending/shipped/approved`).
