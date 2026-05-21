# B2BCENTER CURRENT PROGRESS

> Snapshot: 2026-05-21 | Last commit: `ddfd36c` — "Polish UI bulk actions products done"

---

## Repo State

| Property | Value |
|---|---|
| **Branch** | `main` |
| **Last commit** | `ddfd36c` — Polish UI bulk actions products done |
| **Working tree** | Clean at snapshot time |
| **Build status** | Verified via `npm run build` per workflow |
| **Note** | `.env` with real Supabase credentials must not be committed |

### Recent commit history (last 5)
```
ddfd36c Polish UI bulk actions products done
6463970 added and finished implemenation wise
9c55de1 integrate bulk, change hide products
1ae1b7d manage categories ,etc
9b50fcd fix issues with filters
```

---

## Last Completed Work — Product / Catalog / Admin Management Pass

A large product/catalog/admin management pass is now complete:

1. **Manual client creation flow** — admin creates clients directly from the Clients page (no invite flow).
2. **Client delete/deactivation flow** — access revoked via Edge Function; history preserved.
3. **Admin cart/add-to-cart UI removed** — admins no longer see cart, quantity selectors, or add-to-cart.
4. **Admin product cards and product detail UI cleaned** — denser two-column detail layout, manufacturer-only card metadata.
5. **Similar products removed** — similar/recommended UI and queries removed from product detail.
6. **Product gallery investigated** — confirmed a data/import limitation (`images[]` mostly empty), not a UI bug.
7. **Product filters/pagination fixed** — filter card polished; pagination cache-key bug fixed.
8. **Manufacturer filter fixed** — shared `getProductManufacturer()` resolver + paginated option fetching (`src/lib/manufacturers.ts`), no PostgREST 1000-row truncation.
9. **Econt/shipping hidden from client profiles** — admin-only.
10. **Category browsing flow fixed** — categories without subcategories open products directly; fake `/all` route removed; scroll reset fixed.
11. **Manage categories fixed** — edit, image upload/change, merge work; delete safely blocked for categories with products/subcategories; empty-category delete works.
12. **Single product category change** — change one product's category from the detail page.
13. **Bulk product category move** — from the admin list/table view.
14. **Admin Grid/List split** — grid = visual browsing, list = product management.
15. **Product archive/restore** — reversible via `products.is_visible`; no hard delete.
16. **Bulk archive/restore** — context-aware bulk actions from the list view.
17. **Archived products hidden from client flows** — catalog, category, wishlist, detail.
18. **Cart/order submission validation for archived products** — archived items blocked at submission.
19. **Bulk action UX polished** — fixed bottom action bar, no layout jump, accessible while scrolling.
20. **Product filter layout polished** — compact filter card, shorter labels, grid/list toggle aligned with filters.

See `B2BCENTER_TODO_ROADMAP.md` for the detailed per-item breakdown.

---

## Remaining Known Issues

| Issue | Status | Notes |
|---|---|---|
| Order notes saving | ⚠️ Open bug | Notes still do not persist correctly. Reopened 2026-05-21. |
| Quick performance/loading audit | Not done | Audit expensive queries, repeated requests, realtime subscriptions. |
| Greek manufacturer inventory sync | Next major task | Built in the `opsmebelcenter` ops project, not the portal. See `B2BCENTER_INVENTORY_SYNC_PLAN.md`. |
| Hard product delete | Intentionally not implemented | Archive/restore is the supported lifecycle. |
| Bulk archive/delete beyond archive/restore | Not needed now | — |
| Product gallery multiple images | Data limitation | Depends on import/feed data, not a UI bug. |

---

## Next Major Operational Task — Inventory Sync

Greek manufacturer inventory sync is the next major task. Key product decision:

- Inventory/manufacturer sync is **operational tooling**, not a portal feature.
- It will be added to the existing private ops project — local repo `mebelcenter-shopify`, deployed at `opsmebelcenter.vercel.app` — as a separate operational module/target.
- The `mebelcenter-shopify` repo must not be renamed or reorganized; B2BCenter sync is added alongside its existing Shopify supplier operations.
- v1 scope: stock/inventory only, SKU-matched, tenant-scoped, dry-run first then apply, with logs/report. No price/category/name/description/image updates; no auto-archive of missing feed products.

Full plan: `B2BCENTER_INVENTORY_SYNC_PLAN.md`.

---

## Warnings — Do NOT Change Casually

| Area | Reason |
|---|---|
| **`useAuth.ts`** | Complex auth bootstrap with race-condition guards. Changes risk breaking login. |
| **`TenantProvider.tsx`** | Session resolution + membership lookup. Tightly coupled to auth. |
| **`MembershipGuard` / `TenantActiveGuard` / `SignupGuard`** | Gate all dashboard access. |
| **`20260312123000_single_tenant_soft_cut.sql`** | Enforces single-tenant DB behavior. |
| **`enforce_single_tenant_fk()` trigger / `current_tenant_id()`** | Data isolation + RLS across all tables. |
| **Real Supabase credentials in `.env`** | Live URL and anon key. Do not commit. |

---

## Quick Start Commands

```bash
npm install        # Install dependencies
npm run dev        # Start dev server (port 5173)
npm run build      # Type-check + production build
npm run lint       # Lint check
npm run preview    # Preview production build
```
