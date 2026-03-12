import { useTenant } from '@/lib/tenant/TenantProvider'
import { TenantInactive } from '@/pages/TenantInactive'

export function TenantActiveGuard({ children }: { children: React.ReactNode }) {
  const { tenant } = useTenant()

  if (tenant && tenant.status !== 'active') {
    return <TenantInactive />
  }

  return <>{children}</>
}
