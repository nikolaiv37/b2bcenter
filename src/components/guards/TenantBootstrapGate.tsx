import { useTenant } from '@/lib/tenant/TenantProvider'
import { PortalNotFound } from '@/pages/PortalNotFound'

export function TenantBootstrapGate({ children }: { children: React.ReactNode }) {
  const { isBootstrapping, domainKind } = useTenant()

  if (isBootstrapping) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[color:var(--base)]">
        <div className="h-6 w-6 border-2 border-[color:var(--ink-12)] border-t-[color:var(--landing-accent)] rounded-full animate-spin" />
      </div>
    )
  }

  if (domainKind === 'unknown') {
    return <PortalNotFound />
  }

  return <>{children}</>
}
