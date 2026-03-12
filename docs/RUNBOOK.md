# Runbook

## Local setup

### Prerequisites
- Node.js 18+
- npm
- Supabase project (Postgres + Auth + Storage)

### Install + run
```bash
npm install
npm run dev
```

### Build + preview
```bash
npm run build
npm run preview
```

### Lint
```bash
npm run lint
```

## Environment variables
Create `.env` in repo root.

| Variable | Required | Notes |
|---|---|---|
| `VITE_SUPABASE_URL` | Yes | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Yes | Supabase anon/public API key |
| `VITE_DEV_MODE` | No | Enables local/dev fallback flows in order/complaint/import paths |
| `VITE_STRIPE_PUBLISHABLE_KEY` | Optional | Used by Stripe frontend bootstrap |
| `VITE_RESEND_API_KEY` | Optional | Used by frontend email client helper |
| `VITE_POSTHOG_KEY` | Optional | Analytics key |
| `VITE_POSTHOG_HOST` | Optional | Defaults to PostHog cloud host |

Notes:
- `VITE_SINGLE_TENANT_MODE` is no longer used.
- Do not commit real secrets.

## Supabase bootstrap (single-tenant)

### Preferred
Use migration files under `supabase/migrations` in timestamp order.

### Execution order
1. `20260312119900_profiles_harmonization.sql`
2. `20260312120000_add_company_onboarding_fields.sql`
3. `20260312120100_add_company_invoice_fields.sql`
4. `20260312120200_add_commission_rate_to_profiles.sql`
5. `20260312120300_update_products_table_safe.sql`
6. `20260312120400_create_categories_table.sql`
7. `20260312120500_add_category_slug_and_constraints.sql`
8. `20260312120600_add_category_id_to_products.sql`
9. `20260312120700_optimize_category_indexes.sql`
10. `20260312120800_drop_legacy_quotes_table.sql`
11. `20260312120900_create_quotes_table.sql`
12. `20260312121000_add_order_number_column.sql`
13. `20260312121100_add_shipping_method_column.sql`
14. `20260312121200_add_quotes_internal_notes.sql`
15. `20260312121300_create_complaints_table.sql`
16. `20260312121400_add_complaints_internal_notes.sql`
17. `20260312121500_create_wishlist_table.sql`
18. `20260312121600_create_tenants_and_domains.sql`
19. `20260312121700_tenant_data_isolation.sql`
20. `20260312121800_add_client_invitations.sql`
21. `20260312121900_add_target_role_to_invitations.sql`
22. `20260312122000_lookup_tenant_by_email.sql` (created then removed by later migration)
23. `20260312122100_platform_admin_and_tenant_status.sql`
24. `20260312122200_platform_admin_auth_no_tenant.sql`
25. `20260312122300_fix_handle_new_user_tenant_aware.sql`
26. `20260312122400_create_notifications_table.sql`
27. `20260312122500_create_logos_storage_bucket.sql`
28. `20260312122600_create_category_images_bucket.sql`
29. `20260312122700_first_tenant_bootstrap_auto.sql`
30. `20260312122800_confirm_owner_auth_users.sql`
31. `20260312122900_create_econt_integrations_and_shipments.sql`
32. `20260312123000_single_tenant_soft_cut.sql`

### Important bootstrap note
- Migration `20260312122700_first_tenant_bootstrap_auto.sql` requires at least one row in `auth.users`.
- If your DB has no users yet, create one user first (Supabase Auth), then run migration 22700+.

## Storage buckets
Created by migrations:
- `complaints`
- `logos`
- `category-images`

## Single-tenant behavior
- Workspace routes are only under `/dashboard/*`.
- `/platform/*` and `/t/:slug/*` are removed.
- Tenant tables/columns remain in DB for compatibility, but `20260312123000_single_tenant_soft_cut.sql` enforces one tenant ID.

## Deployment notes
- Vercel must have at least:
  - `VITE_SUPABASE_URL`
  - `VITE_SUPABASE_ANON_KEY`
- Build command: `npm run build`
- Output directory: `dist`

## Rollback
- No down-migration framework is configured.
- Safe rollback options:
  1. Restore DB backup/snapshot.
  2. Re-deploy previous git commit while keeping DB backward-compatible.
