import { requireTenantAuth } from '../_shared/auth.ts'
import { getSettingsResponse, getTenantEcontIntegration } from '../_shared/econt.ts'
import { errorResponse, ok, parseJson, requirePostOrOptions } from '../_shared/http.ts'

Deno.serve(async (req) => {
  try {
    const preflight = requirePostOrOptions(req)
    if (preflight) return preflight

    const body = await parseJson<{ tenant_id?: string }>(req)
    const auth = await requireTenantAuth(req, { tenantId: body.tenant_id ?? null })

    // Only expose the saved username to tenant admins/owners (the settings
    // screen). Regular members who hit this endpoint (e.g. the shipment panel)
    // still get has_credentials but no username.
    const includeUsername = auth.role === 'owner' || auth.role === 'admin'

    try {
      const integration = await getTenantEcontIntegration(auth.adminClient, auth.tenantId, { requireEnabled: false })
      return ok({ success: true, integration: await getSettingsResponse(integration, { includeUsername }) })
    } catch (error) {
      if ((error as { status?: number })?.status === 404) {
        return ok({ success: true, integration: await getSettingsResponse(null, { includeUsername }) })
      }
      throw error
    }
  } catch (error) {
    return errorResponse(error)
  }
})
