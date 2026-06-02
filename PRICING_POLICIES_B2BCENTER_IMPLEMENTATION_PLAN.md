# Pricing Policies — b2bcenter Implementation Plan

> Plan-only document. No code, schema, or migrations changed by this step.
> Goal: client-specific pricing policies with priority **Product > Category > Default**,
> no stacking, most-specific match wins.

---

## 0. Quick context

- Stack: React + TS + Vite + Supabase, multi-tenant (tenant_id everywhere).
- Roles are read from `tenant_memberships.role` (`owner`, `admin`, `member`).
  `useAuth().isAdmin === membership?.role === 'owner' || 'admin'`.
- A *client* in this product = a `profiles` row with `role='company'`
  that has a `tenant_memberships` row with `role='member'` (or is `invitation_status='invited'`).
  Single-tenant memberships are enforced.
- Pricing today is driven by a single per-profile `commission_rate` (a flat percent off
  the catalog price). There is no per-category and no per-product discount.

A similar Pricing Policies feature shipped in lina-trade-portal; we are porting the
concept and adapting it to b2bcenter's schema, RLS helpers, and UI conventions.

---

## 1. Current price source

### Product fields
From `src/types/index.ts` (`Product`):
- `weboffer_price: number` — **canonical displayed price** (B2B price).
- `retail_price?: number` — retail comparison, **not used for B2B math**.
- `wholesale_price?: number` — legacy/aliased, not used in current pricing flow.
- `adjusted_price?: number` — **computed at runtime only** (not stored). Equals
  `weboffer_price * (1 - commission_rate)` for company users with a rate.

### Displayed price
Always `product.adjusted_price ?? product.weboffer_price`. Implementations:
- `src/components/ProductGridCard.tsx` (line ~111)
- `src/components/ProductQuickViewModal.tsx` (line ~67)
- `src/components/ProductListTable.tsx` (line ~179)
- `src/app/dashboard/products/[sku]/page.tsx` (line ~155)
- `src/app/dashboard/products/[sku]/AddToOrderModal.tsx` (line ~55)

### Cart price
`src/stores/cartStore.ts` `getEffectivePrice()` returns
`product.adjusted_price ?? product.weboffer_price ?? 0`. The cart **persists the
unit price at the moment of add** (`CartItem.price`, `CartItem.total`) via
`zustand/persist` under storage key `furnitrade-cart`.

### Order / quote price
`src/components/QuoteRequestModal.tsx` writes `quotes.items[].unit_price = item.price`
and `quotes.total = getTotal()`. Quote rows are then mapped to "orders" elsewhere
(`AdminOrdersView`, etc.) without recomputing price.

### Are there multiple price fields?
On disk: `retail_price`, `weboffer_price`, `wholesale_price`. **In active pricing logic
only `weboffer_price` is used**. `adjusted_price` is a computed wrapper field.

---

## 2. Existing client discount logic (`commission_rate`)

### Where it lives
- Column: `profiles.commission_rate` (decimal, 0.00–0.50). Migration:
  `supabase/migrations/20260312120200_add_commission_rate_to_profiles.sql`.
- Helper: `src/lib/priceUtils.ts` — `applyCommissionRate`, `shouldApplyCommission`,
  `formatCommissionRate`. Clamped to 0–0.5.
- Hook: `src/hooks/useCommissionRate.ts` — derives `commissionRate / hasDiscount /
  isCompanyUser` from `authStore.profile`.
- Read sites that fold `adjusted_price` into products:
  - `src/hooks/useQueryProducts.ts` (`applyCommissionToProducts`)
  - `src/app/dashboard/products/index.tsx` (duplicate local copy of the same fn)
  - `src/lib/orderSourceCart.ts`
- Edit UI: `src/app/dashboard/clients/index.tsx` (admin only) with mutation
  `src/hooks/useMutationClient.ts` → updates `profiles.commission_rate`.
- Invite flows also accept a commission rate:
  `src/hooks/useMutationInviteClient.ts`, `useMutationCreateClient.ts`,
  `useMutationDistributor.ts`.
- Notification: `sendNotification({ type: 'commission_changed', ... })` fires when
  admin changes a client's rate.

### Scope of effect
Catalog price display and cart/quote totals only. It does **not** modify product
rows in DB, does not affect category navigation, and is not used by analytics in
any pricing-sensitive way.

