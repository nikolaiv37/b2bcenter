import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useAppContext } from '@/lib/app/AppContext'
import { supabase } from '@/lib/supabase/client'
import { Client } from '@/types'
import { sendNotification } from '@/lib/notifications'

interface UpdateClientData {
  id: string
  commission_rate?: number
}

export function useMutationUpdateClient() {
  const queryClient = useQueryClient()
  const { workspaceId: tenantId } = useAppContext()

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
        .maybeSingle()

      if (error) throw error
      if (!client) {
        throw new Error('Client profile could not be updated. Tenant admin profile update policy may be missing.')
      }
      return client as Client
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['workspace', 'clients'] })
      queryClient.invalidateQueries({ queryKey: ['workspace', 'clients', data.id] })
      queryClient.invalidateQueries({ queryKey: ['workspace', 'profiles'] })
      
      if (variables.commission_rate !== undefined) {
        queryClient.invalidateQueries({ queryKey: ['workspace', 'products'] })
        queryClient.invalidateQueries({ queryKey: ['workspace', 'public-products'] })
        queryClient.invalidateQueries({ queryKey: ['workspace', 'product'] })
        queryClient.invalidateQueries({ queryKey: ['workspace', 'quotes'] })

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

export function useMutationDeactivateClient() {
  const queryClient = useQueryClient()
  const { workspaceId: tenantId } = useAppContext()

  return useMutation({
    mutationFn: async (clientId: string) => {
      if (!tenantId) {
        throw new Error('Missing tenant context')
      }

      const { data: result, error } = await supabase.functions.invoke('deactivate-client', {
        body: {
          client_id: clientId,
          tenant_id: tenantId,
        },
      })

      if (error) {
        let message = error.message || 'Failed to deactivate client'
        try {
          const ctx = (error as { context?: Response }).context
          const body = ctx ? await ctx.json() : null
          if (body?.error) message = body.error
          else if (body?.message) message = body.message
        } catch { /* non-JSON or no context, keep original message */ }
        throw new Error(message)
      }

      if (result?.error) {
        throw new Error(result.error)
      }

      return clientId
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workspace', 'clients'] })
      queryClient.invalidateQueries({ queryKey: ['workspace', 'profiles'] })
    },
  })
}
