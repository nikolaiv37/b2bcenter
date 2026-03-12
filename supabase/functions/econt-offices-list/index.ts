import { requireTenantAuth } from '../_shared/auth.ts'
import { getTenantEcontIntegration, listTenantEcontOffices } from '../_shared/econt.ts'
import { errorResponse, ok, parseJson, requirePostOrOptions } from '../_shared/http.ts'

interface Body {
  tenant_id?: string
  query?: string
  limit?: number
}

Deno.serve(async (req) => {
  try {
    const preflight = requirePostOrOptions(req)
    if (preflight) return preflight

    const body = await parseJson<Body>(req)
    const auth = await requireTenantAuth(req, { tenantId: body.tenant_id ?? null })
    const integration = await getTenantEcontIntegration(auth.adminClient, auth.tenantId, { requireEnabled: true })

    const offices = await listTenantEcontOffices(integration, {
      query: body.query ?? null,
      limit: body.limit ?? 500,
    })

    return ok({
      success: true,
      offices,
      count: offices.length,
    })
  } catch (error) {
    return errorResponse(error)
  }
})

