import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase/client'
import { Distributor } from '@/types'
import { useTenant } from '@/lib/tenant/TenantProvider'

/**
 * Fetches all distributors (users with role='company')
 * Admin-only: Used for managing B2B clients and their commission rates
 */
export function useQueryDistributors() {
  const { tenant } = useTenant()
  const tenantId = tenant?.id
  return useQuery({
    queryKey: ['tenant', tenantId, 'distributors'],
    queryFn: async () => {
      if (!tenantId) return []
      // Fetch profiles where role is 'company' (distributors)
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('role', 'company')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false })

      if (error) throw error

      // Fetch emails from auth.users for each profile
      // Note: In a real app, you might want to join with a users view
      // For now, we'll use the email from the profile if available
      return (data || []) as Distributor[]
    },
    staleTime: 30 * 1000, // Cache for 30 seconds
    enabled: !!tenantId,
  })
}

/**
 * Fetches a single distributor by ID
 */
export function useQueryDistributor(distributorId: string) {
  const { tenant } = useTenant()
  const tenantId = tenant?.id
  return useQuery({
    queryKey: ['tenant', tenantId, 'distributors', distributorId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', distributorId)
        .eq('role', 'company')
        .eq('tenant_id', tenantId)
        .single()

      if (error) throw error
      return data as Distributor
    },
    enabled: !!distributorId && !!tenantId,
  })
}









