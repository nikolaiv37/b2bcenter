# B2BCenter — Loading Performance Audit

Catalog size at audit time: **10,345 products**, single-tenant deployment.
Scope: read-only audit. No code changed except creating this document.
Out of scope (per instructions): dashboard redirect / default route — confirmed correct, not investigated.

---

## 1. Files inspected

- `src/App.tsx` — router, React Query client config
- `src/main.tsx` — bootstrap
- `src/hooks/useAuth.ts` — auth provider / profile + company loading
- `src/lib/tenant/TenantProvider.tsx` — tenant resolution + `tenant_memberships` query
- `src/lib/tenant/resolveTenant.ts` — tenant resolution helper (single-tenant, no-op)
- `src/lib/app/AppContext.tsx` — app-level context
- `src/components/AuthGuard.tsx`, `src/components/guards/MembershipGuard.tsx`, `src/components/guards/TenantActiveGuard.tsx` — route guards
- `src/app/dashboard/layout.tsx` — dashboard shell
- `src/app/dashboard/overview.tsx` — `/dashboard` overview page
- `src/app/dashboard/categories/index.tsx` — `/dashboard/categories`
- `src/app/dashboard/products/index.tsx` — `/dashboard/products`
- `src/hooks/useCategoryHierarchy.ts`, `src/hooks/useCategoryOptions.ts`, `src/hooks/useQueryProducts.ts`
- `src/lib/manufacturers.ts` — manufacturer filter option resolver
- `supabase/migrations/*` — table definitions and indexes

---

## 2. Query waterfall / likely load order on initial `/dashboard`

```
1. App mounts
   └─ TenantProvider mounts
        refresh() runs (triggered by location.pathname effect)
        ├─ supabase.auth.getSession()              [serial, 800ms timeout on 1st bootstrap]
        └─ tenant_memberships?select=...tenants(...tenant_domains(...))  [serial after getSession]
              (retry path: if no row, waits 600ms then re-queries)
        → sets isBootstrapping=false, membershipChecked=true
   • While isBootstrapping / !membershipChecked:
       MembershipGuard renders a full-screen spinner — SHELL DOES NOT RENDER.

2. useAuth onAuthStateChange fires (INITIAL_SESSION)
   • Also triggers a SECOND TenantProvider.refresh() via its own onAuthStateChange.
   • Once tenantId is known: loadOrCreateProfile()
        ├─ profiles?select=* (eq id, eq tenant_id)        [serial]
        ├─ (legacy fallback) profiles?select=* (eq id)    [conditional]
        └─ companies?select=* (eq id, eq tenant_id)       [serial after profile]
   • AuthGuard onboarding check waits for membershipChecked + profile + company,
     and only then sets hasCheckedOnboarding — it shows a spinner until then.

3. DashboardLayout renders
   └─ quotes count query for status badges (in 'new'/'pending'), refetchInterval 30s

4. DashboardOverview renders
   ├─ dashboard-summary query: 1 quotes select + 3 products count(exact) queries
   └─ after requestIdleCallback: dashboard-stats query
        (many quotes selects + product count queries + per-item category lookups)
```

**Effective critical path before any shell pixel:** `getSession` → `tenant_memberships` → (membership retry?) → profile → company → onboarding check. All serial.

---

## 3. Blocking render dependencies

| Step | Blocks what | Notes |
|---|---|---|
| `TenantProvider` `isBootstrapping` / `membershipChecked` | **Entire dashboard shell** | `MembershipGuard` shows a bare spinner until `tenant_memberships` resolves. |
| `AuthGuard` `hasCheckedOnboarding` | Entire dashboard shell | Waits for `membershipChecked` **and** profile **and** company to load, then runs onboarding logic. Another full-screen spinner. |
| `getSession()` → membership query | Serial chain | Membership query cannot start until `getSession()` resolves. |
| Membership "retry" path | +600ms minimum when first lookup returns no row | Adds latency on cold sessions. |

Net effect: the shell waits on **membership + profile + company** before rendering, even though the sidebar/header need almost none of it.

---

## 4. Duplicated queries found

