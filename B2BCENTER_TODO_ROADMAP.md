# B2BCenter TODO Roadmap

Generated: 2026-05-19

This file tracks the current working priorities for the single-tenant B2BCenter/Centivon app. It is based on the current repo context, not the TED/Lina version.

## Current Priority List

### P0 — Core product/admin flow cleanup

1. ~~Replace current client invite/add flow with manual client creation~~ ✅ DONE
   - Admin creates client manually from Clients page.
   - Admin enters email, company name, discount %, temporary password + confirm.
   - Client is linked to the single B2BCenter workspace immediately.
   - Old invite flow UI removed (resend, copy link, invite modal hidden).
   - Client can log in with the temporary password immediately.
   - **Deploy needed:** `supabase functions deploy create-client`

2. ~~Fix client deletion flow~~ ✅ DONE
   - Admin removes client access via Edge Function (`deactivate-client`).
   - Deletes `tenant_memberships` row to revoke dashboard access.
   - Profile, company, quotes, and orders remain intact for history.
   - Edge Function validates caller is admin/owner, prevents self-deactivation and protecting other admins/owners.
   - React Query cache invalidated immediately after success.
   - Real errors shown on failure; no success toast on failure.
   - **Deploy needed:** `supabase functions deploy deactivate-client`

3. ~~Remove cart/add-to-cart UI and logic from admin profile~~ ✅ DONE
    - Cart icon + badge hidden from header for admins.
    - CartDrawer and OrderRequestModal not rendered for admins.
    - ProductGridCard: quantity selector + Add to Cart replaced with compact metadata (manufacturer only) for admins. Wishlist heart hidden. Stock shown only in image badge. Availability/status row removed entirely.
    - Product detail page: restructured as two-column layout — left side = image gallery, right side = structured info column (title, price, stock, description, specs, actions/metadata). Description and specs moved into right column on desktop (no longer separate bottom section). "Related Products" section removed. Single unified metadata block shown for both admin and client (role-specific badge label: "Администраторски каталог" for admin, "Информация за продукта" for client). Client pills hidden for admins. Duplicate admin metadata block removed.
    - ProductQuickViewModal: "Add to Cart" replaced with "Admin catalog view" badge for admins.
    - Orders page: already separates AdminOrdersView and CompanyOrdersView; reorder functionality only in CompanyOrdersView.
    - OrderDetailsSheet: "Order Again" button hidden for admins (uses `isCompanyUser` check). Econt `ShipmentPanel` hidden for clients (uses `isAdmin` guard).
    - Company/client users retain full cart/order flow.

4. ~~Product page and card UX refinement~~ ✅ DONE
    - Admin product cards: removed availability/status row, kept only manufacturer. Stock only in image badge.
    - Admin product detail: description + specs moved into right column for denser desktop layout. Status field renamed to "Статус" with "В наличност"/"Изчерпано" values.
    - Product gallery investigation: no UI bug found. DB stores `main_image TEXT` + `images TEXT[]`. CSV parser reads `image1`-`image10` columns into `images[]`. Gallery UI correctly renders thumbnails/arrows when `images.length > 1`. **Root cause**: most imported products only have `main_image` populated; `images[]` is empty. Gallery is data-limited, not broken.
    - Metadata duplication fix: removed duplicate admin-only metadata block that was rendered after the shared block. Now a single shared metadata block with role-specific badge label.

4. ~~Hide Econt functionality from client profiles~~ ✅ DONE
    - Econt `ShipmentPanel` hidden from client/company users in `OrderDetailsSheet.tsx` (wrapped with `isAdmin` guard from `useAuth()`).
    - Admin `ShipmentPanel` in `AdminOrdersView.tsx` remains visible (admin-only view).
    - Econt integration settings in Settings page already guarded by `isAdmin` for sidebar tab and content render.
    - Client order flow shipping method selection (`QuoteRequestModal`) untouched — clients still select shipping method when submitting orders.

5. ~~Fix order notes saving~~ ✅ DONE (verified: internal notes mutation uses `internal_notes` column, backward-compatible fallback for tenants without migration)

### P1 — Catalog UX correctness

6. ~~Fix product filters~~ ✅ DONE
    - Manufacturer/vendor filter: root cause was `.limit(10000)` without `.order()` on the filter-options query — Supabase returns arbitrary rows, missing manufacturers outside that window. Fixed by removing the limit entirely (single-column `manufacturer` select, small payload even for large catalogs).
    - Availability filter removed from UI and all query logic (state, query keys, filter application, count query, active filters display).
    - Category and stock filters remain working.
    - Grid adjusted from `lg:grid-cols-5` to `lg:grid-cols-4`.

