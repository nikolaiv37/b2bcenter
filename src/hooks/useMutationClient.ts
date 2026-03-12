import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase/client'
import { Client } from '@/types'
import { useTenant } from '@/lib/tenant/TenantProvider'
import { sendNotification } from '@/lib/notifications'

interface UpdateClientData {
  id: string
  commission_rate?: number
}

export function useMutationUpdateClient() {
  const queryClient = useQueryClient()
  const { tenant } = useTenant()
  const tenantId = tenant?.id

  return useMutation({
    mutationFn: async (data: UpdateClientData) => {
      const { id, ...updates } = data
      if (!tenantId) {
        throw new Error('Missing tenant context')
      }

      const { data: client, error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', id)
        .eq('role', 'company')
        .eq('tenant_id', tenantId)
        .select()
        .single()

      if (error) throw error
      return client as Client
    },
    onSuccess: (data, variables) => {
      // Invalidate client queries
      queryClient.invalidateQueries({ queryKey: ['tenant', tenantId, 'clients'] })
      queryClient.invalidateQueries({ queryKey: ['tenant', tenantId, 'clients', data.id] })
      queryClient.invalidateQueries({ queryKey: ['tenant', tenantId, 'profiles'] })
      
      // If commission_rate was updated, invalidate product queries and notify the user
      if (variables.commission_rate !== undefined) {
        // Invalidate all product queries so adjusted prices are recalculated
        queryClient.invalidateQueries({ queryKey: ['tenant', tenantId, 'products'] })
        queryClient.invalidateQueries({ queryKey: ['tenant', tenantId, 'public-products'] })
        queryClient.invalidateQueries({ queryKey: ['tenant', tenantId, 'product'] })
        // Also invalidate quotes so they show updated pricing
        queryClient.invalidateQueries({ queryKey: ['tenant', tenantId, 'quotes'] })

        // Notify the affected company user about the commission change
        sendNotification({
          type: 'commission_changed',
          metadata: {
            commission_rate: Math.round(variables.commission_rate * 100),
          },
          targetAudience: 'user',
          targetUserId: data.id,
        })
      }
    },
  })
}

export function useMutationDeleteClient() {
  const queryClient = useQueryClient()
  const { tenant } = useTenant()
  const tenantId = tenant?.id

  return useMutation({
    mutationFn: async (clientId: string) => {
      if (!tenantId) {
        throw new Error('Missing tenant context')
      }
      const { error } = await supabase
        .from('profiles')
        .delete()
        .eq('id', clientId)
        .eq('role', 'company')
        .eq('tenant_id', tenantId)

      if (error) throw error
      return clientId
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenant', tenantId, 'clients'] })
      queryClient.invalidateQueries({ queryKey: ['tenant', tenantId, 'profiles'] })
    },
  })
}
