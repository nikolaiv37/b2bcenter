import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { useLocation } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase/client'
import type { Tenant, TenantMembership } from '@/types'
import { resolveTenant, getSlugCandidate, normalizeHost, type TenantSource, type DomainKind } from './resolveTenant'
import { MARKETING_HOSTS, APP_HOSTS, PLATFORM_HOSTS, SLUG_PREFIX } from './constants'

interface TenantContextValue {
  tenant: Tenant | null
  source: TenantSource
  domainKind: DomainKind
  session: Session | null
  membership: TenantMembership | null
  membershipChecked: boolean
  isBootstrapping: boolean
  refresh: () => Promise<void>
  tenantBasePath: string
}

const TenantContext = createContext<TenantContextValue | null>(null)

type TenantMembershipRow = {
  id: string
  user_id: string
  tenant_id: string
  role: string
  tenant:
    | (Tenant & {
        tenant_domains?: Array<{ domain: string; verified: boolean; is_primary: boolean }>
      })
    | null
}

function ensureLeadingSlash(path: string): string {
  return path.startsWith('/') ? path : `/${path}`
}

function stripSlugPrefix(pathname: string, slug: string): string {
  const prefix = `${SLUG_PREFIX}/${slug}`
  if (pathname === prefix) return '/'
  if (pathname.startsWith(`${prefix}/`)) return pathname.slice(prefix.length)
  return pathname
}

function buildCanonicalUrl(params: {
  primaryDomain: string
  pathname: string
  search: string
  hash: string
  slug?: string | null
}): string {
  const { primaryDomain, pathname, search, hash, slug } = params
  const normalizedPath = slug ? stripSlugPrefix(pathname, slug) : pathname
  return `https://${primaryDomain}${normalizedPath}${search}${hash}`
}

function shouldRedirectToCanonical(args: {
  primaryDomain: string | null | undefined
  currentHost: string
  source: TenantSource
  singleTenantMode: boolean
}): boolean {
  const { primaryDomain, currentHost, source, singleTenantMode } = args
  if (!primaryDomain) return false
  if (singleTenantMode) return false
  const normalizedPrimary = normalizeHost(primaryDomain)
  if (source === 'domain') return false
  // Safety: never redirect to local or platform-owned hosts.
  if (normalizedPrimary.endsWith('.local')) return false
  if (normalizedPrimary === 'localhost' || normalizedPrimary === '127.0.0.1') return false
  if (PLATFORM_HOSTS.has(normalizedPrimary)) return false
  return currentHost !== normalizedPrimary
}

class TimeoutError extends Error {
  label: string
  constructor(label: string) {
    super(`Timeout: ${label}`)
    this.name = 'TimeoutError'
    this.label = label
  }
}

function isTimeoutError(error: unknown): error is TimeoutError {
  return error instanceof TimeoutError
}

function withTimeout<T>(promiseLike: PromiseLike<T>, ms: number, label: string): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | null = null
  const timeout = new Promise<T>((_, reject) => {
    timeoutId = setTimeout(() => reject(new TimeoutError(label)), ms)
  })

  const promise = Promise.resolve(promiseLike)

  return Promise.race([promise, timeout]).finally(() => {
    if (timeoutId) {
      clearTimeout(timeoutId)
    }
  })
}

function mapTenantFromMembershipRow(row: TenantMembershipRow | null): Tenant | null {
  if (!row?.tenant) return null

  const primaryDomain =
    row.tenant.tenant_domains?.find((domain) => domain.verified && domain.is_primary)?.domain ?? null

  return {
    id: row.tenant.id,
    name: row.tenant.name,
    slug: row.tenant.slug,
    status: row.tenant.status,
    branding: row.tenant.branding ?? null,
    primary_domain: primaryDomain,
  }
}

