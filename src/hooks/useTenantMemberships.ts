import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase/client'
import { useAuthStore } from '@/stores/authStore'
import type { Tenant, TenantMembership } from '@/types'

export interface TenantMembershipWithTenant extends TenantMembership {
  tenant: Tenant & { primary_domain: string | null }
}

export function useTenantMemberships() {
  const user = useAuthStore((state) => state.user)
  const userId = user?.id

  return useQuery({
    queryKey: ['tenant-memberships', userId],
    queryFn: async () => {
      if (!userId) return [] as TenantMembershipWithTenant[]

      const { data, error } = await supabase
        .from('tenant_memberships')
        .select(
          'id, role, user_id, tenant_id, tenant:tenants(id, name, slug, status, tenant_domains(domain, verified, is_primary))'
        )
        .eq('user_id', userId)
        .order('created_at', { ascending: false })

      if (error) throw error

      const rows = (data || []) as unknown as Array<{
        id: string
        role: string
        user_id: string
        tenant_id: string
        tenant:
          | (Tenant & { tenant_domains?: Array<{ domain: string; verified: boolean; is_primary: boolean }> })
          | null
      }>

      return rows.map((row) => {
        if (!row.tenant) {
          return null
        }

        const primaryDomain =
          row.tenant.tenant_domains?.find((domain) => domain.verified && domain.is_primary)?.domain ?? null

        return {
          id: row.id,
          role: row.role,
          user_id: row.user_id,
          tenant_id: row.tenant_id,
          tenant: {
            id: row.tenant.id,
            name: row.tenant.name,
            slug: row.tenant.slug,
            status: row.tenant.status,
            branding: null,
            primary_domain: primaryDomain ?? null,
          },
        } as TenantMembershipWithTenant
      }).filter((row): row is TenantMembershipWithTenant => row !== null)
    },
    enabled: !!userId,
    staleTime: 60_000,
  })
}
