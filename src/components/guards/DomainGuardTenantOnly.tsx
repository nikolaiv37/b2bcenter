import { Navigate } from 'react-router-dom'
import { useTenant } from '@/lib/tenant/TenantProvider'

export function DomainGuardTenantOnly({ children }: { children: React.ReactNode }) {
  const { tenant } = useTenant()

  if (!tenant) {
    return <Navigate to="/" replace />
  }

  return <>{children}</>
}
