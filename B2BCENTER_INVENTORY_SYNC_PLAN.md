# B2BCenter Inventory Sync Plan

> Created: 2026-05-21 | Status: Planning only — no code in this document's task scope.

This document is a **plan**. It does not change any application code. It defines how
future B2BCenter inventory sync should be built and where it should live.

---

## 1. Goal

Keep B2BCenter product stock/inventory in sync with manufacturer/supplier feeds
(initially the Greek manufacturer) without manual re-imports.

- Update **stock/inventory levels only** on existing B2BCenter products.
- Match feed rows to portal products by **SKU**.
- Run as a controlled, reviewable operation: **dry-run first, apply second**.
- Produce a log/report for every run.

This is an **operational sync**, not a catalog import. It does not create products,
change prices, or restructure the catalog.

---

## 2. Why `opsmebelcenter` Is the Correct Place

Inventory/manufacturer sync should **not** be built into the normal B2BCenter
client/admin portal UI. It is operational tooling and belongs in the private ops project.

- A separate private ops project already exists:
  - **Local repo/folder:** `mebelcenter-shopify`
  - **Deployed private ops app:** `opsmebelcenter.vercel.app`
  - **Current purpose:** Shopify supplier operations.
- That project is already the private control panel for supplier operations, with
  existing Shopify-related scripts and tooling. It is the natural home for another
  supplier-sync target.
- Keeping sync out of the portal means:
  - No operational/admin-only complexity leaking into the client/admin UI.
  - Sync can run with elevated/service credentials in a private environment.
  - Dry-run/apply/report workflows live where operators already work.

### Constraints for the ops project

- **Do not rename** the `mebelcenter-shopify` repo.
- **Do not reorganize** the whole project.
- Add B2BCenter inventory sync as a **separate operational module/target**, alongside
  the existing Shopify supplier operations — not as a replacement for them.
- Treat `opsmebelcenter.vercel.app` as a private control panel that now serves both
  Shopify supplier ops and B2BCenter/Supabase inventory sync.

---

## 3. v1 Scope

### In scope (v1)

- **Stock/inventory only.**
- Match by **SKU**.
- **Tenant-scoped** — writes restricted to the single B2BCenter tenant.
- **Supplier/manufacturer-scoped** if needed — limit a run to one manufacturer's products.
- **Dry-run first**, apply only after a dry-run.
- Write **logs/report** for every run.

### Explicitly out of scope (v1)

- No price updates.
- No category updates.
- No name/description updates.
- No image updates.
- No creation of new products from the feed.
- No auto-archive of products that are missing from the feed.

Missing-from-feed handling is deferred to a later phase (see Future Phases). In v1,
a product not present in the feed is simply left untouched.

---

## 4. Data Mapping Assumptions

These are working assumptions to be validated against a real feed before implementation.

| Feed concept | B2BCenter target | Notes |
|---|---|---|
| Feed SKU | `products.sku` | Primary and only match key in v1. |
| Feed stock quantity | `products` stock/quantity column | Confirm exact column name during implementation. |
| Feed manufacturer/supplier | `products.manufacturer` | Used for supplier/manufacturer-scoped runs. |
| (none) | `products.tenant_id` | All writes scoped to the single B2BCenter tenant. |

Assumptions:

- SKUs are unique per tenant and stable across feed runs.
- The feed provides an absolute stock quantity (not a delta).
- A feed row with no SKU, or a SKU that does not exist in B2BCenter, is **skipped and
  logged** — never created.
- Stock is matched case-insensitively / trimmed if needed (decide during implementation
  based on real feed formatting).
- B2BCenter products use SKU consistently with the manufacturer feed; if not, a
  normalization/mapping step is required and must be added to scope before apply.

---

## 5. Dry-Run / Apply Requirements

Every sync runs in two distinct modes.

### Dry-run (default, always first)

- Reads the feed and the current B2BCenter product stock.
- Computes the full set of would-be changes.
- Writes **nothing** to the database.
- Produces a report listing: matched SKUs, planned stock changes (old → new),
  unmatched feed SKUs, and B2BCenter products not present in the feed.

### Apply

- Only allowed **after** a dry-run for the same feed/scope.
- Applies only the stock changes identified in the dry-run.
- Tenant-scoped and (if configured) manufacturer-scoped.
- Produces a report of actual changes applied, plus any errors.
- Apply must be idempotent — re-running with the same feed produces no further changes.

### Required guardrails

- Operator must explicitly choose apply; it is never the default.
- A large-change threshold check (e.g. unusually high percentage of products changing,
  or many products dropping to zero stock) should warn/require confirmation before apply.
- Apply should be batched and continue past individual row errors, logging each.

---

## 6. Safety Rules

- **No hard deletes.** Sync never deletes products.
- **No auto-archive in v1.** Products missing from the feed are not archived or hidden.
- **Stock only.** Sync never writes price, category, name, description, or image fields.
- **Tenant isolation.** All writes scoped to the single B2BCenter tenant; never write
  outside it.
- **SKU-only matching.** No fuzzy/name-based matching — a non-matching row is skipped.
- **Dry-run gate.** Apply is blocked unless a dry-run was performed for the same scope.
- **Credentials.** The ops project uses its own private/service credentials; portal
  client credentials are not reused. Secrets stay in the ops project environment,
  never committed.
- **Reversibility.** Because only stock changes, a bad run can be corrected by a
  subsequent corrected feed run; still, keep before-values in the report for manual
  rollback if needed.

---

## 7. Cache / Logging Expectations

### Logging

- Every run (dry-run and apply) writes a persistent log/report.
- Each report includes: timestamp, mode (dry-run/apply), feed source, scope
  (tenant, manufacturer), counts (matched / changed / skipped / errored), and a
  per-SKU change list with old → new stock values.
- Errors are logged per row; a run does not abort on a single bad row.
- Reports are retained so operators can compare runs over time.

### Caching

- Cache the fetched feed for a run so dry-run and the subsequent apply operate on the
  **same snapshot** (apply must not silently use a newer feed than the dry-run reviewed).
- Optionally cache the last successful sync result per manufacturer to support
  change-only diffing and to detect anomalies between runs.
- Caches are operational artifacts in the ops project, not portal state.

---

## 8. Future Phases

Out of scope for v1, tracked for later:

- **Phase 2 — Missing-from-feed handling:** optionally flag or archive B2BCenter
  products absent from the feed (with explicit operator confirmation; still no hard delete).
- **Phase 3 — Scheduled/automated runs:** scheduled dry-runs with operator-approved apply,
  or fully automated apply once confidence is high.
- **Phase 4 — Additional feeds:** onboard more manufacturers/suppliers beyond the Greek
  manufacturer, reusing the same SKU-matched stock-sync pipeline.
- **Phase 5 — Wider field sync (if ever needed):** price or other field sync would be a
  separate, explicitly scoped decision — not assumed.
- **Phase 6 — Notifications/alerts:** alert operators on anomalies (mass stock-outs,
  large unmatched-SKU counts).

---

## 9. Relationship to Other Docs

- `B2BCENTER_TODO_ROADMAP.md` — item 13 (P3) references this plan.
- `B2BCENTER_CURRENT_PROGRESS.md` — lists inventory sync as the next major operational task.
- `B2BCENTER_PROJECT_CONTEXT.md` — portal architecture; the sync does **not** live in
  the portal repo.
