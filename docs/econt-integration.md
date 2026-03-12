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
- Credentials are encrypted server-side before storage (requires edge env var `ECONT_CREDENTIALS_ENCRYPTION_KEY`).

## Edge Functions
Implemented functions (Supabase Edge):
- `econt-settings-get` (sanitized settings, no credentials returned)
- `econt-settings-save` (admin-only save/update)
- `econt-calculate`
- `econt-create-label`
- `econt-track`
- `econt-delete-label`

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
