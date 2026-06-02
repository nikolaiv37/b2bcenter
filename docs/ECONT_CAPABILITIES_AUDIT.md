# Econt integration — capabilities audit

**Scope:** read-only audit of the current B2BCenter ↔ Econt integration vs.
what the Econt JSON API actually exposes. No production behavior was changed
while writing this document.

**Sources:**

- Econt JSON API — Shipments model index:
  [http://ee.econt.com/services/Shipments/](http://ee.econt.com/services/Shipments/)
- Econt JSON API — root model index:
  [http://ee.econt.com/services/](http://ee.econt.com/services/)
- Econt — XML integration manual (BG, last updated 13.11.2025):
  [https://www.econt.com/e-econt/doc_templates/XML_manual.pdf](https://www.econt.com/e-econt/doc_templates/XML_manual.pdf)
- Econt — XML examples (EN):
  [http://www.econt.com/e-econt/doc_templates/xml_manual_examples_engl.pdf](http://www.econt.com/e-econt/doc_templates/xml_manual_examples_engl.pdf)
- Econt — Greece integration guide:
  [https://ee.econt.com/doc_templates/GreeceIntegrationAPIGuide.php](https://ee.econt.com/doc_templates/GreeceIntegrationAPIGuide.php)
- Econt — public API store:
  [https://api-dev.econt.com/](https://api-dev.econt.com/)
- Community reference — gdinko/econt Laravel wrapper:
  [https://github.com/gdinko/econt](https://github.com/gdinko/econt)
- Demo credentials and base URLs are encoded in
  `supabase/functions/_shared/econt.ts`:
  `https://demo.econt.com/ee/services/` / `https://ee.econt.com/services/`,
  demo user `iasp-dev` (from Econt's published demo).

> Endpoint catalogue under
> [http://ee.econt.com/services/Shipments/](http://ee.econt.com/services/Shipments/)
> covers `LabelService.createLabel`, `createLabels`, `deleteLabels`,
> `updateLabel`, `checkPossibleShipmentEditions`, `updateLabels`, `grouping`,
> `groupingCancelation`, `ShipmentService.requestCourier`,
> `getShipmentStatuses`, `getRequestCourierStatus`, `getMyAWB`, `setITUCode`.

---

## 1. Current implementation summary

### Files in scope
- UI: `src/components/shipping/ShipmentPanel.tsx` (single big React panel,
  used by `OrderDetailsSheet.tsx` and `AdminOrdersView.tsx` for admins).
- Hooks: `useMutationUpdateProductShipping`, `useQueryProductsShipping` (with
  `getEffectiveShippingWeightKg`), and the carrier registry/adapter under
  `src/lib/shipping/carriers/`.
- Edge Functions: `econt-calculate`, `econt-create-label`, `econt-track`,
  `econt-delete-label`, `econt-offices-list`, `econt-settings-get`,
  `econt-settings-save`.
- Shared helper: `supabase/functions/_shared/econt.ts` (credentials AES-GCM
  encryption, `buildEcontLabelPayload`, `parseShipmentInput`, office
  resolution + suggestions cache, response normalisers).
- DB: `supabase/migrations/20260312122900_create_econt_integrations_and_shipments.sql`
  (`tenant_integrations` + `shipments` tables, RLS, status enum), plus
  `20260602120000_add_product_shipping_fields.sql` (per-product shipping
  columns).

### Status enum currently in DB
`draft → calculated → created → cancelled / in_transit / delivered / returned / error`

---

## 2. Current request payloads (what we actually send)

All Econt requests go through `econtPost(path, payload, integration)` with
Basic auth.

### 2.1 `Shipments/LabelService.createLabel.json` (calculate)
```jsonc
{
  "label": {
    "senderClient":   { "name", "namePerson", "phones": ["…"], "email"? },
    "senderAgent":    { "name", "namePerson", "phones": ["…"], "email"? },
    "receiverClient": { "name", "namePerson", "phones": ["…"], "email"? },
    "receiverAgent":  { "name", "namePerson", "phones": ["…"], "email"? },
    "senderOfficeCode" | "senderAddress",
    "receiverOfficeCode" | "receiverAddress",
    "packCount": <int>,
    "shipmentType": "pack",
    "weight": <kg>,
    "shipmentDescription": "<≤255 chars>",
    "services": {
      "shipmentPayer": { "payer": "SENDER" | "RECEIVER" },
      "cdAmount"?:            <number>,
      "declaredValueAmount"?: <number>
    }
  },
  "mode": "calculate"
}
```

### 2.2 `Shipments/LabelService.createLabel.json` (create)
Same body, `"mode": "create"`. We then read `shipmentNumber` / `label.shipmentNum`,
`pdfURL`, `printURL`, `expectedDeliveryDate`, `services[0].description`,
`totalPrice`, `currency` from the response.

### 2.3 `Shipments/ShipmentService.getShipmentStatuses.json` (track)
```jsonc
{ "shipments": [{ "num": "<AWB>" }] }
```
> **Discrepancy with docs:** Econt's published model lists the input as
> `shipmentNumbers (string array)`. The current `{ shipments: [{ num }] }`
> shape continues to work against demo, but the docs-canonical form is
> `{ "shipmentNumbers": ["<AWB>"] }`. Worth normalising in Phase 4.

### 2.4 `Shipments/LabelService.deleteLabels.json` (cancel)
```jsonc
{ "shipmentNumbers": ["<AWB>"], "deleteReason": "Cancelled from platform" }
```
> Econt docs list only `shipmentNumbers` for the input; `deleteReason` is not
> a published field on this endpoint and may be ignored. Safe but cosmetic.

### 2.5 `Nomenclatures/NomenclaturesService.getOffices.json`
`{ "countryCode": "BGR" }`, response cached for 30 minutes per
`(env, country)` in-process.

---

## 3. Capabilities supported today

| Capability | Status |
|---|---|
| Office delivery (`receiverOfficeCode`) | ✅ + fuzzy resolution from office name (BG + transliterated) |
| Address delivery (`receiverAddress`) | ✅ city + postCode + street/streetNum + other |
| Sender from defaults (office or address) | ✅ via `tenant_integrations.defaults.sender` |
| Weight | ✅ single shipment weight, no per-pack split |
| Parcel count | ✅ as `packCount` only |
| Shipment description | ✅ truncated/forwarded; defaults to `Order #<n>` |
| Payer (`SENDER` / `RECEIVER`) | ✅ |
| COD (`cdAmount`) | ✅ |
| Declared value (`declaredValueAmount`) | ✅ |
| Calculate price | ✅ stores `price_amount`, `currency`, sets status `calculated` |
| Create waybill / AWB | ✅ stores `econt_waybill_number`, `pdfURL`, `printURL`, `expected_delivery_at` |
| Tracking refresh | ✅ throttled per tenant defaults, maps status codes → internal enum |
| Cancel waybill | ✅ updates row status to `cancelled` |
| Shipment history | ✅ list per order in panel, with AWB, price, service description, PDF/print links |
| Demo / prod envs | ✅ `tenant_integrations.environment` (`demo` falls back to public demo user) |
| Credential encryption | ✅ AES-GCM 256, server-side key `ECONT_CREDENTIALS_ENCRYPTION_KEY` |
| Offices list cache | ✅ 30-minute in-process per (env, country) |

---

## 4. Capabilities Econt exposes but we do **not** use today

(From the Shipments model index.)

- **Dimensions:** `shipmentDimensionsL`, `shipmentDimensionsW`,
  `shipmentDimensionsH`, plus boolean `sizeUnder60cm`. We store them per
  product and per shipment-form, but `buildEcontLabelPayload` does not
  forward them.
- **Per-parcel `packs` array** (alongside `packCount` / `weight`).
- `mode: "validate"` — a dry-run that returns warnings without changing
  state. We only use `calculate` and `create`.
- `LabelService.updateLabel` / `updateLabels` / `checkPossibleShipmentEditions`
  — no edit flow once a label is created.
- `LabelService.grouping` / `groupingCancelation` — multi-shipment grouping.
- `ShipmentService.requestCourier` / `getRequestCourierStatus` —
  courier pickup scheduling at sender.
- `ShipmentService.getMyAWB` — bulk listing for reconciliation.
- `ShipmentService.setITUCode` — ITU/customs codes.
- **Services we never set:**
  `priorityTimeFrom/To`, `deliveryReceipt`, `digitalReceipt`,
  `goodsReceipt`, `twoWayShipment`, `deliveryToFloor`,
  `pack5…pack12` (Econt packaging materials), `refrigeratedPack`,
  `moneyTransferAmount`, `expressMoneyTransfer`, `cdType`, `cdCurrency`,
  `cdPayOptions`, `smsNotification`, `invoiceNum`, `partialDelivery`,
  `paymentReceiverMethod`, `paymentOtherClientNumber`,
  `instructions`, `keepUpright`, `holidayDeliveryDay`,
  `payAfterAccept`, `payAfterTest`, `packingListType`, `packingList`,
  `customsList`, `customsInvoice`, `cargoVehicleOptions`,
  `emailOnDelivery`, `smsOnDelivery`, `envelopeNumbers`.
- **Response fields we drop:** `discountPercent`, `discountAmount`,
  `senderDueAmount`, `receiverDueAmount`, `otherDueAmount`, `hubCode/Name`,
  full `trackingEvents`, `deliveryAttemptCount`, `shortDeliveryStatus`,
  `cdCollected*` / `cdPaid*`, `warnings`, `returnShipmentURL`,
  `nextShipments`, `previousShipment`.
- **Validation modes not used:** `mode: "validate"` (would let us
  pre-flight a label without recording a `calculated` row).
- **Nomenclatures we don't query:** cities, quarters, streets — Econt
  publishes them under `Nomenclatures/NomenclaturesService.*`. We rely on
  the user typing a free-text city/street.

---

## 5. Dimensions findings

| Question | Answer |
|---|---|
| Does Econt support dimensions? | **Yes.** `shipmentDimensionsL`, `shipmentDimensionsW`, `shipmentDimensionsH`, plus a `sizeUnder60cm` flag. |
| Per shipment or per parcel? | Documented at the shipment level on `ShippingLabel`. The `packs` array, if used, can carry per-parcel data. |
| Required? | Optional. Weight + `packCount` remain mandatory. |
| Used for pricing? | Indirectly — bulky/oversize parcels are surcharged by Econt's tariffs, and `sizeUnder60cm` is the published "small parcel" optimisation flag. Calculate without dimensions still returns a price; with dimensions the price can change for oversize. |
| Units? | Centimetres (consistent with the rest of Econt's public materials). Not explicitly visible in the model index — confirm against the XML manual or via Econt support before going to prod. |
| Does `_shared/econt.ts` support them today? | **No.** `buildEcontLabelPayload` builds `label` with `packCount`, `weight`, `shipmentDescription`, services — no dimension fields. |
| What would be needed safely? | (1) Extend `ShipmentSnapshotInput` with `lengthCm/widthCm/heightCm/sizeUnder60cm`. (2) `parseShipmentInput` accepts and validates them (positive numbers, cm). (3) `buildEcontLabelPayload` conditionally adds `shipmentDimensionsL/W/H` and `sizeUnder60cm` when present. (4) `upsertShipmentDraft` persists them into new columns. (5) UI already collects them in the dialog/form — flip the "stored only" hint when wired. |

---

## 6. Multi-parcel findings

- Econt's `ShippingLabel` accepts both `packCount` (int) and a `packs` array
  with per-parcel detail.
- We send only `packCount` and a single total `weight`.
- The platform's customers are mainly furniture / B2B with bulky goods —
  per-parcel dimensions and weights can affect pricing and damage risk.
- Cost-benefit: implementation is moderate (data model on `shipments`, UI
  rows, JSON mapper), but the typical order is still single-parcel. **Defer
  unless a real customer asks** (Phase 3).

---

## 7. Office / address delivery findings

- **Office search:** Econt's `Nomenclatures.getOffices.json` is what we already
  call. Our wrapper caches per (env, country) for 30 min and resolves an
  office by code, name, transliterated name, prefix, or substring. Solid.
- **Office validation:** Done implicitly — Econt rejects unknown
  `receiverOfficeCode` and our wrapper surfaces "Допустими офиси…" suggestions
  back to the panel.
- **Address validation:** Today we send free-text city/street; Econt returns
  validation errors that the panel maps to specific fields. Econt offers
  `Nomenclatures.getCities` / `getQuarters` / `getStreets` for proper
  typeaheads — not wired.
- **What's possible we don't use:** address autocomplete via city/street
  nomenclatures, postal-code lookup, and `mode: "validate"` to confirm a
  full address+receiver block without creating a draft.

---

## 8. Pricing / calculate findings

Calculate already returns enough to surface a clean breakdown. We currently
keep only `totalPrice` + `currency`.

| Field | What it gives us | We use it? |
|---|---|---|
| `totalPrice` | grand total | ✅ |
| `currency` | currency | ✅ |
| `discountPercent` / `discountAmount` | client discount | ❌ |
| `senderDueAmount` / `receiverDueAmount` | who pays what | ❌ |
| `services[]` w/ `description, count, price, currency, paymentSide` | per-service breakdown | partial — first service only as text |
| `expectedDeliveryDate` | ETA | ✅ on create, not on calculate |
| `warnings` | non-fatal hints | ❌ |

**Should calculate get dimensions?** Yes, but only when the product/SKU has
them — otherwise we'd risk a tariff jump that isn't anchored in reality.

---

## 9. Label / PDF findings

- Response includes both `pdfURL` and `printURL` (we keep both).
- We also store the full Econt response under
  `shipments.econt_label_data.raw` — useful for support replays.
- We don't currently store: `returnShipmentURL`, `discount*`,
  `senderDueAmount/receiverDueAmount`, `warnings`, `hubCode/Name`.
- **Reprint flow:** today the user clicks the saved `printURL`/`pdfURL`
  link — that's enough; no need for `updateLabel` for reprint.

---

## 10. Tracking findings

- `getShipmentStatuses` returns `shipmentStatuses[].status.{code,name}` plus
  the rich `trackingEvents` array and `expectedDeliveryDate`,
  `shortDeliveryStatus`, `deliveryAttemptCount`,
  `cdCollectedAmount/Time/Currency`, `cdPaidAmount/Time/Currency`.
- We map to: `delivered / cancelled / returned / in_transit / created`.
- Our UI shows only the last `status_name` text; events list is dropped.
- COD collection state (paid vs. collected vs. due) is never surfaced —
  important for reconciliation when receiver pays cash.

---

## 11. Cancellation findings

- `LabelService.deleteLabels` accepts `shipmentNumbers` (array). Our
  `deleteReason` field is not in the documented schema — likely ignored.
- Econt restricts cancellation to labels that have not yet been picked up
  by a courier; once scanned in, only Econt support can intervene. The API
  returns per-shipment `Error` objects we should surface verbatim (today we
  raise a generic toast).
- Edge: cancelling a shipment that was already cancelled or already
  delivered will fail — our UI doesn't gate the Cancel button on internal
  status, only on AWB presence. Minor risk.

---

## 12. COD / declared value findings

- `cdAmount` is the cash-to-collect amount in the shipment currency (BGN
  for domestic). Econt also publishes `cdType`, `cdCurrency`, `cdPayOptions`
  — we don't set them, so it defaults to plain cash collection in BGN.
- `declaredValueAmount` insures the shipment up to that amount. Higher
  value = higher tariff line. Today we default it to 0 unless the
  integration's `default_declared_value_enabled` is on. For B2B furniture
  with high unit prices, defaulting to order total is a reasonable Phase 1
  toggle — but only after we agree commercially with Econt's insurance fee.
- COD default to order total: already done client-side in the panel from
  the previous refactor.

---

## 13. Sender / receiver findings

- **Sender:** name + phone are required, email + office-or-address required.
  `buildEcontLabelPayload` throws 400 if missing. Defaults stored on
  `tenant_integrations.defaults.sender`. ✅
- **Receiver:** name + phone required. Email optional. Econt warns
  "Необходим е телефон или e-mail" if both missing.
- **Person vs. company:** Econt expects `name` for the legal entity and
  `namePerson` for the contact person. We send the same name for both —
  acceptable for MVP but technically loses information.
- **Risk:** if a tenant ships under a personal account, our code still labels
  the receiver as a "client" + `namePerson` echo, which Econt sometimes
  flags as "за фирмен получател е нужно упълномощено лице". Handled in UI
  validation mapping, but worth a dedicated "contact person" field in the
  panel for company receivers.

---

## 14. Data model gaps (`shipments` table)

Today we persist:

```
id, tenant_id, quote_id, carrier, receiver, destination,
parcels_count, weight_kg, cod_amount, declared_value, price_amount, currency,
econt_waybill_number, econt_label_data (JSON), status,
last_synced_at, tracking_last_requested_at, created_at, updated_at
```

| Missing | Why it matters |
|---|---|
| `length_cm`, `width_cm`, `height_cm`, `size_under_60cm` | Mirror per-product fields so audit shows what was sent |
| `request_payload` JSONB snapshot per action | Support replays without guessing |
| `response_payload` JSONB (already partly under `econt_label_data.raw`) | Confirmed payload, separate column makes querying easier |
| `service_name` / `service_description` text | We pull from first service today; storing it makes reporting trivial |
| `expected_delivery_at` timestamptz | Currently buried under `econt_label_data.expected_delivery_at` |
| `pdf_url`, `print_url` text | Same — top-level columns simplify SQL exports |
| `error_log` JSONB (last Econt error per shipment) | Support and retry |
| `created_by` uuid | Who created/cancelled the shipment |
| `cancelled_at`, `cancel_reason` | Audit |
| `cod_collected_amount` / `cod_paid_amount` + timestamps | Reconciliation with finance |
| Index on `status` and `quote_id, status` | Reporting (open shipments per order) |

---

## 15. Recommended implementation phases

### Phase 1 — Safe UI / storage polish *(low risk, no Econt payload changes)*
1. Surface `discount_percent`, `discount_amount`, `senderDueAmount`,
   `receiverDueAmount` on the shipment row UI.
2. Show service breakdown (`services[].description × price`) instead of just
   first-service text.
3. Show full tracking-events timeline (already in `econt_label_data.raw`)
   when admin expands a shipment row.
4. Gate the Cancel button on internal status (`status in
   ('draft','calculated','created')` only) — UX safety, no API change.
5. Persist `service_name`, `expected_delivery_at`, `pdf_url`, `print_url`,
   `error_log`, `created_by`, `cancelled_at` as **dedicated columns** (keep
   `econt_label_data` as raw blob for audit).
6. Normalise tracking request to `{ "shipmentNumbers": ["<AWB>"] }` per
   docs — keep current shape as fallback to avoid regressions.
7. Drop unused `deleteReason` from delete payload — cosmetic, prevents
   future surprise if Econt starts validating extra fields.

### Phase 2 — Dimensions *(small, well-bounded payload change)*
1. Extend `ShipmentSnapshotInput` with `lengthCm/widthCm/heightCm` and
   optional `sizeUnder60cm` flag.
2. `parseShipmentInput`: positive numbers, cm, optional. `superRefine`: all
   three present or all absent (don't send partial dimensions).
3. `buildEcontLabelPayload`: when present, set
   `label.shipmentDimensionsL/W/H` (cm) and `label.sizeUnder60cm` (bool).
4. Add `length_cm/width_cm/height_cm/size_under_60cm` columns on `shipments`.
5. UI: flip the "stored only" hint to "стойностите се изпращат към Еконт"
   when at least one dimension is set; keep the collapsible block.
6. Pre-flight with `mode: "validate"` once to confirm Econt accepts the
   field names against the demo env before turning it on in prod.

### Phase 3 — Multi-parcel *(defer until customer-driven)*
1. `packs` array on snapshot input + DB.
2. UI: dynamic list of parcels with per-parcel weight and (optional)
   dimensions.
3. Calculate/create still allow the legacy single-parcel shape so old draft
   shipments don't break.

### Phase 4 — Tracking / status polish
1. Persist `tracking_events`, `short_delivery_status`,
   `delivery_attempt_count`, `cd_collected_*`, `cd_paid_*`.
2. Render an event timeline in the shipment card.
3. Map more Econt status codes to the internal enum and update the
   `shipments_status_check` constraint accordingly.
4. Optional: `setITUCode` and `requestCourier` to schedule pickup from the
   sender's address (useful for tenants that ship from a warehouse).

### Phase 5 — Operational logging / audit
1. Add `request_payload` / `response_payload` snapshots on every Econt
   call (insert into a sibling `shipment_events` table so the main row
   stays small).
2. Surface a "view raw Econt response" toggle in the admin shipment card.
3. Add tenant-level Econt rate-limit / error-rate counters and a basic
   diagnostics page.
4. Replace generic toasts with the verbatim `innerErrors[].message` from
   Econt so admins can act on validation messages without guessing.

---

## 16. Top 5 recommended next steps

1. **Phase 1.5** — schema migration adding dedicated columns
   (`service_name`, `expected_delivery_at`, `pdf_url`, `print_url`,
   `error_log`, `created_by`, `cancelled_at`, `cancel_reason`) +
   backfill from `econt_label_data`. Pure storage change, zero Econt risk.
2. **Phase 1.1–1.4 UI polish** — show full service breakdown, tracking
   timeline, gate Cancel by internal status. Pure UI, no payload change.
3. **Phase 2 — dimensions on the wire**, behind a per-tenant
   "send dimensions" flag, validated first against demo with
   `mode: "validate"`. This is the highest-leverage payload change because
   the data is already collected today.
4. **Phase 4.1** — persist `tracking_events` / `cd_collected_*` and
   render them. Big value for support and finance, no payload risk.
5. **Phase 5.1** — `shipment_events` audit log of every Econt request +
   response. Unblocks customer-support replays and future debugging without
   bloating the main row.

---

## 17. Should dimensions be implemented now or later?

**Now (Phase 2), once Phase 1 schema columns land.** Reasons:

- All inputs already exist on the product editor and the shipment form.
- The shared `_shared/econt.ts` only needs three optional fields appended
  to the existing `label` builder — a few lines, fully additive.
- Econt accepts the request without dimensions today, so a per-tenant
  feature flag lets us roll out safely and roll back instantly.
- Bulky-goods tenants (furniture B2B is the platform's main use-case)
  benefit immediately from accurate oversize pricing on `calculate`.

The only caveat is to confirm via Econt support (or `mode: "validate"`
against demo) that the unit is cm and that we're not expected to also send
`sizeUnder60cm` to avoid the small-parcel discount being applied
incorrectly.

---

## 18. Build / behavior

No application code was changed for this audit. `npm run build` was **not**
re-run because no source files were modified.