7. ~~Fix pagination~~ ✅ DONE
    - Root cause: `cachedPage1Data` query key was missing `profile?.id` and `profile?.commission_rate` fields that the main paginated query includes, causing cache miss and empty results on page 2+.
    - Fixed by adding missing fields to the `getQueryData` lookup key.
    - Page resets to 1 when filters/search change (existing `useEffect` already handles this).

8. ~~Fix category click flow~~ ✅ DONE (polished)
   - Categories without subcategories open the product listing directly (no intermediate single-card "All" page).
   - Categories with real subcategories still show the subcategory cards.
   - **Fake "All" subcategory removed.** `useCategoryHierarchy` no longer injects a synthetic `slug: 'all'` entry into the hierarchy map for any case.
   - **"Всички продукти" entry-point card** is now rendered at the component level (only when the main category also has products assigned directly to it) and navigates to `/dashboard/categories/:mainCategory?view=all` — never `/dashboard/categories/:mainCategory/all`. The URL never contains an `/all` path segment.
   - **Legacy redirect:** Visiting `/dashboard/categories/:mainCategory/all` now `replace()`-navigates to `/dashboard/categories/:mainCategory?view=all` so old bookmarks keep working without rendering a broken "category not found" state.
   - **Breadcrumbs** show the localized "Всички продукти" / "All products" label as the leaf for the all-view, never the raw token "all" / "All".
   - **Scroll reset:** category navigation now scrolls the dashboard scroll container (`<main id="dashboard-main">`) back to the top whenever `mainCategory`, `subCategory`, or the `?view=all` flag changes. Previous behavior preserved per-route scroll, landing users mid-grid after clicking a category card.
   - **Heavy-loading fix on `/dashboard/categories`:** the old `useCategoryHierarchy` query pulled every visible product in the tenant (including the full `images[]` array) via a nested PostgREST join just to compute per-category counts and pick a fallback card image. Replaced with two parallel slim queries (categories metadata; visible products with only `category_id, main_image`) and a client-side bucket map. Hierarchy is also cached with `staleTime: 30s` so navigating between the categories list and a category page no longer re-fires the query on every entry.

   Remaining: a fuller perf pass on `manage.tsx` (per-category count query is N+1) is still tracked under item 12.

9. Product gallery — data/import follow-up (not a UI bug)
   - The gallery UI works correctly when `images[]` has multiple items; most imports currently only populate `main_image`.
   - Follow-up should ensure the CSV/import pipeline populates `images[]` from `image1`–`image10` columns when available.

10. Remove similar products from product page
   - Similar/recommended products are not needed.
   - Remove UI and unnecessary queries if possible.

### P2 — Admin tooling and performance

11. ~~Fix manage categories operations~~ ✅ DONE
   - Edit category, upload/change category photo, merge categories — verified working.
   - Delete category now only deletes empty/safe categories:
     - Categories that contain products are blocked. The admin is instructed to use **Merge Categories** to move the products to another category before removing the original.
     - Categories that have subcategories are blocked. The admin must move/merge/delete the subcategories first.
     - No "Без категория" orphan product behavior. Category deletion never moves products to a hidden uncategorized bucket and never hard-deletes products.
   - The delete modal swaps title/body/CTA based on the live product and subcategory counts; the mutation re-verifies the counts server-side before deleting.
   - Product deletion/archival is intentionally out of scope here and tracked as a separate future feature.

12. Reduce heavy initial/page loading
   - App and some pages have unnecessary heavy loading.
   - Audit expensive queries, repeated requests, realtime subscriptions, and blocking auth/tenant checks.
   - Optimize carefully without changing auth/TenantProvider unless absolutely necessary.

### P3 — Later integrations

13. Greek manufacturer inventory sync
   - Implement later.
   - There is already a separate Vercel domain / ops script that syncs SKU inventory into the portal.
   - Reuse that approach if possible after core flows are stable.

## Important Constraints

- This is the B2BCenter single-tenant app, not the TED/Lina version.
- Do not touch `useAuth.ts`, `TenantProvider.tsx`, route guards, or single-tenant migrations unless the task explicitly requires it.
- Do not change core auth/bootstrap logic casually.
- Prefer small, testable commits.
- After every coding step, run:
  - `npm run build`
  - `npm run lint` if practical
- Update this file after completing each task.

## Recommended Work Order

Start with:

1. Manual client creation flow.
2. Client deletion flow.
3. Remove admin cart/add-to-cart.
4. Hide Econt for clients.
5. Fix filters and pagination.

Do not start Greek inventory sync until the core portal UX is stable.