1. **`tenant_memberships` re-runs on every navigation.** `TenantProvider`'s bootstrap effect has deps `[location.pathname, refresh]`, so `refresh()` (getSession + membership query) fires on **every route change** — navigating to `/dashboard/categories` or `/dashboard/products` re-issues the membership query. It also re-runs on window `focus` and `visibilitychange`. There is no cache: the result lives in component state, not React Query.
2. **Two `onAuthStateChange` subscriptions.** `TenantProvider` and `useAuth` each register their own. On `INITIAL_SESSION` both fire — `TenantProvider` runs `refresh()` a second time (deduped within a single in-flight run by `refreshInFlightRef`, but a fresh run afterwards is not deduped).
3. **`useAuth()` is called by many components** (`AuthGuard`, `DashboardLayout`, `AppContextProvider`, `overview`, `products`, `categories`, …). Each instance independently:
   - subscribes to `onAuthStateChange`,
   - registers `focus` + `visibilitychange` listeners that call `loadOrCreateProfile`,
   - opens a realtime channel `profile-${tenantId}-${user.id}`.
   The actual profile *fetch* is deduped by the module-level `authBootstrapState`, but the **subscriptions/listeners/channels are multiplied** per mounted consumer. Every window focus can trigger multiple `loadOrCreateProfile` passes (profiles + companies selects).
4. **Categories list is fetched by 3 separate hooks** with different query keys: `useCategoryHierarchy` (`['workspace','category-hierarchy',...]`), `useCategoryOptions` (`['workspace','categories','options',...]`), and the products page inline `['workspace','products','categories-for-filter']`. Same `categories` table, three cache entries.

---

## 5. Heavy queries found

| Query | Where | Cost |
|---|---|---|
| **Category hierarchy product scan** | `useCategoryHierarchy` | Pages through **all 10,345 visible products** in 1000-row chunks → ~11 sequential round-trips, fetching `category_id, main_image` per row, only to compute per-category counts client-side. This is the dominant cost of `/dashboard/categories` (main view). |
| **Manufacturer options scan** | `lib/manufacturers.ts` `fetchManufacturerOptions` | Pages through the **entire catalog's `manufacturer` column** → ~11 sequential round-trips. Runs on `/dashboard/products` on first render and on `/dashboard/categories` product view. |
| **`select('*', { count: 'exact' })`** | products page + categories product view | `exact` count forces a full count over the filtered set on every filter/page change. `select('*')` also pulls every column (descriptions, image arrays) for 150 rows on initial products load. |
| **`dashboard-stats`** | overview | Multiple `quotes` selects (all orders, this month, last month, recent) + 3 product count queries + per-quote-item category lookups. Deferred via `requestIdleCallback`, so not shell-blocking, but still heavy. |
| **`tenant_memberships` nested join** | TenantProvider | Joins `tenants` → `tenant_domains`. Single-row (table is `unique(user_id)`), so cheap at the DB; cost is the *serial position* and *re-fetch frequency*, not row volume. |

---

## 6. Answers to the specific questions

1. **What runs on initial `/dashboard` load:** `getSession` → `tenant_memberships` (+ optional retry) → `profiles` (+ optional legacy `profiles`) → `companies` → `quotes` status-badge count → `dashboard-summary` (1 quotes + 3 product counts) → deferred `dashboard-stats`.
2. **What blocks the shell:** `TenantProvider.isBootstrapping`/`membershipChecked` and `AuthGuard.hasCheckedOnboarding`. Both gate the whole shell behind membership + profile + company.
3. **Is `tenant_memberships` duplicated:** Yes — re-fetched on every route change and on focus/visibility; ~2× during initial bootstrap (two `onAuthStateChange` paths).
4. **Does it have enough caching:** No. It is not in React Query and has no `staleTime`. It is component state re-derived on every navigation.
5. **Profile/company/tenant duplication:** The fetches are deduped (module-level `authBootstrapState`; tenant in `refreshInFlightRef`), but `useAuth` is mounted many times and each instance multiplies `onAuthStateChange` subscriptions, focus/visibility listeners, and realtime channels — causing repeat `loadOrCreateProfile` (profiles + companies) on focus.
6. **Does `/dashboard/categories` load product data unnecessarily:** Yes. The main categories view pulls **all 10,345 products** (paged) purely to count them and pick a fallback image — no product rows are displayed on that view.
7. **Does `/dashboard/products` load too much before rendering:** Yes. It fires 4 queries in parallel — `categories-for-filter`, paginated products (`select('*')`, 150 rows), `count: 'exact'`, and `manufacturer-options` (full-catalog scan). The manufacturer scan and exact count are the slow ones.
8. **Are category/product counts expensive:** Category counts — yes (full product scan client-side). Product counts — `count: 'exact'` is moderately expensive and recomputed on every filter/page change.
9. **Do manufacturer/filter queries scan too many products:** Yes — `fetchManufacturerOptions` reads every product row's `manufacturer` (paged, ~11 round-trips) on initial load of both heavy pages.
10. **Are product/category queries cached well:** Mixed. `useCategoryHierarchy` `staleTime: 30s`; `useCategoryOptions` and `categories-for-filter` `staleTime: 5min`; **products paginated, products count, and manufacturer-options on the categories page have no `staleTime`** (default 0 → refetch on remount). No `gcTime` tuning anywhere.
11. **Missing DB indexes:** `tenant_memberships` is fine (`unique(user_id)` covers the lookup — not a DB bottleneck). `products` would benefit from composite indexes for the ordered/paginated and manufacturer-scan paths (see §9).
12. **Could the shell render earlier with skeletons:** Yes — this is the single biggest win. The sidebar/header need only `userId`/`isAdmin`/basic profile; they should not wait on `companies` or the onboarding check.