### Should pricing policies replace it?
**Fallback, do not delete (phase 1).** Strategy:
- Treat the existing `profiles.commission_rate` as the *legacy default* discount.
- New `pricing_policies` table provides per-client overrides at three levels
  (product / category / default). When a client has an *active* policy, the
  resolver uses policy values; if no policy exists or policy default is null,
  fall back to `profiles.commission_rate`.
- We **do not** drop the column or its edit UI in this feature. A follow-up
  task can migrate existing rates into pricing policies and retire the column.

This preserves backwards compatibility and avoids any data loss on demo tenants.

---

## 3. Current role/admin model

- Source of truth: `tenant_memberships(user_id, tenant_id, role)`. SQL helper
  `public.is_tenant_admin()` checks `role in ('owner','admin')`.
- App layer: `useAuth()` exposes
  `isAdmin = membership?.role === 'owner' || 'admin'` (`src/hooks/useAuth.ts`:671).
- **One conflicting site**: `src/app/dashboard/products/index.tsx:112` does
  `const isAdmin = profile?.role === 'admin'`. This is *legacy* and inconsistent
  with the rest of the app. We must not introduce more `profile.role`-based admin
  checks. The pricing-policies UI will rely exclusively on `useAuth().isAdmin`
  (i.e. `tenant_memberships.role`). We can also flag the existing
  `products/index.tsx` line as cleanup in a follow-up (out of scope here).
- `is_platform_admin` is unrelated (cross-tenant Anthropic-style super-admin) and
  is not the right guard for this feature.

---

## 4. Proposed database design

### 4.1 Tables

```
pricing_policies
  id                uuid PK (default gen_random_uuid())
  tenant_id         uuid NOT NULL (default current_tenant_id())
  client_user_id    uuid NOT NULL references profiles(id) on delete cascade
  name              text NOT NULL
  default_discount  numeric(5,4) NOT NULL default 0      -- 0.0000–0.5000
  is_active         boolean NOT NULL default true
  created_by        uuid references auth.users(id)
  created_at        timestamptz NOT NULL default now()
  updated_at        timestamptz NOT NULL default now()

  UNIQUE (tenant_id, client_user_id)   -- one active policy per client per tenant
  CHECK  (default_discount >= 0 AND default_discount <= 0.5)

pricing_policy_items
  id            uuid PK
  tenant_id     uuid NOT NULL (default current_tenant_id())   -- denormalized for RLS
  policy_id     uuid NOT NULL references pricing_policies(id) on delete cascade
  scope         text NOT NULL CHECK (scope in ('product','category'))
  product_sku   text                  -- required when scope='product'
  category_id   uuid                  -- required when scope='category', FK categories(id) on delete cascade
  discount      numeric(5,4) NOT NULL CHECK (discount >= 0 AND discount <= 0.5)
  created_at    timestamptz NOT NULL default now()

  CHECK ( (scope='product' AND product_sku IS NOT NULL AND category_id IS NULL)
       OR (scope='category' AND category_id IS NOT NULL AND product_sku IS NULL) )
  UNIQUE (policy_id, scope, product_sku, category_id)
```

Decisions:
- **Per-product overrides keyed by SKU**, not `product_id`. Wishlist already keys
  by SKU because CSV re-imports replace product rows. This keeps overrides stable
  across catalog re-imports — same reasoning as `wishlist_items.product_sku`.
- **Per-category overrides keyed by `category_id`** (FK to `categories.id`) since
  categories are normalized in this app.
- One policy per client per tenant — keeps resolver simple, matches lina port.
- `tenant_id` denormalized onto items so RLS uses a flat predicate.

### 4.2 Indexes

```
idx_pricing_policies_tenant            (tenant_id)
idx_pricing_policies_tenant_client     (tenant_id, client_user_id) UNIQUE
idx_pricing_policies_tenant_active     (tenant_id) WHERE is_active

idx_pricing_policy_items_policy        (policy_id)
idx_pricing_policy_items_tenant_sku    (tenant_id, product_sku) WHERE scope='product'
idx_pricing_policy_items_tenant_cat    (tenant_id, category_id) WHERE scope='category'
```

The `(tenant_id, product_sku)` and `(tenant_id, category_id)` partial indexes make
the resolver query (see §5) point-lookup fast.

### 4.3 RLS

Re-use existing helpers: `public.current_tenant_id()`, `public.is_tenant_admin()`.

