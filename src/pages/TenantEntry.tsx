import { Navigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { useTenant, useTenantPath } from '@/lib/tenant/TenantProvider'
import { LoginPage } from '@/app/auth/login'
import { NoAccessPortal } from '@/pages/NoAccessPortal'

export function TenantEntry() {
  const { isAuthenticated, isLoading } = useAuth()
  const { tenant, membership, membershipChecked } = useTenant()
  const { withBase } = useTenantPath()

  if (!tenant) {
    return null
  }

  // Show spinner while membership is loading, or while auth user is still unknown.
  // If user is already authenticated, don't block this redirect on profile bootstrap.
  if ((!isAuthenticated && isLoading) || !membershipChecked) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="h-6 w-6 border-2 border-[color:var(--ink-12)] border-t-[color:var(--landing-accent)] rounded-full animate-spin" />
      </div>
    )
  }

  if (!isAuthenticated) {
    return <LoginPage />
  }

  // Authenticated but not a member of this tenant — show inline error
  // with a "Switch account" button. No redirect / auto-signout needed.
  if (!membership) {
    return <NoAccessPortal />
  }

  return <Navigate to={withBase('/dashboard')} replace />
}
