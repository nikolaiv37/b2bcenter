# Econt Integration (MVP)

## Overview
This project implements Econt as a tenant-configurable carrier module.

Key properties of this MVP:
- Tenant-scoped configuration in `tenant_integrations` (`provider='econt'`)
- Tenant-scoped shipment records in `shipments` (`carrier='econt'`)
- All Econt API calls run server-side in Supabase Edge Functions
- Econt credentials are never returned to the browser
- Tracking is on-demand only with server-side throttling
- No offices/cities sync in MVP (manual `office_code` / address entry)

## Demo Setup (Econt DEMO)
1. Open `Settings > Integrations > Econt` (tenant admin/owner).
2. Enable Econt.
3. Set `Environment = Demo`.
4. Configure sender defaults:
   - sender name
   - sender phone
   - sender office code OR sender address
   - default weight / parcels / payer
5. Credentials:
   - You can save custom demo credentials, or leave them blank.
   - If blank and environment is `demo`, the integration uses the Econt demo credentials automatically:
     - username: `iasp-dev`
     - password: `1Asp-dev`
6. Save settings.
7. Open an order and use the `Econt Shipment` panel to calculate/create/track.

## Switch to Production
1. Open `Settings > Integrations > Econt`.
2. Set `Environment = Production`.
3. Enter your production Econt username/password and save.
4. Keep sender defaults valid for your production sender profile.
5. Verify shipment creation on a test order.

Notes:
- Production mode requires saved credentials.
- Credentials are encrypted server-side before storage (requires edge secret `ECONT_CREDENTIALS_ENCRYPTION_KEY`, see below).

## Server Encryption Key (`ECONT_CREDENTIALS_ENCRYPTION_KEY`)

Econt credentials are encrypted at rest with AES-256-GCM. The AES key is derived
(SHA-256) from the `ECONT_CREDENTIALS_ENCRYPTION_KEY` secret, which is read
**only** inside the Edge Functions via `Deno.env.get(...)`.

Security rules:
- This is a **server-only** secret. Never expose it to the browser. Do **not**
  create a `VITE_ECONT_CREDENTIALS_ENCRYPTION_KEY` or reference it in frontend
  code.
- Never commit the real value to the repo.
- If the secret is missing, `econt-settings-save` (production with credentials),
  `econt-create-label`, `econt-calculate`, etc. fail with HTTP 500:
  `Missing Econt encryption key on server. Configure ECONT_CREDENTIALS_ENCRYPTION_KEY in Supabase Edge Function secrets.`
- Demo mode without saved credentials does not need the secret (it uses the
  built-in Econt demo credentials).

> ⚠️ The key derives the AES key. If you rotate it, previously stored encrypted
> credentials can no longer be decrypted — tenants must re-enter their Econt
> username/password after a rotation.

### Generate a key
Any high-entropy string works (it is hashed before use). For example:
```bash
openssl rand -base64 48
```

### Set the secret remotely (production / linked project)
```bash
# from the repo root, with the project already linked (supabase link ...)
supabase secrets set ECONT_CREDENTIALS_ENCRYPTION_KEY="<paste-generated-key>"

# verify it is present (values are masked)
supabase secrets list

# redeploy the functions so they pick up the new secret
supabase functions deploy econt-settings-save
supabase functions deploy econt-settings-get
supabase functions deploy econt-create-label
supabase functions deploy econt-calculate
supabase functions deploy econt-offices-list
supabase functions deploy econt-track
supabase functions deploy econt-delete-label
```

### Local development (supabase functions serve)
For local serving, put the secret in `supabase/functions/.env` (this file is
git-ignored — never commit real values):
```env
ECONT_CREDENTIALS_ENCRYPTION_KEY=<local-dev-key>
```
Then serve with the env file:
```bash
supabase functions serve --env-file supabase/functions/.env
```
A committed template `supabase/functions/.env.example` documents the required
keys without any real values.

## Edge Functions
Implemented functions (Supabase Edge):
- `econt-settings-get` (sanitized settings, no credentials returned)
- `econt-settings-save` (admin-only save/update)
- `econt-calculate`
- `econt-create-label`
- `econt-track`
- `econt-delete-label`

