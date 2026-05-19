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
   - ProductGridCard: quantity selector + Add to Cart replaced with compact metadata (manufacturer, availability) for admins. Wishlist heart hidden. Stock shown only in image badge (no duplicate row).
   - Product detail page: buyer action buttons hidden for admins, replaced with admin info panel (SKU, manufacturer, category, availability). Wishlist heart hidden. AddToOrderModal not rendered. Category/vendor/status pills hidden for admins (shown in admin panel instead). "Related Products" section removed completely. Stock shown once as badge near price.
   - ProductQuickViewModal: "Add to Cart" replaced with "Admin catalog view" badge for admins.
   - Orders page: already separates AdminOrdersView and CompanyOrdersView; reorder functionality only in CompanyOrdersView.
   - OrderDetailsSheet: "Order Again" button hidden for admins (uses `isCompanyUser` check).
   - Company/client users retain full cart/order flow.

4. Hide Econt functionality from client profiles
   - Econt should be visible/usable only for admin.
   - Client/company users should not see shipping management panels/settings/actions.

5. Fix order notes saving
   - Notes/internal notes in a particular order should save reliably.
   - Verify correct DB column, mutation, optimistic state, and refresh behavior.

### P1 — Catalog UX correctness

6. Fix product filters
   - Filters currently do not render or work properly.
   - Verify category, availability, search, price, and any other filters.
   - Ensure filters combine correctly and reset correctly.

7. Fix pagination
   - Pagination currently does not work correctly.
   - Verify product list pagination, page changes, query keys, and total counts.

8. Fix category click flow
   - Clicking a category currently opens an unnecessary intermediate/second page.
   - Desired behavior: clicking a category should directly show the relevant products/category contents.

9. Fix product image gallery
   - Product page image gallery/multiple images do not open or load correctly.
   - Verify image parsing, thumbnail click, modal/lightbox, fallback image handling.

10. Remove similar products from product page
   - Similar/recommended products are not needed.
   - Remove UI and unnecessary queries if possible.

### P2 — Admin tooling and performance

11. Fix manage categories operations
   - Edit category.
   - Upload/change category photo.
   - Merge categories.
   - Delete categories if supported.
   - Verify all operations work with current single-tenant schema and storage buckets.

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