```
-- pricing_policies
ENABLE RLS

policy "pp_admin_all"
  FOR ALL TO authenticated
  USING (tenant_id = current_tenant_id() AND is_tenant_admin())
  WITH CHECK (tenant_id = current_tenant_id() AND is_tenant_admin());

policy "pp_client_read_own_active"
  FOR SELECT TO authenticated
  USING (
    tenant_id = current_tenant_id()
    AND client_user_id = auth.uid()
    AND is_active = true
  );

-- pricing_policy_items
ENABLE RLS

policy "ppi_admin_all"
  FOR ALL TO authenticated
  USING (tenant_id = current_tenant_id() AND is_tenant_admin())
  WITH CHECK (tenant_id = current_tenant_id() AND is_tenant_admin());

policy "ppi_client_read_own_active"
  FOR SELECT TO authenticated
  USING (
    tenant_id = current_tenant_id()
    AND EXISTS (
      SELECT 1 FROM pricing_policies p
      WHERE p.id = pricing_policy_items.policy_id
        AND p.client_user_id = auth.uid()
        AND p.is_active
    )
  );
```

No anon access. No public-read. Mirrors the existing
`tenant_*_select` / `tenant_*_*_admin` naming pattern used in
`supabase/tenant-data-isolation.sql`.

### 4.4 Defaults
`tenant_id` defaults to `current_tenant_id()` on insert (matches every other
tenant table in this repo).

### 4.5 Risks with current schema
- `commission_rate` overlap is the main risk — covered by §2 fallback strategy.
- SKU-based overrides assume SKU stability. SKU uniqueness is already enforced
  per tenant (`idx_products_tenant_sku_unique`), so this is safe.
- `categories.id` is `on delete set null` from products today; for our items we
  use `on delete cascade` so deleted categories drop dead overrides.
- No risk to existing tenant isolation: new tables follow the same pattern.

---

## 5. Proposed frontend architecture

### Single pricing helper — no duplication
Create **one** module, `src/lib/pricing.ts`, that owns the resolution logic and
the formatting helpers. All consumers import from here. The existing
`src/lib/priceUtils.ts` becomes a thin re-export so call sites keep working
while we migrate them in phase 4.

```ts
// src/lib/pricing.ts
export type PricingPolicyItem = { scope:'product'|'category'; product_sku?:string; category_id?:string; discount:number }
export type ResolvedPolicy   = { default_discount:number; items: PricingPolicyItem[] }
export type PriceContext     = { policy: ResolvedPolicy | null; legacyCommissionRate?: number }

export function resolveDiscount(product: Product, ctx: PriceContext): number { ... }
export function applyDiscount(price: number, rate: number): number { ... }
export function priceFor(product: Product, ctx: PriceContext): { base:number; final:number; rate:number; source:'product'|'category'|'default'|'legacy'|'none' }
```

Resolution order (no stacking):
1. policy item where `scope='product' && product_sku === product.sku` → use that rate
2. else policy item where `scope='category' && category_id === product.category_id` → use that rate
3. else `policy.default_discount` if a policy exists
4. else legacy `profiles.commission_rate` (fallback)
5. else 0

### Hooks
- `src/hooks/usePricingPolicy.ts` — client-side: fetch the current user's
  *own* active policy (one row + its items). Returns `ResolvedPolicy | null`.
  Used by all catalog/cart components.
- `src/hooks/usePricingPolicyForClient.ts` — admin-side: fetch a specific
  client's policy (or `null`). Used by the admin editor.
- `src/hooks/useMutationPricingPolicy.ts` — admin-side: upsert policy +
  reconcile items (delete-and-insert in a single tx, or RPC).
- React Query keys under `['workspace', 'pricing-policy', ...]` consistent with
  the rest of the app.

### Types
Add to `src/types/index.ts`:
```ts
export interface PricingPolicy { id; tenant_id; client_user_id; name; default_discount; is_active; created_at; updated_at }
export interface PricingPolicyItem { id; policy_id; scope:'product'|'category'; product_sku?:string|null; category_id?:string|null; discount:number }
export interface ResolvedPricingPolicy { policy: PricingPolicy; items: PricingPolicyItem[] }
```

### Avoiding duplication
- Replace every `product.adjusted_price ?? product.weboffer_price` site with a
  single `priceFor(product, ctx)` call (phase 4). The `adjusted_price` field on
  the `Product` type is kept (back-compat) but stops being the source of truth.
