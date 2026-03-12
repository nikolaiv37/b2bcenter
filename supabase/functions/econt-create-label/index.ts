import { requireTenantAuth } from '../_shared/auth.ts'
import {
  buildEcontLabelPayload,
  econtPost,
  getTenantEcontIntegration,
  getTenantShipment,
  normalizeCreateLabelResult,
  parseShipmentInput,
  resolveShipmentOfficeDestinations,
  shipmentRowToInput,
  upsertShipmentDraft,
} from '../_shared/econt.ts'
import { HttpError, errorResponse, ok, parseJson, requirePostOrOptions } from '../_shared/http.ts'

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

    let existingShipment = null
    if (body.shipment_id) {
      existingShipment = await getTenantShipment(auth.adminClient, auth.tenantId, body.shipment_id)
    }

    const parsedSnapshot = body.shipment
      ? parseShipmentInput(body.shipment, integration.defaults)
      : existingShipment
        ? shipmentRowToInput(existingShipment)
        : null

    if (!parsedSnapshot) {
      throw new HttpError(400, 'shipment payload or shipment_id is required')
    }
    const snapshot = await resolveShipmentOfficeDestinations(parsedSnapshot, integration)

    const payload = {
      ...buildEcontLabelPayload(snapshot, integration.defaults),
      mode: 'create',
    }
    const econtResponse = await econtPost('Shipments/LabelService.createLabel.json', payload, integration)
    const normalized = normalizeCreateLabelResult(econtResponse)

    if (!normalized.waybillNumber) {
      throw new HttpError(502, 'Econt label created but no waybill number was returned')
    }

    const shipment = await upsertShipmentDraft(auth.adminClient, {
      tenantId: auth.tenantId,
      shipmentId: body.shipment_id ?? null,
      snapshot,
      priceAmount: normalized.price.totalPrice,
      currency: normalized.price.currency,
      status: 'created',
      econtWaybillNumber: normalized.waybillNumber,
      econtLabelData: normalized.labelData,
    })

    return ok({
      success: true,
      shipment,
      result: {
        carrier: 'econt',
        waybill_number: normalized.waybillNumber,
        label: normalized.labelData,
        total_price: normalized.price.totalPrice,
        currency: normalized.price.currency,
      },
    })
  } catch (error) {
    return errorResponse(error)
  }
})
