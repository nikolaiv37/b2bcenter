import type { Tenant } from '@/types'
import { MARKETING_HOSTS } from './constants'

export type TenantSource = 'none'
export type DomainKind = 'marketing' | 'app'

export interface TenantResolution {
  tenant: Tenant | null
  source: TenantSource
  domainKind: DomainKind
}

export function normalizeHost(rawHost: string): string {
  return rawHost.toLowerCase().split(':')[0]
}

/**
 * Single-tenant deployment: tenant is never selected by hostname/path.
 * Membership lookup in TenantProvider is the source of truth.
 */
export async function resolveTenant(hostInput: string, _pathname: string): Promise<TenantResolution> {
  const host = normalizeHost(hostInput)

  if (MARKETING_HOSTS.has(host)) {
    return { tenant: null, source: 'none', domainKind: 'marketing' }
  }

  return { tenant: null, source: 'none', domainKind: 'app' }
}

export function getSlugCandidate(_pathname: string): string | null {
  return null
}