- `cartStore.getEffectivePrice` is removed; cart receives a `unitPrice` argument
  from the caller (the components already know `ctx`).

---

## 6. Admin UI plan

### Route
- `src/app/dashboard/pricing-policies/index.tsx` → list view
- `src/app/dashboard/pricing-policies/[clientId]/page.tsx` → editor for one client
- Registered in `src/App.tsx` under the `/dashboard` route group, lazy-loaded
  like the others.

### Sidebar
- Add a new admin-only entry under "Main Navigation" in
  `src/components/SidebarNav.tsx`:
  ```ts
  { titleKey: 'nav.pricingPolicies', href: '/dashboard/pricing-policies',
    icon: Tags, adminOnly: true }
  ```
- Sits next to "Clients" (also admin-only).

### Admin guard
- Route element wraps content in a small `<AdminOnly>` check using
  `useAuth().isAdmin` (the membership-based one). Non-admins get redirected to
  `/dashboard`. We **do not** use `profile.role === 'admin'`.

### List page
- Two-column layout: clients on the left (reuse `useQueryClients`), policy
  summary on the right (default %, # product overrides, # category overrides,
  active toggle). Click → opens the per-client editor.

### Editor page sections
1. **Header**: client name, email, active toggle, save / delete buttons.
2. **Default discount**: single numeric input (0–50%).
3. **Category overrides**: table with category picker (from
   `useCategoryHierarchy`) + discount input + remove. "Add row" button.
4. **Product overrides**: SKU-based picker — async search over `products` by
   `name` / `sku` — plus discount input + remove.
5. **Live preview** (nice-to-have): show what a few sample products would price
   at, using the same `priceFor()` helper that the catalog uses. Helps QA the
   priority rules.

### i18n
Add keys to both `src/locales/bg.json` and `src/locales/en.json` under
`pricingPolicies.*`:
- `pricingPolicies.title`, `.subtitle`
- `.defaultDiscount`, `.defaultDiscountHelp`
- `.categoryOverrides`, `.productOverrides`
- `.addCategory`, `.addProduct`, `.removeOverride`
- `.priorityNote` — explains *Product > Category > Default*, no stacking
- `.savedToast`, `.errorToast`
- `nav.pricingPolicies` for the sidebar label

---

## 7. Product / catalog integration plan

All read sites go through `priceFor(product, ctx)`. Sites to update:

| File | Change |
|------|--------|
| `src/hooks/useQueryProducts.ts` | Stop computing `adjusted_price`. Components read price via `priceFor()` using `usePricingPolicy()` context. |
| `src/app/dashboard/products/index.tsx` | Remove local duplicate of `applyCommissionToProducts`. Use `priceFor()`. |
| `src/components/ProductGridCard.tsx` | Replace `displayPrice` derivation. Show original price + discount badge when `rate > 0`. |
| `src/components/ProductQuickViewModal.tsx` | Same. |
| `src/components/ProductListTable.tsx` | Same. |
| `src/app/dashboard/products/[sku]/page.tsx` | Same — detail page. |
| `src/app/dashboard/products/[sku]/AddToOrderModal.tsx` | Use `priceFor()` and pass `unitPrice` to cart. |
| `src/app/dashboard/wishlist/*` | Wishlist rendering of price — switch to `priceFor()`. |
| `src/lib/orderSourceCart.ts` | Replace commission folding with policy resolution. |

Keep the discount badge UX identical so the demo looks consistent.

---

## 8. Cart / order risk analysis

### Current behaviour
- Cart persists `price` and `total` at the moment of add (`zustand/persist`).
- Quote insert sends `unit_price = item.price`. The DB does **not** recompute.

### Risks
- A client could add an item, then admin updates their policy — the cart still
  holds the *old* price. We accept that for the demo (same behaviour as today
  with `commission_rate`).
- A client whose policy is removed mid-session would see catalog prices change
  but cart prices stay. Mitigation: when the policy query invalidates, also
  invalidate the cart view (display only — do not silently mutate persisted
  prices). The recalculation only takes effect when the user re-adds or edits
  the line.
- No need to add `final_price` / `base_price` columns to `CartItem` for the
  demo. If we want auditing later we can record `base_price` + `discount_rate`
  + `source`, but that is out of scope here.

### Order totals
- `QuoteRequestModal` reads from cart, so the same unit price flows to
  `quotes.items[].unit_price` and `quotes.total`. As long as cart writes the
  resolved final price (via `priceFor()`), order totals match what the user saw.

