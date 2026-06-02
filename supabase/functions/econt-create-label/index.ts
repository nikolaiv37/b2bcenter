import { requireTenantAuth } from '../_shared/auth.ts'
import {
  appendShipmentError,
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

function pickLabelString(labelData: Record<string, unknown> | null | undefined, keys: string[]): string | null {
  if (!labelData) return null
  for (const key of keys) {
    const v = labelData[key]
    if (typeof v === 'string' && v.trim()) return v.trim()
  }
  return null
}

function readServiceDescription(labelData: Record<string, unknown> | null | undefined): string | null {
  // Phase 1.5 normalisation already puts this on labelData.service_description.
  if (!labelData) return null
  const flat = labelData.service_description
  if (typeof flat === 'string' && flat.trim()) return flat.trim()
  const raw = labelData.raw && typeof labelData.raw === 'object' ? (labelData.raw as Record<string, unknown>) : null
  const label = raw?.label && typeof raw.label === 'object' ? (raw.label as Record<string, unknown>) : null
  const services = Array.isArray(label?.services) ? (label!.services as Array<Record<string, unknown>>) : []
  const first = services[0]
  if (first && typeof first.description === 'string' && first.description.trim()) return first.description.trim()
  return null
}

function readServiceName(labelData: Record<string, unknown> | null | undefined): string | null {
  if (!labelData) return null
  const raw = labelData.raw && typeof labelData.raw === 'object' ? (labelData.raw as Record<string, unknown>) : null
  const label = raw?.label && typeof raw.label === 'object' ? (raw.label as Record<string, unknown>) : null
  const services = Array.isArray(label?.services) ? (label!.services as Array<Record<string, unknown>>) : []
  const first = services[0]
  if (first && typeof first.type === 'string' && first.type.trim()) return first.type.trim()
  return null
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
      // Phase 1.5 dedicated columns — populated from the same response we
      // already store under econt_label_data. No payload changes.
      serviceName: readServiceName(normalized.labelData),
      serviceDescription: readServiceDescription(normalized.labelData),
      expectedDeliveryAt:
        typeof normalized.labelData.expected_delivery_at === 'string'
          ? normalized.labelData.expected_delivery_at
          : null,
      pdfUrl: pickLabelString(normalized.labelData, ['pdfUrl', 'pdf_url']),
      printUrl: pickLabelString(normalized.labelData, ['printUrl', 'print_url']),
      createdBy: auth.userId ?? null,
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
    if (errorLogContext) {
      await appendShipmentError(errorLogContext.adminClient, {
        tenantId: errorLogContext.tenantId,
        shipmentId: errorLogContext.shipmentId,
        action: 'create_label',
        error,
      })
    }
    return errorResponse(error)
  }
})
