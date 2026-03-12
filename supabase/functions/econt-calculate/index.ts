import { requireTenantAuth } from '../_shared/auth.ts'
import {
  buildEcontLabelPayload,
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
  try {
    const preflight = requirePostOrOptions(req)
    if (preflight) return preflight

    const body = await parseJson<Body>(req)
    const auth = await requireTenantAuth(req, { tenantId: body.tenant_id ?? null })
    const integration = await getTenantEcontIntegration(auth.adminClient, auth.tenantId, { requireEnabled: true })

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
    return errorResponse(error)
  }
})
