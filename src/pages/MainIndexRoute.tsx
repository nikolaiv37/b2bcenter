import { Navigate } from 'react-router-dom'
import { PageLoader } from '@/components/PageLoader'
import { useAuth } from '@/hooks/useAuth'

/**
 * Entry route for standalone single-tenant deployment.
 * Unauthenticated users go to /auth/login.
 * Authenticated users go to /dashboard.
 */
export function MainIndexRoute() {
  const { isAuthenticated, isLoading } = useAuth()

  if (isLoading) return <PageLoader />

  return isAuthenticated ? <Navigate to="/dashboard" replace /> : <Navigate to="/auth/login" replace />
}