---

## 7. Low-risk quick wins

1. **Add `staleTime`/`gcTime` to the heavy product queries** that currently have none: products `paginated`, products `count`, and the categories page `manufacturer-options` / `category-manufacturers`. Suggest `staleTime: 60_000`, `gcTime: 5min`. Pure cache config — no behavior change.
2. **Stop re-running `tenant_memberships` on every navigation.** Change `TenantProvider`'s bootstrap effect so `refresh()` runs once on mount + on auth-state changes, **not** on `location.pathname`. Custom-domain resolution is host-based (`normalizeHost(window.location.host)`), not path-based, so dropping the `pathname` dependency does not affect tenant resolution. (Medium-risk in practice — verify focus/visibility behavior — but high value.)
3. **Switch `count: 'exact'` → `count: 'estimated'`** (or `'planned'`) for the products list total. The displayed "N products" tolerates approximation; exact count is the expensive part.
4. **`select('*')` → explicit column list** on the products list query (drop `description`, large `images` arrays not needed for cards). Smaller payload, faster transfer.
5. **De-duplicate the categories fetch:** have `useCategoryOptions` and the products page `categories-for-filter` share one query key, or derive the filter list from `useCategoryHierarchy`.

## 8. Medium-risk optimizations

6. **Render the dashboard shell with skeletons while data loads.** Let `MembershipGuard`/`AuthGuard` render the sidebar + header immediately once `user` exists, and only gate the `<Outlet/>` content (or specific widgets) on membership/profile/company. Keeps all tenant/membership/onboarding checks — they just no longer block the chrome.
7. **Replace the client-side category count scan** in `useCategoryHierarchy`. Options: a Postgres RPC / view that returns `category_id, count(*)` grouped, or a per-category `head:true` count. Eliminates the ~11-round-trip full-catalog scan on `/dashboard/categories`.
8. **Cache manufacturer options at tenant scope** with a long `staleTime` (manufacturers change rarely), and ideally back it with a `SELECT DISTINCT manufacturer` RPC instead of paging the whole table.
9. **Collapse the two `onAuthStateChange` subscriptions** and move auth/tenant subscription logic into the providers only (not every `useAuth` consumer). Consumers should read from context/store, not each register listeners + realtime channels.
10. **Move `tenant_memberships` into React Query** keyed by `user.id` with a sensible `staleTime`, so navigation reuses the cache.

## 9. DB index recommendations

`tenant_memberships` needs **no** new index — `unique(user_id)` already serves the lookup; it is not a DB-level bottleneck.

For `products` (10k+ rows), consider:
- `CREATE INDEX idx_products_tenant_created ON products(tenant_id, created_at DESC);` — supports the ordered paginated list.
- `CREATE INDEX idx_products_tenant_manufacturer ON products(tenant_id, manufacturer);` — supports the manufacturer-options ordered scan.
- `CREATE INDEX idx_products_tenant_visible_category ON products(tenant_id, is_visible, category_id);` — supports the category-hierarchy / category-filter queries (current `idx_products_visible_category` lacks `tenant_id`).
- For the overview status-badge count: `CREATE INDEX idx_quotes_tenant_status ON quotes(tenant_id, status);`

