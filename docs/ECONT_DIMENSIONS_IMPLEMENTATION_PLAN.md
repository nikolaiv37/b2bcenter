# Econt dimensions — implementation plan (Phase 2)

**Status:** plan only. No code, payloads, or migrations are changed by this
document.

**References used:**

- [docs/ECONT_CAPABILITIES_AUDIT.md](./ECONT_CAPABILITIES_AUDIT.md) — Phase 2
  is the next slot after the Phase 1.5 storage work that already landed.
- Econt JSON API — `ShippingLabel` model lists
  `shipmentDimensionsL`, `shipmentDimensionsW`, `shipmentDimensionsH`, plus
  `sizeUnder60cm`:
  [http://ee.econt.com/services/Shipments/](http://ee.econt.com/services/Shipments/).

---

## 1. Where dimensions live today

### 1.1 `products` table
Added by `20260602120000_add_product_shipping_fields.sql`. All nullable.

| Column | Type | Notes |
|---|---|---|
| `shipping_weight_kg` | numeric | Per single unit. Effective weight = this → `transportational_weight` → `weight`. |
| `shipping_parcels_count` | int default 1 | Per single unit. |
| `shipping_length_cm` | numeric | Per single unit. |
| `shipping_width_cm` | numeric | Per single unit. |
| `shipping_height_cm` | numeric | Per single unit. |
| `shipping_requires_review` | bool default false | Manual-review flag. |

There is **no** `size_under_60cm` column on products today.

### 1.2 `shipments` table (after Phase 1.5)
`weight_kg`, `parcels_count`, `cod_amount`, `declared_value`,
`price_amount`, `currency`, plus the dedicated `service_*`,
`expected_delivery_at`, `pdf_url`, `print_url`, `error_log`, `created_by`,
`cancelled_at`, `cancel_reason` columns.

**Missing for dimensions:**
`length_cm`, `width_cm`, `height_cm`, `size_under_60cm`.

### 1.3 `useQueryProductsShipping.ts`
Returns `{ id, sku, shipping_weight_kg, shipping_parcels_count,
shipping_length_cm, shipping_width_cm, shipping_height_cm,
shipping_requires_review, weight, transportational_weight }` per SKU.
Exports `getEffectiveShippingWeightKg(row)` for legacy weight fallback.
No equivalent helper exists for dimensions yet.

### 1.4 `ProductShippingEditor.tsx`
Renders form inputs for weight, parcels-per-unit, length, width, height,
requires-review. Writes via `useMutationUpdateProductShipping`. Fully
functional today — no changes needed for Phase 2.

### 1.5 `useMutationUpdateProductShipping.ts`
Whitelists exactly the six product shipping columns:
`shipping_weight_kg`, `shipping_parcels_count`, `shipping_length_cm`,
`shipping_width_cm`, `shipping_height_cm`, `shipping_requires_review`.
Updates strictly by `tenant_id + sku`. No changes needed for Phase 2.

### 1.6 `ShipmentPanel.tsx`
- Zod schema already has `lengthCm`, `widthCm`, `heightCm` as
  `optionalNumber(0)`.
- For **single-product orders**, `aggregateShippingFromItems` copies the
  product's `shipping_length_cm/width_cm/height_cm` into `aggregated.lengthCm/widthCm/heightCm`,
  which `toDefaultForm` writes into the form. For **multi-product orders**,
  no auto-fill (intentionally — no meaningful aggregation across SKUs).
- The dimensions inputs live in a collapsed `<details>` titled
  *"Допълнителни данни за опаковка (по избор)"*, with the hint
  *"Размерите се записват към пратката, но засега не се изпращат към Еконт."*
- The "Save to product" dialog reads these form values and writes them back
  via `useMutationUpdateProductShipping`.
- **They never reach the Econt request.** `buildShipmentPayload` (the
  client-side helper that builds `ShipmentDraftInput`) does not include
  dimensions, and the carrier adapter forwards exactly what it gets.

### 1.7 `supabase/functions/_shared/econt.ts`
- `ShipmentSnapshotInput` has no dimension fields.
- `parseShipmentInput` does not read `lengthCm/widthCm/heightCm` from the
  request body even if the client were to send them.
- `buildEcontLabelPayload` constructs the `label` object with
  `senderClient/Agent`, `receiverClient/Agent`, `senderOfficeCode |
  senderAddress`, `receiverOfficeCode | receiverAddress`, `packCount`,
  `shipmentType: 'pack'`, `weight`, `shipmentDescription`, `services`. No
  `shipmentDimensionsL/W/H`, no `sizeUnder60cm`.
- `upsertShipmentDraft` writes `weight_kg`/`parcels_count` but has no
  knowledge of dimension columns.

---

## 2. Current data-flow diagram

```
Product editor                Order details            Econt shipment form
─────────────                  ──────────────           ───────────────────
shipping_length_cm  ──►  (not stored on order)   ──►  ShipmentPanel form
shipping_width_cm   ──►  items[i].sku            ──►   .lengthCm    ┐
shipping_height_cm  ──►  items[i].quantity       ──►   .widthCm     ├── never
                                                       .heightCm    ┘  reaches
                                                                    Econt
                                  │
                                  ▼
                            shipments table
                            (no L/W/H columns)
```

For Phase 2 the right edge of that diagram needs to extend through
`buildShipmentPayload` → `parseShipmentInput` → `buildEcontLabelPayload`
→ `shipments` table (new L/W/H/size_under_60cm columns).

---

## 3. Proposed implementation

### 3.1 Tenant feature flag

Add `default_send_dimensions_to_econt` to
`tenant_integrations.defaults` (JSONB). Surface a checkbox in
`EcontIntegrationSettings` ("Изпращай размери на пратката към Еконт").
Defaults to `false` for every tenant; we flip it on per tenant after
demo-validation succeeds.

Why a flag and not an unconditional rollout:
- Phase 2 changes the wire payload. A flag gives us an instant rollback
  per tenant if Econt surprises us with a tariff jump.
- Lets us preflight against `demo.econt.com` with `mode: "validate"`
  before flipping `prod`.

### 3.2 Snapshot input + storage

Extend `ShipmentSnapshotInput`:

```ts
lengthCm?: number | null
widthCm?: number | null
heightCm?: number | null
sizeUnder60cm?: boolean | null
```

Extend `parseShipmentInput`:
- Read each from `body.lengthCm` / `body.length_cm` (and W/H equivalents).
- Validate: positive, ≤ 1000 cm (sanity cap — Econt has no published cap but
  10 m is far beyond any real B2B parcel).
- `sizeUnder60cm` accepted from body, otherwise derived (see §3.5).

Migration adding to `shipments`:

```sql
alter table public.shipments
  add column if not exists length_cm        numeric,
  add column if not exists width_cm         numeric,
  add column if not exists height_cm        numeric,
  add column if not exists size_under_60cm  boolean;
```

`upsertShipmentDraft` adds these to its partial-update args, mirroring how
Phase 1.5 added `service_name` / `pdf_url`.

### 3.3 Payload construction (`buildEcontLabelPayload`)

```ts
// Inside buildEcontLabelPayload, AFTER existing fields are set:
const sendDims =
  Boolean(defaults?.default_send_dimensions_to_econt) &&
  input.lengthCm != null &&
  input.widthCm  != null &&
  input.heightCm != null
if (sendDims) {
  label.shipmentDimensionsL = Number(input.lengthCm)
  label.shipmentDimensionsW = Number(input.widthCm)
  label.shipmentDimensionsH = Number(input.heightCm)
  label.sizeUnder60cm       = Boolean(input.sizeUnder60cm)
}
```

**All-or-nothing rule.** See §4.3.

### 3.4 `mode: "validate"` preflight

Add a new edge function `econt-validate` (small wrapper around
`createLabel.json` with `mode: 'validate'`). The settings page exposes a
"Тест на размерите" button that calls it once with a synthetic payload
derived from the tenant's defaults and a real product SKU. We log the
result in `tenant_integrations.defaults.last_dimensions_validation` (`{ at,
ok, warnings }`) and gate the "Изпращай размери" toggle from being turned
on until at least one successful validation has been recorded against demo.

This is the single most important guardrail of Phase 2.

### 3.5 `sizeUnder60cm` — auto or manual?

**Hybrid: auto-default, manual override.**

The Econt convention is: a shipment qualifies as "small parcel"
(`sizeUnder60cm = true`) when its largest dimension is strictly less than
60 cm. The rule is mechanical and admin time spent toggling it is wasted.

Recommended logic:

```ts
function deriveSizeUnder60cm(L: number | null, W: number | null, H: number | null): boolean | null {
  if (L == null || W == null || H == null) return null
  return Math.max(L, W, H) < 60
}
```

Behavior in `ShipmentPanel`:
1. When the admin enters/changes any of L/W/H, recompute the derived value
   and set `sizeUnder60cm` field if the admin hasn't manually touched it.
2. Expose a checkbox labelled
   *"Малък пакет (≤ 60 см) — изпрати към Еконт"* with a "(автоматично)"
   suffix when it's still tracking the derived value.
3. Once the admin manually clicks the checkbox, stop auto-tracking for the
   rest of the form session (standard "uncontrolled override" UX).

For the **API payload**, only send `sizeUnder60cm` when all three
dimensions are present — otherwise we'd be sending a boolean that's
defensible neither true nor false.

### 3.6 Auto-fill rules in the panel

| Order shape | Auto-fill behavior |
|---|---|
| Single-product (qty ≥ 1) | Copy `shipping_length_cm/width_cm/height_cm` from the product row, exactly as today. `sizeUnder60cm` derives from the three values. |
| Multi-product, all SKUs have dimensions | **Do not auto-fill** in Phase 2. Surface a "Изчисли от продуктите" button that fills with `max(L), max(W), max(H)` across line items — a conservative bounding box that won't undercharge. |
| Multi-product, some SKUs missing dimensions | Skip auto-fill, show the existing missing-data hint (today: only weight; we'd extend it to "L/W/H липсват за: SKU1, SKU2"). |
| No items at all | Existing default-only behavior — admin enters manually. |

This stays behind the same tenant flag — admins can fill dimensions even
when the flag is off (so the values land on the product/shipment row for
audit), they simply aren't sent to Econt.

### 3.7 UI flips

- The collapsible block currently titled *"Допълнителни данни за
  опаковка"* becomes *"Размери на пратката"* when the tenant flag is on.
- Its hint changes from "записват се към пратката, но засега не се
  изпращат към Еконт" to "ще бъдат изпратени към Еконт за калкулация и
  товарителница".
- Add the `sizeUnder60cm` checkbox + the "auto" pill, and the
  multi-product "Изчисли от продуктите" button.
- Service-breakdown card already renders Econt's response; once we send
  dimensions, the per-service prices will visibly change for oversize
  shipments — admins can compare before/after by toggling the flag and
  re-running calculate.

### 3.8 What does **not** change

- Econt request payload **with the flag off** stays byte-identical to
  today. The flag is the only switch that changes wire behavior.
- `econt_label_data` raw blob, response normalisers, status enum,
  cancellation rules, tracking throttle, office search, settings storage —
  all unchanged.
- The product editor stays as-is. Existing `shipping_*` columns are the
  source of truth.

---

## 4. Decisions to ratify before coding

### 4.1 Should the flag be per-tenant or per-shipment?

**Per-tenant default + per-shipment override.** Most operations are
homogeneous; one toggle keeps the panel uncluttered. For the rare case
where dimensions are wrong and the admin needs to bypass them on a single
shipment, add a "не изпращай размери за тази пратка" checkbox on the form.
Both flow into `parseShipmentInput`; the per-shipment override wins.

### 4.2 Units

Econt's public materials consistently express parcel dimensions in **cm**.
The product editor and the Econt panel both already label inputs as cm and
store as `numeric`, so no conversion is required.

That said: we must confirm with `mode: "validate"` against demo before
flipping the flag in prod. If validation succeeds and calculated totals
match what the Econt office UI returns for the same input, we've confirmed
cm in practice.

### 4.3 Should dimensions be sent only when all three values exist?

**Yes — all-or-nothing.** Reasons:

1. The Econt model treats `shipmentDimensionsL/W/H` as a triple. Partial
   submissions are undocumented behavior — Econt could (a) ignore one or
   more, (b) reject the request, (c) apply a default for the missing axis.
   None of those are safer than just not sending.
2. Pricing surprises. Sending two of three dimensions could place the
   shipment in a different tariff bucket than the same two dimensions plus
   a sensible third would.
3. `sizeUnder60cm` is only meaningful when all three are known.

Implementation rule: the gate in §3.3 — `lengthCm != null && widthCm !=
null && heightCm != null` — is the single canonical "send dimensions"
predicate; never compute it twice in different places.

### 4.4 Should weight stay independent?

**Yes.** Dimensions affect price, but weight is always required by Econt
and we already source it from the effective weight (`shipping_weight_kg`
→ legacy fields). Phase 2 changes nothing about weight handling.

### 4.5 What about multi-parcel (`packs` array)?

Audit defers this to Phase 3. Per-parcel dimensions belong with that
phase. For Phase 2 we keep the single-shipment fields documented under
`ShippingLabel`, which is what Econt charges against today.

---

## 5. Phased rollout (inside Phase 2)

1. **2.0 — Schema only.** Migration adding L/W/H/size_under_60cm to
   `shipments`. No edge-function changes. Allows the panel to persist the
   already-collected values in dedicated columns so reports work.
2. **2.1 — Snapshot + storage path.** `ShipmentSnapshotInput`,
   `parseShipmentInput`, `upsertShipmentDraft` extended. Still no wire
   change. The new columns start filling from `calculate`/`create`.
3. **2.2 — `econt-validate` edge function.** Implements `mode: 'validate'`.
   Settings UI adds the "Тест на размерите" action.
4. **2.3 — Wire change behind the tenant flag.**
   `buildEcontLabelPayload` writes dimensions when the gate in §3.3 fires.
   Flag stays `false` for every tenant by default.
5. **2.4 — UI polish.** Collapsible heading flip, `sizeUnder60cm`
   checkbox with auto-track, multi-product "Изчисли от продуктите" button,
   per-shipment override.
6. **2.5 — Demo verification + per-tenant flip.** For each tenant we
   enable dimensions for, we (a) run `econt-validate`, (b) compare a known
   shipment's `calculate` total before and after, (c) flip the flag on,
   (d) keep an eye on the next 24 h of `error_log` entries.

Each step is independently shippable; if 2.5 surfaces an issue we revert
2.3 only and keep 2.0–2.2 (pure storage, zero risk).

---

## 6. Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Econt rejects partial dimensions | Low (we'd never send partial — see §4.3) | High (every `calculate`/`create` fails) | All-or-nothing gate; covered by §3.3 + §3.4 preflight. |
| Units misinterpreted (cm vs mm) | Low | High (10× tariff bracket) | `mode: 'validate'` preflight + price-match against Econt office UI for one known shipment. |
| `sizeUnder60cm` semantics differ from BG tariff (e.g. it's an opt-in for a discount the tenant doesn't qualify for) | Medium | Medium (occasional surcharges) | Per-shipment override; documented in `error_log` if it correlates with rejections. |
| Multi-product aggregation undercharges | Medium | Medium | Use `max(L), max(W), max(H)` — bounding box. Never sum. Highlight the formula in the panel. |
| Tenant flips the tenant flag without validating first | Medium | High | UI gates the toggle from being turned on until a successful `econt-validate` is logged. |
| Bulky-goods price jump surprises customers | High by design | Low (this *is* the goal) | Phase 2.5 step (b) — calculate before/after on a known shipment so finance has the comparison. |
| Econt API field names drift | Low | High | Keep behind tenant flag; one customer at a time. |
| Data drift between `products` and `shipments` dimension columns | Medium | Low | Same partial-update pattern as Phase 1.5 — only write when explicitly passed. |
| Inconsistent product data (rounded to integers vs decimals) | Medium | Low | `numeric` column; UI accepts decimal in cm; preview the rounded `Math.max(L,W,H)` in the panel so admin sees what `sizeUnder60cm` will derive to. |

---

## 7. Test plan (for whoever implements Phase 2)

Before flipping any tenant flag:

1. **Schema migration applied** on staging; rows with NULL L/W/H still
   round-trip cleanly.
2. **`calculate` + `create` + `track` + `cancel` work unchanged** for a
   tenant whose flag is `false`. Byte-diff against pre-Phase-2 captures.
3. **`calculate` with the flag on** for a known bulky SKU returns a total
   that matches Econt's office calculator within rounding tolerance.
4. **`mode: 'validate'` preflight** with deliberately oversized dimensions
   (e.g. 200 × 100 × 100 cm) returns warnings or errors that we surface in
   the panel, instead of silently calculating.
5. **`sizeUnder60cm` derivation** — `Math.max(59.9, 59.9, 59.9) < 60` is
   true; `Math.max(60, 1, 1) < 60` is false. Unit cover the boundary.
6. **All-or-nothing gate** — leave width unset, submit. Wire payload
   contains no dimension fields; admin sees a hint to fill all three.
7. **Save-to-product** still writes the dimensions back to the product row
   when called from a single-product order (unchanged behavior).
8. **Multi-product "Изчисли от продуктите"** fills `max` across SKUs,
   does not overwrite if admin has typed.

---

## 8. Top recommendations

1. Land **Phase 2.0 + 2.1** (schema + snapshot + storage) first — pure
   storage, zero wire impact, lets us forensically compare before/after
   prices later.
2. Add **`econt-validate`** before changing the wire payload. The
   preflight is cheap and uncovers unit/encoding issues without touching
   production shipments.
3. Implement the **tenant `default_send_dimensions_to_econt` flag** with a
   UI lock that requires a successful preflight before it can be turned
   on.
4. Treat **all-or-nothing** as a single canonical gate. Computed once,
   referenced everywhere.
5. Defer `packs` per-parcel data and the `mode: "validate"` UI for
   address-only shipments — keep Phase 2 minimal and focused on bulky-goods
   pricing accuracy.

---

**Reminder:** this document describes intent. No source files, payloads,
or migrations were changed for Phase 2 — the audit's Phase 1.5 work
already merged is the last code change on Econt in this branch.
