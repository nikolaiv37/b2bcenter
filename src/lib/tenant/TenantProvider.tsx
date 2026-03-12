import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { useLocation } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase/client'
import type { Tenant, TenantMembership } from '@/types'
import { normalizeHost, type DomainKind, type TenantSource } from './resolveTenant'
import { MARKETING_HOSTS } from './constants'

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

  const normalizedHost = useMemo(() => normalizeHost(window.location.host), [])
  const isMarketingHost = useMemo(() => MARKETING_HOSTS.has(normalizedHost), [normalizedHost])

  const [tenant, setTenant] = useState<Tenant | null>(null)
  const [source, setSource] = useState<TenantSource>('none')
  const [domainKind, setDomainKind] = useState<DomainKind>(isMarketingHost ? 'marketing' : 'app')
  const [session, setSession] = useState<Session | null>(null)
  const [membership, setMembership] = useState<TenantMembership | null>(null)
  const [membershipChecked, setMembershipChecked] = useState(isMarketingHost)
  const [isBootstrapping, setIsBootstrapping] = useState(!isMarketingHost)
  const hasBootstrappedRef = useRef(isMarketingHost)
  const refreshInFlightRef = useRef<Promise<void> | null>(null)
  const prevTenantIdRef = useRef<string | null>(null)

  const tenantBasePath = useMemo(() => '', [])

  const clearTenantQueries = useCallback(
    (oldTenantId: string) => {
      queryClient.removeQueries({
        predicate: (query) => Array.isArray(query.queryKey) && query.queryKey.includes(oldTenantId),
      })
    },
    [queryClient]
  )

  const refresh = useCallback(async () => {
    if (isMarketingHost) {
      setTenant(null)
      setSource('none')
      setDomainKind('marketing')
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
      const shouldBlock = !hasBootstrappedRef.current
      const timeoutMs = shouldBlock ? 800 : 8000

      if (shouldBlock) {
        setIsBootstrapping(true)
        setMembershipChecked(false)
      }

      try {
        const { data } = await withTimeout(supabase.auth.getSession(), timeoutMs, 'getSession')
        const nextSession = data.session ?? null

        let nextTenant: Tenant | null = null
        let nextMembership: TenantMembership | null = null
        let nextMembershipChecked = true

        if (nextSession?.user) {
          const queryMembership = () =>
            supabase
              .from('tenant_memberships')
              .select(
                'id, user_id, tenant_id, role, tenant:tenants(id, name, slug, status, branding, tenant_domains(domain, verified, is_primary))'
              )
              .eq('user_id', nextSession.user.id)
              .order('created_at', { ascending: false })
              .limit(1)

          const { data: membershipRows } = await withTimeout(queryMembership(), timeoutMs, 'membershipLookup')

          const row = ((membershipRows as TenantMembershipRow[] | null) || [])[0] ?? null
          nextTenant = mapTenantFromMembershipRow(row)

          if (row) {
            nextMembership = {
              id: row.id,
              user_id: row.user_id,
              tenant_id: row.tenant_id,
              role: row.role,
            }
          }

          if (shouldBlock && !nextMembership) {
            await new Promise((r) => setTimeout(r, 600))
            const { data: retryRows } = await withTimeout(queryMembership(), timeoutMs, 'membershipRetry')
            const retryRow = ((retryRows as TenantMembershipRow[] | null) || [])[0] ?? null
            if (retryRow) {
              nextTenant = mapTenantFromMembershipRow(retryRow)
              nextMembership = {
                id: retryRow.id,
                user_id: retryRow.user_id,
                tenant_id: retryRow.tenant_id,
                role: retryRow.role,
              }
            }
          }

          nextMembershipChecked = true
        }

        setTenant(nextTenant)
        setSource('none')
        setDomainKind('app')
        setSession(nextSession)
        setMembership(nextMembership)
        setMembershipChecked(nextMembershipChecked)

        const prevTenantId = prevTenantIdRef.current
        const nextTenantId = nextTenant?.id ?? null
        if (prevTenantId && prevTenantId !== nextTenantId) {
          clearTenantQueries(prevTenantId)
        }
        prevTenantIdRef.current = nextTenantId
      } catch (error) {
        if (!isTimeoutError(error)) {
          console.error('Tenant refresh failed; keeping prior state:', error)
        }
        if (shouldBlock) {
          setMembershipChecked(true)
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
  }, [clearTenantQueries, isMarketingHost])

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
  }, [location.pathname, refresh])

  useEffect(() => {
    const { data: subscription } = supabase.auth.onAuthStateChange(async () => {
      await refresh()
    })

    return () => {
      subscription.subscription.unsubscribe()
    }
  }, [refresh])

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