## Delivery-Price Payer (Sender vs Receiver)

Who pays the **delivery price** is controlled by `default_payer` in Econt
settings (`SENDER` / `RECEIVER`), overridable per shipment from the shipment
panel (`payer`). Resolution order: shipment-level `payer` → tenant
`default_payer` → `SENDER`.

This is mapped onto Econt's `createLabel`/`calculate` Label fields (Econt has no
single "payer" enum):

| App value  | Econt Label fields sent |
|------------|-------------------------|
| `SENDER`   | `paymentSenderMethod: "cash"` (no receiver-payment fields) → sender billed full delivery price |
| `RECEIVER` | `paymentSenderMethod: "cash"`, `paymentReceiverMethod: "cash"`, `paymentReceiverAmount: 100`, `paymentReceiverAmountIsPercent: true` → receiver billed 100% of delivery price |

The same mapping is applied in both `econt-calculate` and `econt-create-label`
(both go through `buildEcontLabelPayload` in `_shared/econt.ts`), so the quoted
price and the created waybill always agree.

> Historical bug: the code previously sent `services.shipmentPayer = { payer }`,
> which is **not** a recognised Econt field. Econt ignored it and always billed
> the sender, so switching to Receiver had no effect.

### Relationship to COD (наложен платеж)
The delivery-price payer is **independent** of COD. COD is configured separately
via `cdAmount` (the goods amount collected from the receiver) and does not change
who pays the delivery price. Setting `RECEIVER` makes the receiver pay shipping;
setting a COD amount makes the receiver pay for the goods. The two can be used
together or independently. Advanced Econt payment splits
(`paymentReceiverAmountIsPercent: false` for a fixed split amount,
`paymentOtherClientNumber` for third-party payer) are **not** implemented — only
the all-or-nothing sender/receiver split above.

## Tracking Throttle (Server-Side)
Tracking is on-demand only. No polling/realtime tracking is used.

Rules:
- Each shipment can be refreshed at most once per `X` minutes.
- `X` is tenant-configurable in Econt settings (`tracking_throttle_minutes`), clamped to `5..15`.
- Default is `10` minutes.
- Throttle is enforced in `econt-track` using `shipments.tracking_last_requested_at`.

When throttled:
- The function returns a throttled response with `retry_after_minutes` / `next_allowed_at`.
- The UI shows “Try again in X minute(s)”.

## Shipment Snapshot Model (No Product Schema Changes)
Shipments are created from an order/quote packing snapshot (not product schema changes):
- receiver info
- destination (office code or address)
- `weight_kg`
- `parcels_count`
- services (COD / declared value)
- payer

Tenant defaults are applied server-side and can be overridden per shipment.

## Common Troubleshooting
### "Econt is not enabled for this tenant"
- Enable Econt in `Settings > Integrations > Econt` and save.

### "Econt sender defaults are incomplete"
- Add sender name and sender phone.
- Add sender office code OR sender address (city required for address).

### "Econt credentials are missing for production environment"
- Save production username/password in Econt settings.

### "Missing Econt encryption key on server..."
- The `ECONT_CREDENTIALS_ENCRYPTION_KEY` secret is not configured for the Edge
  Functions. Set it and redeploy — see "Server Encryption Key" above.
- Confirm with `supabase secrets list` (remote) or that
  `supabase/functions/.env` contains the key (local serve).

### Track button says throttled
- Wait until the returned retry window passes.
- Reduce throttle in settings only if needed (minimum 5 minutes).

### Econt API request failed
- Check environment (demo vs prod).
- Check credentials.
- Check sender/receiver address/office data.
- Check network access from Supabase Edge runtime.

## Security Notes
- `tenant_integrations` is admin-only via RLS.
- `shipments` is tenant-isolated via RLS.
- Edge functions authenticate the caller, resolve tenant membership, and scope all reads/writes by `tenant_id`.
- Econt credentials are not exposed in frontend responses.
