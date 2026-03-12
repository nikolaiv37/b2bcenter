import { Navigate } from 'react-router-dom'
import { useTenantPath, useTenant } from '@/lib/tenant/TenantProvider'

export function SignupGuard({ children }: { children: React.ReactNode }) {
  const { domainKind } = useTenant()
  const { withBase } = useTenantPath()

  if (domainKind === 'tenant') {
    return <Navigate to={withBase('/auth/login')} replace />
  }

  return <>{children}</>
}
