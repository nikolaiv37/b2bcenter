import { useTenant } from '@/lib/tenant/TenantProvider'
import { NoAccessPortal } from '@/pages/NoAccessPortal'

export function MembershipGuard({ children }: { children: React.ReactNode }) {
  const { membership, membershipChecked } = useTenant()

  if (!membershipChecked) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="h-6 w-6 border-2 border-[color:var(--ink-12)] border-t-[color:var(--landing-accent)] rounded-full animate-spin" />
      </div>
    )
  }

  // Safety net: if someone navigates directly to /dashboard without membership
  if (!membership) {
    return <NoAccessPortal />
  }

  return <>{children}</>
}
