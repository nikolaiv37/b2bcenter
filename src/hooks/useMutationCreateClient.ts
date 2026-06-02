import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useAppContext } from '@/lib/app/AppContext'
import { supabase } from '@/lib/supabase/client'

interface CreateClientData {
  email: string
  company_name: string
  commission_rate: number
  password: string
}

interface CreateClientResult {
  success: boolean
  client: {
    id: string
    email: string
    company_name: string | null
    commission_rate: number
  }
}

export function useMutationCreateClient() {
  const queryClient = useQueryClient()
  const { workspaceId: tenantId } = useAppContext()

  return useMutation({
    mutationFn: async (data: CreateClientData): Promise<CreateClientResult> => {
      if (!tenantId) {
        throw new Error('Missing tenant context')
      }

      const { data: result, error } = await supabase.functions.invoke('create-client', {
        body: {
          email: data.email,
          company_name: data.company_name || undefined,
          commission_rate: data.commission_rate || undefined,
          password: data.password,
          tenant_id: tenantId,
        },
      })

      if (error) {
        let message = error.message || 'Failed to create client'
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

      return result as CreateClientResult
    },
    onSuccess: () => {
      // Refresh every surface that lists or counts tenant members so the
      // new client shows up immediately without a page refresh.
      queryClient.invalidateQueries({ queryKey: ['workspace', 'clients'] })
      queryClient.invalidateQueries({ queryKey: ['workspace', 'invitations'] })
      queryClient.invalidateQueries({ queryKey: ['workspace', 'profiles'] })
      queryClient.invalidateQueries({ queryKey: ['workspace', 'tenant-members'] })
      queryClient.invalidateQueries({ queryKey: ['workspace', 'pricing-policy'] })
    },
  })
}
