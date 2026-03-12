import { useAuth } from '@/hooks/useAuth'
import { useTenantMemberships } from '@/hooks/useTenantMemberships'
import { TenantSelector } from '@/pages/TenantSelector'
import { NoTenantState } from '@/pages/NoTenantState'
import { PlatformLoginPage } from '@/app/auth/platform-login'
import { Navigate } from 'react-router-dom'
import { SLUG_PREFIX } from '@/lib/tenant/constants'

/**
 * Shown on the app host (centivon.vercel.app) when no tenant is resolved.
 * Unauthenticated → platform email-first login.
 * Authenticated   → auto-redirect when one workspace, selector when multiple.
 */
export function MainIndexRoute() {
  const { isAuthenticated, isLoading } = useAuth()
  const { data: memberships = [], isLoading: membershipsLoading } = useTenantMemberships()
  const singleTenantMode = import.meta.env.VITE_SINGLE_TENANT_MODE !== 'false'

  if (!isAuthenticated) {
    return <PlatformLoginPage />
  }

  if (isLoading || membershipsLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[color:var(--base)]">
        <div className="h-6 w-6 border-2 border-[color:var(--ink-12)] border-t-[color:var(--landing-accent)] rounded-full animate-spin" />
      </div>
    )
  }

  if (memberships.length === 0) {
    return <NoTenantState />
  }

  if (memberships.length === 1) {
    if (singleTenantMode) {
      return <Navigate to="/dashboard" replace />
    }
    const onlyTenant = memberships[0]?.tenant
    if (onlyTenant?.slug) {
      return <Navigate to={`${SLUG_PREFIX}/${onlyTenant.slug}/dashboard`} replace />
    }
  }

  if (singleTenantMode && memberships.length > 1) {
    return <Navigate to="/dashboard" replace />
  }

  return <TenantSelector />
}
