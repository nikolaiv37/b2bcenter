import { requireTenantAuth } from '../_shared/auth.ts'
import {
  appendShipmentError,
  buildEcontLabelPayload,
  econtDebugEnabled,
  econtPost,
  getTenantEcontIntegration,
  normalizeCalculateResult,
  parseShipmentInput,
  resolveShipmentOfficeDestinations,
  upsertShipmentDraft,
} from '../_shared/econt.ts'
import { errorResponse, ok, parseJson, requirePostOrOptions } from '../_shared/http.ts'

interface Body {
  tenant_id?: string
  shipment_id?: string
  shipment?: Record<string, unknown>
}

Deno.serve(async (req) => {
  let errorLogContext: { adminClient: unknown; tenantId: string; shipmentId: string } | null = null
  try {
    const preflight = requirePostOrOptions(req)
    if (preflight) return preflight

    const body = await parseJson<Body>(req)
    const auth = await requireTenantAuth(req, { tenantId: body.tenant_id ?? null })
    if (body.shipment_id) {
      errorLogContext = { adminClient: auth.adminClient, tenantId: auth.tenantId, shipmentId: body.shipment_id }
    }
    const integration = await getTenantEcontIntegration(auth.adminClient, auth.tenantId, { requireEnabled: true })

    // -- DEBUG: dimensions verification (remove or disable after verification) --
    if (econtDebugEnabled(integration)) {
      const ship = (body.shipment ?? body) as Record<string, unknown>
      const length = (ship.lengthCm ?? ship.length_cm) as unknown
      const width = (ship.widthCm ?? ship.width_cm) as unknown
      const height = (ship.heightCm ?? ship.height_cm) as unknown
      const hasDimensions =
        typeof length === 'number' && Number.isFinite(length) &&
        typeof width === 'number' && Number.isFinite(width) &&
        typeof height === 'number' && Number.isFinite(height)
      console.debug('[econt-debug] econt-calculate body', {
        mode: 'calculate',
        hasDimensions,
        dimensions: { length: length ?? null, width: width ?? null, height: height ?? null },
        sendDimensionsFlag: integration.defaults?.default_send_dimensions_to_econt === true,
      })
    }

    const parsedSnapshot = parseShipmentInput(body.shipment ?? body, integration.defaults)
    const snapshot = await resolveShipmentOfficeDestinations(parsedSnapshot, integration)
    const payload = {
      ...buildEcontLabelPayload(snapshot, integration.defaults),
      mode: 'calculate',
    }
    const econtResponse = await econtPost('Shipments/LabelService.createLabel.json', payload, integration)
    const normalized = normalizeCalculateResult(econtResponse)

    const shipment = await upsertShipmentDraft(auth.adminClient, {
      tenantId: auth.tenantId,
      shipmentId: body.shipment_id ?? null,
      snapshot,
      priceAmount: normalized.totalPrice,
      currency: normalized.currency,
      status: 'calculated',
      econtLabelData: null,
      // Stamp created_by on the first calculate so we know who started the
      // shipment record. upsertShipmentDraft only writes columns when they
      // are explicitly passed, so later updates from other callers won't
      // overwrite this value.
      createdBy: auth.userId ?? null,
    })

    return ok({
      success: true,
      shipment,
      result: {
        carrier: 'econt',
        total_price: normalized.totalPrice,
        currency: normalized.currency,
      },
    })
  } catch (error) {
    if (errorLogContext) {
      await appendShipmentError(errorLogContext.adminClient, {
        tenantId: errorLogContext.tenantId,
        shipmentId: errorLogContext.shipmentId,
        action: 'calculate',
        error,
      })
    }
    return errorResponse(error)
  }
})