These are additive (non-destructive) and should be applied via a new migration, ideally `CREATE INDEX CONCURRENTLY`.

## 10. Recommended implementation order

1. **Shell-first render with skeletons** (§8.6) — biggest perceived-latency win, no data-logic change.
2. **Stop `tenant_memberships` re-fetch on navigation** (§7.2) — removes a query from every route change.
3. **Cache config: `staleTime`/`gcTime`** on uncached product/manufacturer queries (§7.1).
4. **`count: 'estimated'` + explicit columns** on products list (§7.3–7.4).
5. **DB indexes migration** (§9).
6. **Replace category count scan with an RPC/aggregate** (§8.7).
7. **Manufacturer options via DISTINCT RPC** (§8.8).
8. **Consolidate auth/tenant subscriptions** (§8.9) and move membership into React Query (§8.10).

## 11. What should NOT be optimized yet

- The redirect / default route — confirmed correct, explicitly out of scope.
- RLS policies, tenant checks, auth/security flow, custom-domain resolution — do not touch.
- Product/category business logic, pricing/commission, lifecycle filtering — leave behavior identical.
- The `dashboard-stats` heavy query — already deferred via `requestIdleCallback` and non-blocking; defer until after the shell + membership work lands.
- The legacy profile/company tenant-backfill branches in `useAuth` — correctness-sensitive; leave alone during a perf pass.

---

## 12. Summary answers

- **Likely root causes:** (a) the shell is gated behind a serial chain — `getSession → tenant_memberships → profile → company → onboarding check` — rendering only a spinner until all resolve; (b) `tenant_memberships` re-fetches on every navigation with no cache; (c) `/dashboard/categories` scans the entire 10k-product catalog client-side for counts; (d) `/dashboard/products` runs an exact count + a full-catalog manufacturer scan + a `select('*')` 150-row fetch before showing the grid; (e) several heavy queries have no `staleTime`.
- **Recommended first fixes:** render the shell with skeletons (decouple chrome from membership/profile/company), stop re-fetching `tenant_memberships` on navigation, and add `staleTime` to the uncached product/manufacturer queries.
- **Is `tenant_memberships` a real bottleneck?** It is **one part of the waterfall**, not the heavy query. The single-row lookup is cheap at the DB (`unique(user_id)` index). Its impact comes from being a *serial, shell-blocking* step that *re-runs on every navigation* and is preceded by `getSession()` (and sometimes a 600ms retry). Fix the blocking + re-fetch, not the query itself.
- **Do `/dashboard/categories` and `/dashboard/products` have separate heavy-load causes?** Yes. Categories: the full-catalog product scan inside `useCategoryHierarchy` for counts/images. Products: the `count: 'exact'` + full-catalog manufacturer-option scan + `select('*')` payload. They share the blocking shell/membership cost but their page-specific heavy work is different.

---

## 13. Proposed first safe implementation prompt

> Implement shell-first rendering for the B2BCenter dashboard so the sidebar and header paint immediately while data loads, without changing any auth, RLS, tenant, membership, onboarding, or redirect behavior.
>
> Scope:
> 1. In `MembershipGuard` and `AuthGuard`, allow `DashboardLayout` (sidebar + header) to render as soon as `user` exists. Keep all membership, onboarding, and tenant-active checks intact — but instead of replacing the whole screen with a spinner, gate only the routed `<Outlet/>` content (or show skeletons inside it) while `membershipChecked` / `hasCheckedOnboarding` are pending. If `membership` is missing after the check, still render `NoAccessPortal`; if onboarding is required, still redirect — behavior must be unchanged, only the timing of the chrome paint differs.
> 2. In `TenantProvider`, remove `location.pathname` from the bootstrap effect's dependencies so `tenant_memberships` is fetched once on mount + on `onAuthStateChange`, not on every route change. Confirm tenant resolution still works (it is host-based, not path-based) and custom-domain resolution is unaffected.
> 3. Add `staleTime: 60_000` to the product/manufacturer queries that currently have none (products `paginated`, products `count`, categories-page `manufacturer-options` / `category-manufacturers`).
>
> Do not change RLS, query filters, tenant checks, pricing, or product/category logic. Verify by loading `/dashboard`, `/dashboard/categories`, and `/dashboard/products` and confirming the shell appears before data and that guarded redirects still fire correctly.
