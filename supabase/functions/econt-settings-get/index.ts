import { requireTenantAuth } from '../_shared/auth.ts'
import { getSettingsResponse, getTenantEcontIntegration } from '../_shared/econt.ts'
import { errorResponse, ok, parseJson, requirePostOrOptions } from '../_shared/http.ts'

Deno.serve(async (req) => {
  try {
    const preflight = requirePostOrOptions(req)
    if (preflight) return preflight

    const body = await parseJson<{ tenant_id?: string }>(req)
    const auth = await requireTenantAuth(req, { tenantId: body.tenant_id ?? null })

    try {
      const integration = await getTenantEcontIntegration(auth.adminClient, auth.tenantId, { requireEnabled: false })
      return ok({ success: true, integration: getSettingsResponse(integration) })
    } catch (error) {
      if ((error as { status?: number })?.status === 404) {
        return ok({ success: true, integration: getSettingsResponse(null) })
      }
      throw error
    }
  } catch (error) {
    return errorResponse(error)
  }
})
