import { Navigate } from 'react-router-dom'
import { useTenant } from '@/lib/tenant/TenantProvider'

export function DomainGuardMainOnly({ children }: { children: React.ReactNode }) {
  const { domainKind } = useTenant()

  if (domainKind === 'tenant') {
    return <Navigate to="/" replace />
  }

  return <>{children}</>
}
