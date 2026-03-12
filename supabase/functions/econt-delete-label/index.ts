import { requireTenantAuth } from '../_shared/auth.ts'
import { econtPost, getTenantEcontIntegration, getTenantShipment } from '../_shared/econt.ts'
import { HttpError, errorResponse, ok, parseJson, requirePostOrOptions } from '../_shared/http.ts'

interface Body {
  tenant_id?: string
  shipment_id?: string
  reason?: string
}

Deno.serve(async (req) => {
  try {
    const preflight = requirePostOrOptions(req)
    if (preflight) return preflight

    const body = await parseJson<Body>(req)
    if (!body.shipment_id) throw new HttpError(400, 'shipment_id is required')

    const auth = await requireTenantAuth(req, { tenantId: body.tenant_id ?? null })
    const integration = await getTenantEcontIntegration(auth.adminClient, auth.tenantId, { requireEnabled: true })
    const shipment = await getTenantShipment(auth.adminClient, auth.tenantId, body.shipment_id)

    if (!shipment.econt_waybill_number) {
      throw new HttpError(409, 'Shipment does not have an Econt waybill number')
    }

    await econtPost(
      'Shipments/LabelService.deleteLabels.json',
      {
        shipmentNumbers: [shipment.econt_waybill_number],
        deleteReason: (body.reason || 'Cancelled from platform').slice(0, 255),
      },
      integration,
    )

    const now = new Date().toISOString()
    const { data: updated, error: updateError } = await auth.adminClient
      .from('shipments')
      .update({
        status: 'cancelled',
        last_synced_at: now,
      })
      .eq('id', shipment.id)
      .eq('tenant_id', auth.tenantId)
      .select('*')
      .single()

    if (updateError) {
      throw new HttpError(500, 'Failed to update shipment after cancellation')
    }

    return ok({
      success: true,
      shipment: updated,
    })
  } catch (error) {
    return errorResponse(error)
  }
})