---

## 9. RLS / security plan (summary)

- Admin (owner/admin via `tenant_memberships`) — full CRUD in own tenant only.
- Member/client — `SELECT` only, only when `policy.client_user_id = auth.uid()`
  and `is_active`. Items inherit through the policy join.
- No anon, no `public` role grants, no `USING (true)`.
- No change to existing RLS policies on `profiles`, `products`, `categories`,
  `quotes`, etc. We only add new policies on new tables.
- `tenant_id` default uses `current_tenant_id()` like every other tenant table
  in this repo — no path for cross-tenant insert.
- The admin guard in the UI is *defense in depth*; the DB is the source of truth.

---

## 10. Implementation phases

### Phase 1 — SQL (this PR's first commit)
- Add new migration `supabase/migrations/<ts>_create_pricing_policies.sql`:
  tables, indexes, RLS, defaults. No data migration of existing
  `commission_rate`.
- Verify locally with `supabase db reset` (or equivalent) on a scratch project.

### Phase 2 — Types + helper + hooks
- `src/types/index.ts` additions.
- `src/lib/pricing.ts` resolver + formatter.
- `src/hooks/usePricingPolicy.ts` (client-side, read own).
- `src/hooks/usePricingPolicyForClient.ts` (admin read).
- `src/hooks/useMutationPricingPolicy.ts` (admin write).
- Unit tests for resolver priority (Product > Category > Default > legacy > 0).

### Phase 3 — Admin route + UI
- New route, lazy-loaded in `src/App.tsx`.
- Sidebar entry in `SidebarNav.tsx` (admin-only).
- List + editor page, with i18n.
- Admin guard via `useAuth().isAdmin`.

### Phase 4 — Product display integration
- Wire `priceFor()` into all catalog read sites (see §7 table).
- Keep `adjusted_price` on `Product` for back-compat but stop populating it; or
  populate it via the resolver in `useQueryProducts` so legacy reads keep
  working during the migration.

### Phase 5 — Cart / order integration
- Replace `cartStore.getEffectivePrice` with a caller-supplied `unitPrice`.
- Confirm `QuoteRequestModal` still totals from cart unchanged.

### Phase 6 — Client page shortcut
- On `/dashboard/clients` row, add a small "Pricing policy" button (admin only)
  that deep-links to `/dashboard/pricing-policies/<clientId>`.

### Phase 7 — Build / lint / smoke
- `npm run build` — must pass.
- `npm run lint` — must pass.
- Manual smoke: admin creates a policy with default 10%, category override 15%,
  product override 20%; log in as the client; verify catalog prices, cart total,
  and order total match the expected priority.

Phases 1–2 are safe to merge independently of UI. Phases 3+ depend on phase 2.

---

## 11. Files expected to change

### New
- `supabase/migrations/<ts>_create_pricing_policies.sql`
- `src/lib/pricing.ts`
- `src/hooks/usePricingPolicy.ts`
- `src/hooks/usePricingPolicyForClient.ts`
- `src/hooks/useMutationPricingPolicy.ts`
- `src/app/dashboard/pricing-policies/index.tsx`
- `src/app/dashboard/pricing-policies/[clientId]/page.tsx`
- (optional) `src/components/pricing/PolicyEditor.tsx`,
  `CategoryOverrideRow.tsx`, `ProductOverrideRow.tsx`
- (optional) `src/lib/pricing.test.ts`

### Modified
- `src/types/index.ts`
- `src/App.tsx` — register routes
- `src/components/SidebarNav.tsx` — add nav item
- `src/hooks/useQueryProducts.ts` — drop commission fold OR replace with policy
- `src/app/dashboard/products/index.tsx` — drop duplicate fn, fix legacy
  `profile.role` check
- `src/components/ProductGridCard.tsx`
- `src/components/ProductQuickViewModal.tsx`
- `src/components/ProductListTable.tsx`
- `src/app/dashboard/products/[sku]/page.tsx`
- `src/app/dashboard/products/[sku]/AddToOrderModal.tsx`
- `src/lib/orderSourceCart.ts`
- `src/stores/cartStore.ts` — remove `getEffectivePrice`, accept `unitPrice`
- `src/components/CartDrawer.tsx`
- `src/app/dashboard/clients/index.tsx` — add "Pricing policy" deep-link button
- `src/locales/bg.json`, `src/locales/en.json` — new keys
- `src/lib/priceUtils.ts` — re-export from `lib/pricing.ts` (back-compat shim)

