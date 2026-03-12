import { supabase } from '@/lib/supabase/client'
import { MARKETING_HOSTS, APP_HOSTS, SLUG_PREFIX, SUBDOMAIN_ROOT } from './constants'
import type { Tenant } from '@/types'

export type TenantSource = 'domain' | 'subdomain' | 'slug' | 'none'
export type DomainKind = 'marketing' | 'app' | 'tenant' | 'unknown'

export interface TenantResolution {
  tenant: Tenant | null
  source: TenantSource
  domainKind: DomainKind
}

export function normalizeHost(rawHost: string): string {
  return rawHost.toLowerCase().split(':')[0]
}

/**
 * Extract tenant slug from a /t/:slug pathname.
 * Returns the slug portion or null if the path doesn't match.
 */
function extractTenantSlug(pathname: string): string | null {
  const prefix = `${SLUG_PREFIX}/`
  if (!pathname.startsWith(prefix)) return null
  const rest = pathname.slice(prefix.length)
  const slug = rest.split('/')[0]
  return slug || null
}

function getSubdomain(host: string): string | null {
  if (!host.endsWith(`.${SUBDOMAIN_ROOT}`)) return null
  const sub = host.replace(`.${SUBDOMAIN_ROOT}`, '')
  if (!sub || sub === 'www') return null
  return sub
}

async function fetchTenantById(tenantId: string): Promise<Tenant | null> {
  const { data, error } = await supabase
    .from('tenants')
    .select('id, name, slug, status, branding')
    .eq('id', tenantId)
    .single()

  if (error || !data) return null
  return data as Tenant
}

async function fetchTenantBySlug(slug: string): Promise<Tenant | null> {
  const { data, error } = await supabase
    .from('tenants')
    .select('id, name, slug, status, branding')
    .eq('slug', slug)
    .single()

  if (error || !data) return null
  return data as Tenant
}

async function fetchPrimaryDomain(tenantId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('tenant_domains')
    .select('domain, is_primary, verified')
    .eq('tenant_id', tenantId)
    .eq('verified', true)
    .eq('is_primary', true)
    .maybeSingle()

  if (error || !data) return null
  return data.domain
}

function withPrimaryDomain(tenant: Tenant, primaryDomain: string | null): Tenant {
  return {
    ...tenant,
    primary_domain: primaryDomain ?? null,
  }
}

export async function resolveTenant(hostInput: string, pathname: string): Promise<TenantResolution> {
  const host = normalizeHost(hostInput)
  const isVercelPreviewHost = host.endsWith('.vercel.app')

  // ── Marketing hosts: never resolve tenants ──
  if (MARKETING_HOSTS.has(host)) {
    return { tenant: null, source: 'none', domainKind: 'marketing' }
  }

  // ── App host: tenant via /t/:slug ──
  if (APP_HOSTS.has(host) || isVercelPreviewHost) {
    const slug = extractTenantSlug(pathname)
    if (slug) {
      const tenant = await fetchTenantBySlug(slug)
      const primaryDomain = tenant ? await fetchPrimaryDomain(tenant.id) : null
      return {
        tenant: tenant ? withPrimaryDomain(tenant, primaryDomain) : null,
        source: tenant ? 'slug' : 'none',
        domainKind: 'app',
      }
    }
    return { tenant: null, source: 'none', domainKind: 'app' }
  }

  // ── Custom tenant domain (verified in tenant_domains) ──
  const { data: domainRow } = await supabase
    .from('tenant_domains')
    .select('tenant_id, domain, is_primary, verified')
    .eq('domain', host)
    .eq('verified', true)
    .maybeSingle()

  if (domainRow?.tenant_id) {
    const tenant = await fetchTenantById(domainRow.tenant_id)
    const primaryDomain = domainRow.is_primary ? domainRow.domain : await fetchPrimaryDomain(domainRow.tenant_id)
    return {
      tenant: tenant ? withPrimaryDomain(tenant, primaryDomain) : null,
      source: 'domain',
      domainKind: 'tenant',
    }
  }

  // ── Subdomain on centivon.com (e.g. evromar.centivon.com) ──
  const subdomain = getSubdomain(host)
  if (subdomain) {
    const tenant = await fetchTenantBySlug(subdomain)
    const primaryDomain = tenant ? await fetchPrimaryDomain(tenant.id) : null
    return {
      tenant: tenant ? withPrimaryDomain(tenant, primaryDomain) : null,
      source: tenant ? 'subdomain' : 'none',
      domainKind: tenant ? 'tenant' : 'unknown',
    }
  }

  return { tenant: null, source: 'none', domainKind: 'unknown' }
}

export function getSlugCandidate(pathname: string): string | null {
  return extractTenantSlug(pathname)
}
