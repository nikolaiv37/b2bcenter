import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { HttpError } from './http.ts'

export type TenantRole = 'owner' | 'admin' | 'member'

export interface AuthContext {
  userId: string
  tenantId: string
  role: TenantRole
  userClient: ReturnType<typeof createClient>
  adminClient: ReturnType<typeof createClient>
}

function getEnv(name: string): string {
  const value = Deno.env.get(name)
  if (!value) throw new Error(`Missing env var: ${name}`)
  return value
}

export async function requireTenantAuth(req: Request, options?: { tenantId?: string | null; requireAdmin?: boolean }) {
  const authHeader = req.headers.get('Authorization')
  if (!authHeader) {
    throw new HttpError(401, 'Missing Authorization header')
  }

  const supabaseUrl = getEnv('SUPABASE_URL')
  const anonKey = getEnv('SUPABASE_ANON_KEY')
  const serviceRoleKey = getEnv('SUPABASE_SERVICE_ROLE_KEY')

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  })
  const adminClient = createClient(supabaseUrl, serviceRoleKey)

  const {
    data: { user },
    error: userError,
  } = await userClient.auth.getUser()

  if (userError || !user) {
    throw new HttpError(401, 'Unauthorized')
  }

  let membershipQuery = adminClient
    .from('tenant_memberships')
    .select('tenant_id, role')
    .eq('user_id', user.id)

  if (options?.tenantId) {
    membershipQuery = membershipQuery.eq('tenant_id', options.tenantId)
  }

  const { data: memberships, error: membershipError } = await membershipQuery.limit(2)
  if (membershipError) {
    throw new HttpError(500, 'Failed to resolve tenant membership')
  }

  const membership = memberships?.[0]
  if (!membership) {
    throw new HttpError(403, 'No tenant membership found')
  }

  const role = String(membership.role) as TenantRole
  const tenantId = String(membership.tenant_id)

  if (options?.requireAdmin && !['owner', 'admin'].includes(role)) {
    throw new HttpError(403, 'Tenant admin access required')
  }

  return {
    userId: user.id,
    tenantId,
    role,
    userClient,
    adminClient,
  } satisfies AuthContext
}
