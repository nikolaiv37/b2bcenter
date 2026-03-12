import { requireTenantAuth } from '../_shared/auth.ts'
import {
  econtPost,
  getTenantEcontIntegration,
  getTenantShipment,
  getTrackingThrottleMinutes,
  normalizeTrackResult,
} from '../_shared/econt.ts'
import { HttpError, errorResponse, ok, parseJson, requirePostOrOptions } from '../_shared/http.ts'

interface Body {
  tenant_id?: string
  shipment_id?: string
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
      throw new HttpError(409, 'Shipment does not have an Econt waybill number yet')
    }

    const throttleMinutes = getTrackingThrottleMinutes(integration.defaults)
    const now = new Date()
    if (shipment.tracking_last_requested_at) {
      const last = new Date(shipment.tracking_last_requested_at)
      const nextAllowed = new Date(last.getTime() + throttleMinutes * 60 * 1000)
      if (now < nextAllowed) {
        return ok({
          success: false,
          throttled: true,
          retry_after_seconds: Math.max(1, Math.ceil((nextAllowed.getTime() - now.getTime()) / 1000)),
          retry_after_minutes: Math.max(1, Math.ceil((nextAllowed.getTime() - now.getTime()) / 60000)),
          next_allowed_at: nextAllowed.toISOString(),
        })
      }
    }

    const requestedAt = new Date().toISOString()

    const { error: reserveError } = await auth.adminClient
      .from('shipments')
      .update({
        tracking_last_requested_at: requestedAt,
      })
      .eq('id', shipment.id)
      .eq('tenant_id', auth.tenantId)

    if (reserveError) {
      throw new HttpError(500, 'Failed to reserve tracking refresh window')
    }

    const econtResponse = await econtPost(
      'Shipments/ShipmentService.getShipmentStatuses.json',
      { shipments: [{ num: shipment.econt_waybill_number }] },
      integration,
    )

    const normalized = normalizeTrackResult(econtResponse)

    const { data: updated, error: updateError } = await auth.adminClient
      .from('shipments')
      .update({
        status: normalized.status,
        last_synced_at: requestedAt,
        tracking_last_requested_at: requestedAt,
      })
      .eq('id', shipment.id)
      .eq('tenant_id', auth.tenantId)
      .select('*')
      .single()

    if (updateError) {
      throw new HttpError(500, 'Failed to update shipment tracking state')
    }

    return ok({
      success: true,
      throttled: false,
      shipment: updated,
      result: {
        carrier: 'econt',
        status: normalized.status,
        status_code: normalized.statusCode,
        status_name: normalized.statusName,
        tracked_at: normalized.trackedAt,
      },
      next_allowed_at: new Date(Date.now() + throttleMinutes * 60 * 1000).toISOString(),
      throttle_minutes: throttleMinutes,
    })
  } catch (error) {
    return errorResponse(error)
  }
})
