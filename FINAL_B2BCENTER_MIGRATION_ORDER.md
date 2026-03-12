# FINAL_B2BCENTER_MIGRATION_ORDER

This is the current safest bootstrap sequence for **b2bcenter** after the single-tenant cut.

## Exact SQL execution order
Run files from `supabase/migrations` in filename order:

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
22. `20260312122000_lookup_tenant_by_email.sql`
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

## Required files
- All files above are required for the current app behavior.
- `20260312122900_create_econt_integrations_and_shipments.sql` is required to keep Econt working.
- `20260312123000_single_tenant_soft_cut.sql` is required to lock single-tenant DB behavior.

## Optional files
- Root-level legacy SQL files in `supabase/*.sql` are optional references once migration files are in place.
- `sample-data.sql` is optional for local demo data only.

## Should NOT be run for fresh bootstrap
- Ad-hoc legacy fixes not represented in migration order (for example historical `fix-*` scripts) should not be run on top of the ordered migration set unless you have a specific incident.
- `supabase/lookup-tenant-by-email.sql` (legacy standalone file) is obsolete and removed from this repo path.

## Decision notes (short)
- `lookup_tenant_by_email` was used by old platform login flow; frontend no longer uses that flow.
- Migration 22000 creates it for historical compatibility; migration 23000 removes it.
- Platform console policies are dropped in migration 23000 because `/platform/*` surface is removed.

## Tenant/membership/platform tables requirement
- `tenants`, `tenant_memberships`, and `tenant_domains` are still required for app boot today.
- Frontend membership guard still depends on membership resolution.
- This is a **soft cut**: schema retains tenant structures while enforcing one tenant ID.

## First tenant + owner membership
- Yes, first tenant + owner membership must exist.
- Migration 22700 auto-creates them using the oldest `auth.users` row.
- If no auth user exists yet, create one first, then run migration 22700+.

## Storage bucket setup
Created by migrations:
- `complaints` (migration 21300)
- `logos` (migration 22500)
- `category-images` (migration 22600)

## Post-migration validation checklist
1. Verify tenant bootstrap:
   - one active tenant row exists
   - owner membership exists in `tenant_memberships`
2. Verify storage buckets: `complaints`, `logos`, `category-images`
3. Verify Econt tables exist: `tenant_integrations`, `shipments`
4. Verify auth flow:
   - login works
   - `/dashboard` loads
   - no `/platform/*` routing dependency
5. Verify single-tenant DB enforcement:
   - inserts with foreign `tenant_id` fail
   - defaults assign `tenant_id = single_tenant_id()`
6. Smoke test key modules:
   - products/categories
   - quotes/orders
   - complaints
   - wishlist
   - CSV/XML import
   - Econt integration settings + shipment actions
