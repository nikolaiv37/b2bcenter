import type { Tenant } from '@/types'
import { APP_HOST, APP_HOSTS, PLATFORM_HOSTS, SLUG_PREFIX } from './constants'

function ensureLeadingSlash(path: string): string {
  return path.startsWith('/') ? path : `/${path}`
}

function normalizeHost(rawHost: string): string {
  return rawHost.toLowerCase().split(':')[0]
}

function getAppOriginForTenantFallback(): string {
  if (typeof window !== 'undefined') {
    const currentHost = normalizeHost(window.location.host)
    if (APP_HOSTS.has(currentHost)) {
      return `${window.location.protocol}//${window.location.host}`
    }
  }

  return `https://${APP_HOST}`
}

function isUsablePrimaryDomain(domain: string | null | undefined): domain is string {
  if (!domain) return false

  const normalized = normalizeHost(domain)
  if (normalized.endsWith('.local')) return false
  if (normalized === 'localhost' || normalized === '127.0.0.1') return false
  if (PLATFORM_HOSTS.has(normalized)) return false

  return true
}

/**
 * Build a URL to reach a tenant.
 *
 * Priority:
 *  1. Verified primary_domain (unless it points to platform/local hosts)
 *  2. App host with /t/:slug fallback
 */
export function buildTenantUrl(tenant: Tenant, path = '/dashboard'): string {
  const normalizedPath = ensureLeadingSlash(path)

  if (isUsablePrimaryDomain(tenant.primary_domain)) {
    return `https://${tenant.primary_domain}${normalizedPath}`
  }

  return `${getAppOriginForTenantFallback()}${SLUG_PREFIX}/${tenant.slug}${normalizedPath}`
}
