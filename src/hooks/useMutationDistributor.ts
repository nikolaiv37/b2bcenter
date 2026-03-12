import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase/client'
import { Distributor } from '@/types'
import { useTenant } from '@/lib/tenant/TenantProvider'

interface UpdateDistributorData {
  id: string
  full_name?: string
  company_name?: string
  phone?: string
  commission_rate?: number
}

/**
 * Mutation hook for updating distributor profiles
 */
export function useMutationUpdateDistributor() {
  const queryClient = useQueryClient()
  const { tenant } = useTenant()
  const tenantId = tenant?.id

  return useMutation({
    mutationFn: async (data: UpdateDistributorData) => {
      const { id, ...updates } = data
      if (!tenantId) {
        throw new Error('Missing tenant context')
      }

      const { data: distributor, error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', id)
        .eq('role', 'company') // Ensure we only update company-role profiles
        .eq('tenant_id', tenantId)
        .select()
        .single()

      if (error) throw error
      return distributor as Distributor
    },
    onSuccess: (data) => {
      // Invalidate the distributors list
      queryClient.invalidateQueries({ queryKey: ['tenant', tenantId, 'distributors'] })
      // Also invalidate the specific distributor
      queryClient.invalidateQueries({ queryKey: ['tenant', tenantId, 'distributors', data.id] })
      // Invalidate profiles queries if any component uses them
      queryClient.invalidateQueries({ queryKey: ['tenant', tenantId, 'profiles'] })
    },
  })
}

/**
 * Mutation hook for deleting distributor profiles
 * WARNING: This deletes the profile, not the auth user. 
 * In production, you might want to also delete the auth.users entry via admin API
 */
export function useMutationDeleteDistributor() {
  const queryClient = useQueryClient()
  const { tenant } = useTenant()
  const tenantId = tenant?.id

  return useMutation({
    mutationFn: async (distributorId: string) => {
      if (!tenantId) {
        throw new Error('Missing tenant context')
      }
      const { error } = await supabase
        .from('profiles')
        .delete()
        .eq('id', distributorId)
        .eq('role', 'company') // Safety check: only delete company-role profiles
        .eq('tenant_id', tenantId)

      if (error) throw error
      return distributorId
    },
    onSuccess: () => {
      // Invalidate the distributors list
      queryClient.invalidateQueries({ queryKey: ['tenant', tenantId, 'distributors'] })
      queryClient.invalidateQueries({ queryKey: ['tenant', tenantId, 'profiles'] })
    },
  })
}

interface CreateDistributorData {
  email: string
  full_name: string
  company_name?: string
  phone?: string
  commission_rate?: number
}

/**
 * Mutation hook for creating new distributor (inviting a B2B client)
 * Note: This creates a profile entry. The actual user would need to sign up separately
 * or be created via Supabase Admin API for full onboarding.
 */
export function useMutationCreateDistributor() {
  const queryClient = useQueryClient()
  const { tenant } = useTenant()
  const tenantId = tenant?.id

  return useMutation({
    mutationFn: async (_data: CreateDistributorData) => {
      void _data
      // Note: In a full implementation, you would:
      // 1. Create the auth user via Supabase Admin API
      // 2. Send an invite email
      // For now, this is a placeholder that shows the pattern
      
      // This won't work without an existing auth user, but demonstrates the pattern
      throw new Error('Creating new distributors requires admin API integration. Please have the user sign up first.')
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenant', tenantId, 'distributors'] })
    },
  })
}


