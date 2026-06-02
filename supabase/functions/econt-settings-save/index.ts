import { requireTenantAuth } from '../_shared/auth.ts'
import { ECONT_PROVIDER, encryptEcontCredentials, getSettingsResponse, normalizeDefaults } from '../_shared/econt.ts'
import { HttpError, errorResponse, ok, parseJson, requirePostOrOptions } from '../_shared/http.ts'

interface SaveBody {
  tenant_id?: string
  enabled?: boolean
  environment?: 'demo' | 'prod'
  username?: string
  password?: string
  clear_credentials?: boolean
  defaults?: Record<string, unknown>
}

Deno.serve(async (req) => {
  try {
    const preflight = requirePostOrOptions(req)
    if (preflight) return preflight

    const body = await parseJson<SaveBody>(req)
    const auth = await requireTenantAuth(req, { tenantId: body.tenant_id ?? null, requireAdmin: true })

    const enabled = Boolean(body.enabled)
    const environment = body.environment === 'prod' ? 'prod' : 'demo'

    const { data: existing, error: existingError } = await auth.adminClient
      .from('tenant_integrations')
      .select('id, credentials, enabled, environment, defaults, provider, tenant_id')
      .eq('tenant_id', auth.tenantId)
      .eq('provider', ECONT_PROVIDER)
      .maybeSingle()

    if (existingError) {
      throw new HttpError(500, 'Failed to load existing Econt settings')
    }

    // Merge existing defaults with the submitted ones BEFORE normalising. This
    // protects against two failure modes:
    //   (a) An older client UI that doesn't include a recently-added field —
    //       its absence in the body would otherwise wipe the stored value.
    //   (b) Unknown future fields stored on the row by another code path —
    //       a strict whitelist would silently drop them.
    // Submitted values win over existing values for any overlapping key.
    const existingDefaults =
      existing?.defaults && typeof existing.defaults === 'object'
        ? (existing.defaults as Record<string, unknown>)
        : {}
    const submittedDefaults =
      body.defaults && typeof body.defaults === 'object'
        ? (body.defaults as Record<string, unknown>)
        : {}
    const mergedDefaults: Record<string, unknown> = { ...existingDefaults, ...submittedDefaults }
    const defaults = normalizeDefaults(mergedDefaults)

    const username = body.username?.trim()
    const password = body.password?.trim()

    let credentials = (existing?.credentials as Record<string, unknown> | undefined) ?? {}
    if (body.clear_credentials) {
      credentials = {}
    } else if ((username && !password) || (!username && password)) {
      throw new HttpError(400, 'Provide both username and password to update credentials')
    } else if (username && password) {
      credentials = await encryptEcontCredentials({ username, password })
    }

    const { data: saved, error: saveError } = await auth.adminClient
      .from('tenant_integrations')
      .upsert(
        {
          id: existing?.id,
          tenant_id: auth.tenantId,
          provider: ECONT_PROVIDER,
          enabled,
          environment,
          credentials,
          defaults,
        },
        { onConflict: 'tenant_id,provider' },
      )
      .select('id, tenant_id, provider, enabled, environment, credentials, defaults')
      .single()

    if (saveError) {
      throw new HttpError(500, `Failed to save Econt settings: ${saveError.message}`)
    }

    return ok({ success: true, integration: getSettingsResponse(saved) })
  } catch (error) {
    return errorResponse(error)
  }
})