export function TenantProvider({ children }: { children: React.ReactNode }) {
  const location = useLocation()
  const queryClient = useQueryClient()
  const singleTenantMode = import.meta.env.VITE_SINGLE_TENANT_MODE !== 'false'

  // Detect host category synchronously so the first render never shows a
  // spinner on pages that don't need tenant resolution.
  const normalizedHost = useMemo(() => normalizeHost(window.location.host), [])
  const isMarketingHost = useMemo(
    () => MARKETING_HOSTS.has(normalizedHost),
    [normalizedHost]
  )
  const isAppLikeHost = useMemo(
    () => singleTenantMode || APP_HOSTS.has(normalizedHost) || normalizedHost.endsWith('.vercel.app'),
    [normalizedHost, singleTenantMode]
  )
  const slugCandidate = useMemo(() => getSlugCandidate(location.pathname), [location.pathname])
  const isAppHostNoSlug = useMemo(
    () => !singleTenantMode && isAppLikeHost && !slugCandidate,
    [singleTenantMode, isAppLikeHost, slugCandidate]
  )
  // Skip the blocking bootstrap spinner for marketing hosts and for the
  // app host when there is no /t/:slug in the path (e.g. /auth/login, /).
  // Auth state still loads in the background via refresh().
  const skipBootstrap = isMarketingHost || isAppHostNoSlug

  const [tenant, setTenant] = useState<Tenant | null>(null)
  const [source, setSource] = useState<TenantSource>('none')
  const [domainKind, setDomainKind] = useState<DomainKind>(isMarketingHost ? 'marketing' : 'app')
  const [session, setSession] = useState<Session | null>(null)
  const [membership, setMembership] = useState<TenantMembership | null>(null)
  const [membershipChecked, setMembershipChecked] = useState(skipBootstrap)
  const [isBootstrapping, setIsBootstrapping] = useState(!skipBootstrap)
  const hasBootstrappedRef = useRef(skipBootstrap)
  const refreshInFlightRef = useRef<Promise<void> | null>(null)
  const prevTenantIdRef = useRef<string | null>(null)

  const tenantBasePath = useMemo(() => {
    if (tenant && source === 'slug') {
      return `${SLUG_PREFIX}/${tenant.slug}`
    }
    return ''
  }, [tenant, source])

  const clearTenantQueries = useCallback(
    (oldTenantId: string) => {
      queryClient.removeQueries({
        predicate: (query) => Array.isArray(query.queryKey) && query.queryKey.includes(oldTenantId),
      })
    },
    [queryClient]
  )

  const refresh = useCallback(async () => {
    // Marketing hosts: no async work, ever.
    if (isMarketingHost) return
    // App host without /t/:slug (/, /auth/*, /platform/*): tenant resolution and
    // membership checks are unnecessary and can hang on getSession() after redirects.
    // Auth state for these pages is handled by useAuth's Supabase listener.
    if (isAppHostNoSlug) {
      setTenant(null)
      setSource('none')
      setDomainKind('app')
      setMembership(null)
      setMembershipChecked(true)
      setIsBootstrapping(false)
      if (!hasBootstrappedRef.current) {
        hasBootstrappedRef.current = true
      }
      return
    }

    if (refreshInFlightRef.current) {
      return refreshInFlightRef.current
    }

    const run = (async () => {
    const host = window.location.host
    const { pathname, search, hash } = window.location

    const shouldBlock = !hasBootstrappedRef.current
    // The first tenant bootstrap can race Supabase auth initialization after a hard
    // redirect (login -> /t/:slug/dashboard). If that happens, an 8s timeout creates
    // a very visible spinner even though a follow-up refresh usually succeeds quickly.
    // Keep the blocking phase short, then let the next refresh finish in background.
    const timeoutMs = shouldBlock ? 800 : 8000
    if (shouldBlock) {
      setIsBootstrapping(true)
      setMembershipChecked(false)
    }

    try {
      const sessionPromise = withTimeout(supabase.auth.getSession(), timeoutMs, 'getSession')
      const resolvePromise = withTimeout(resolveTenant(host, pathname), timeoutMs, 'resolveTenant')

      const [sessionResult, resolution] = await Promise.all([sessionPromise, resolvePromise])

      const nextSession = sessionResult.data.session ?? null
      let nextMembership: TenantMembership | null = null
      let nextMembershipChecked = true
      let nextTenant = resolution.tenant
      let nextSource = resolution.source
      let nextDomainKind = resolution.domainKind

      if (singleTenantMode && !nextTenant && nextSession?.user) {
        const querySingleTenantMembership = () =>
          supabase
            .from('tenant_memberships')
            .select(
              'id, user_id, tenant_id, role, tenant:tenants(id, name, slug, status, branding, tenant_domains(domain, verified, is_primary))'
            )
            .eq('user_id', nextSession.user.id)
            .order('created_at', { ascending: false })
            .limit(1)

        const { data: membershipRows } = await withTimeout(
          querySingleTenantMembership(),
          timeoutMs,
          'singleTenantMembership'
        )

        const row = ((membershipRows as TenantMembershipRow[] | null) || [])[0] ?? null
        const tenantFromMembership = mapTenantFromMembershipRow(row)
        if (row && tenantFromMembership) {
          nextTenant = tenantFromMembership
          nextSource = 'none'
          nextDomainKind = 'app'
          nextMembership = {
            id: row.id,
            user_id: row.user_id,
            tenant_id: row.tenant_id,
            role: row.role,
          }
        }
      }

      if (nextTenant && nextSession?.user) {
        if (shouldBlock) {
          nextMembershipChecked = false
        }

        if (!nextMembership || nextMembership.tenant_id !== nextTenant.id) {
          const queryMembership = () =>
            supabase
              .from('tenant_memberships')
              .select('id, user_id, tenant_id, role')
              .eq('user_id', nextSession.user.id)
              .eq('tenant_id', nextTenant.id)
              .maybeSingle()

          const { data } = await withTimeout(queryMembership(), timeoutMs, 'membershipCheck')
          nextMembership = (data as TenantMembership) || null

          // Bootstrap retry: on the very first load after a login redirect the
          // Supabase PostgREST layer may not have picked up the fresh JWT yet,
          // so the RLS-filtered query returns null for a valid member. A single
          // retry after a short pause lets the client catch up and resolves the
          // race reliably. The delay is invisible to the user (hidden behind
          // the loading spinner) and only fires when the first check fails.
          if (shouldBlock && !nextMembership) {
            await new Promise((r) => setTimeout(r, 600))
            const { data: retryData } = await withTimeout(queryMembership(), timeoutMs, 'membershipRetry')
            nextMembership = (retryData as TenantMembership) || null
          }
        }

        nextMembershipChecked = true
      } else if (shouldBlock && nextTenant && !nextSession) {
        // During bootstrap, getSession() can return null if the Supabase
        // client hasn't finished loading the session from localStorage yet.
        // Don't mark membership as checked — a follow-up refresh (triggered
        // by onAuthStateChange once the session is available) will re-check.
        nextMembershipChecked = false
      }

      setTenant(nextTenant)
      setSource(nextSource)
      setDomainKind(nextDomainKind)
      setSession(nextSession)
      setMembership(nextMembership)
      setMembershipChecked(nextMembershipChecked)

      const prevTenantId = prevTenantIdRef.current
      const nextTenantId = nextTenant?.id ?? null
      if (prevTenantId && prevTenantId !== nextTenantId) {
        clearTenantQueries(prevTenantId)
      }
      prevTenantIdRef.current = nextTenantId

      const primaryDomain = nextTenant?.primary_domain
      if (
        nextTenant &&
        shouldRedirectToCanonical({
          primaryDomain,
          currentHost: host.toLowerCase().split(':')[0],
          source: nextSource,
          singleTenantMode,
        })
      ) {
        if (!nextSession?.user) {
          window.location.replace(
            buildCanonicalUrl({
              primaryDomain: primaryDomain!,
              pathname,
              search,
              hash,
              slug: nextSource === 'slug' ? nextTenant.slug : null,
            })
          )
          return
        }

        if (nextSession?.user && nextMembership) {
          window.location.replace(
            buildCanonicalUrl({
              primaryDomain: primaryDomain!,
              pathname,
              search,
              hash,
              slug: nextSource === 'slug' ? nextTenant.slug : null,
            })
          )
        }
      }
    } catch (error) {
      if (isTimeoutError(error)) {
        if (shouldBlock) {
          setMembershipChecked(true)
        }
      } else {
        console.error('Tenant refresh failed; keeping prior state:', error)
        if (shouldBlock) {
          setMembershipChecked(true)
        }
      }
    } finally {
      setIsBootstrapping(false)
      if (!hasBootstrappedRef.current) {
        hasBootstrappedRef.current = true
      }
    }
    })()

    refreshInFlightRef.current = run
    try {
      await run
    } finally {
      if (refreshInFlightRef.current === run) {
        refreshInFlightRef.current = null
      }
    }
  }, [clearTenantQueries, isMarketingHost, isAppHostNoSlug, singleTenantMode])

  useEffect(() => {
    let active = true
    const run = async () => {
      await refresh()
      if (!active) return
    }

    run()

    return () => {
      active = false
    }
  }, [slugCandidate, refresh])

  useEffect(() => {
    const { data: subscription } = supabase.auth.onAuthStateChange(async () => {
      await refresh()
    })

    return () => {
      subscription.subscription.unsubscribe()
    }
  }, [refresh])

  // Safety-net: if bootstrap completed without checking membership (because
  // getSession() returned null during Supabase client initialization), and
  // onAuthStateChange's refresh() coalesced with the bootstrap refresh,
  // we'd be stuck with membershipChecked=false. This effect triggers a
  // fresh re-check once bootstrap is done.
  useEffect(() => {
    if (!isBootstrapping && !membershipChecked) {
      refresh()
    }
  }, [isBootstrapping, membershipChecked, refresh])

  useEffect(() => {
    const handleFocus = () => {
      refresh()
    }
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        refresh()
      }
    }

    window.addEventListener('focus', handleFocus)
    document.addEventListener('visibilitychange', handleVisibility)

    return () => {
      window.removeEventListener('focus', handleFocus)
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [refresh])

  const value = useMemo<TenantContextValue>(
    () => ({
      tenant,
      source,
      domainKind,
      session,
      membership,
      membershipChecked,
      isBootstrapping,
      refresh,
      tenantBasePath,
    }),
    [tenant, source, domainKind, session, membership, membershipChecked, isBootstrapping, refresh, tenantBasePath]
  )

  return <TenantContext.Provider value={value}>{children}</TenantContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useTenant() {
  const ctx = useContext(TenantContext)
  if (!ctx) {
    throw new Error('useTenant must be used within TenantProvider')
  }
  return ctx
}

// eslint-disable-next-line react-refresh/only-export-components
export function useTenantPath() {
  const { tenantBasePath } = useTenant()

  const withBase = useCallback(
    (path: string) => {
      if (!tenantBasePath) return ensureLeadingSlash(path)
      return `${tenantBasePath}${ensureLeadingSlash(path)}`
    },
    [tenantBasePath]
  )

  const stripBase = useCallback(
    (pathname: string) => {
      if (!tenantBasePath) return pathname
      if (pathname === tenantBasePath) return '/'
      if (pathname.startsWith(`${tenantBasePath}/`)) {
        return pathname.slice(tenantBasePath.length)
      }
      return pathname
    },
    [tenantBasePath]
  )

  return { tenantBasePath, withBase, stripBase }
}