### NOT touched
- Econt, Stripe, Resend edge functions, CSV import wizard, platform-admin
  console, demo data cleanup — all out of scope per the rules.
- Existing RLS on profiles/products/categories/quotes — untouched.
- The `profiles.commission_rate` column — kept as legacy fallback.

---

## 12. Open questions / risks

1. **Files referenced in the task that do not exist in this repo:**
   - `supabase/P0_fix_quotes_rls_member_isolation.sql` — not present. Equivalent
     guarantees come from `tenant-data-isolation.sql`'s `tenant_quotes_*`
     policies (`is_tenant_admin() OR user_id = auth.uid()`). **Confirm** that no
     additional P0 policy is expected.
   - `supabase/DO_NOT_RUN_LEGACY_SQL.md` — not present. **Confirm** which legacy
     `.sql` files in `supabase/` are deprecated so we don't accidentally re-run
     them during local DB resets.
2. **Discount cap**: code clamps to 50%. Confirm 50% is still the policy
   maximum, including for product overrides.
3. **Legacy fallback duration**: should the resolver always fall through to
   `profiles.commission_rate` when a client has *no* policy at all, or only
   when there is no policy *and* no admin has yet visited the pricing-policies
   page for that client? Recommendation: always fall through. No surprise loss
   of discount for existing demo data.
4. **Policy uniqueness**: one active policy per (tenant, client). Is that
   acceptable, or do we want versioning/history? Recommendation: no history in
   v1 — keep it simple, add `created_at`/`updated_at` for auditing.
5. **Category inheritance**: if a product belongs to a *subcategory* and the
   policy has a discount on the *parent* category, does the parent's discount
   apply? Recommendation for v1: **no, exact `category_id` match only**. Admin
   can add both rows if they want broader coverage. This matches the lina port
   and keeps the resolver O(1).
6. **One conflicting `isAdmin` check** at `src/app/dashboard/products/index.tsx:112`
   uses `profile?.role === 'admin'`. The pricing-policies feature does **not**
   add to this debt, and we recommend a separate small cleanup PR to switch it
   to `useAuth().isAdmin`. Flag-only here.
7. **Cart pricing drift** when an admin edits a policy while a client has items
   in cart: confirm we are happy to *not* mutate persisted prices in v1.
8. **Search UX in the product-override picker**: confirm async search by
   `name` / `sku` against `products` is acceptable (vs. picking from a paginated
   table).

---

## Summary findings

- Pricing today = `profiles.commission_rate` × `weboffer_price`, computed at
  read time, rendered as `adjusted_price` everywhere. Cart and quotes persist
  the resolved price at the moment of add — no DB-side pricing.
- Tenant isolation is solid (`current_tenant_id()` + `is_tenant_admin()`); the
  new tables can drop straight into that pattern.
- Admin model = `tenant_memberships.role`. One stray `profile.role` check in
  `products/index.tsx` exists — we will not extend that debt.
- The cleanest port is: new `pricing_policies` + `pricing_policy_items`, one
  pricing resolver in `src/lib/pricing.ts`, all catalog/cart read sites moved
  to that resolver. Keep `commission_rate` as a graceful fallback in v1.

## Phase 1 SQL recommendation

Land Phase 1 as a single migration file:
`supabase/migrations/<timestamp>_create_pricing_policies.sql`

It must:
1. `create extension if not exists pgcrypto;` (for `gen_random_uuid()` if not
   already enabled).
2. Create `pricing_policies` and `pricing_policy_items` per §4.1, with the
   `CHECK`, `UNIQUE`, and FK constraints exactly as written.
3. Set `tenant_id default public.current_tenant_id()` on both tables.
4. Create the indexes from §4.2.
5. `alter table ... enable row level security` on both tables.
6. Create the four RLS policies in §4.3 — admin-all + client-read-own-active —
   nothing else. **No `public` grants, no anon access, no `USING (true)`.**
7. Wrap everything in `begin; ... commit;` like
   `supabase/tenant-data-isolation.sql` does.
8. Do **not** touch `profiles.commission_rate`, do **not** backfill, do **not**
   alter any existing policy.

After it ships, phase 2 (types + resolver + hooks) can be developed and tested
independently, with no user-visible behaviour change until the UI lands in
phase 3.
