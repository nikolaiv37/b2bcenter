import { GlassCard } from '@/components/GlassCard'
import { Button } from '@/components/ui/button'
import { useTenantMemberships } from '@/hooks/useTenantMemberships'
import { buildTenantUrl } from '@/lib/tenant/urls'
import { Building2 } from 'lucide-react'

export function TenantSelector() {
  const { data: memberships = [], isLoading } = useTenantMemberships()

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="h-6 w-6 border-2 border-[color:var(--ink-12)] border-t-[color:var(--landing-accent)] rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <GlassCard className="max-w-lg w-full text-center">
        <Building2 className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
        <h1 className="text-2xl font-bold mb-2">Select a tenant</h1>
        <p className="text-muted-foreground mb-6">Choose which tenant you want to access.</p>
        <div className="space-y-3">
          {memberships.map((membership) => {
            if (!membership) return null
            const tenant = membership.tenant
            const tenantUrl = buildTenantUrl(tenant, '/dashboard')

            return (
              <a key={membership.id} href={tenantUrl} className="block">
                <Button variant="outline" className="w-full justify-between">
                  <span>{tenant.name}</span>
                  <span className="text-xs text-muted-foreground">{tenant.slug}</span>
                </Button>
              </a>
            )
          })}
        </div>
      </GlassCard>
    </div>
  )
}
