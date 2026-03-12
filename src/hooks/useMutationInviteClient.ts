import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase/client'
import { useTenant } from '@/lib/tenant/TenantProvider'

interface InviteClientData {
  email: string
  company_name?: string
  commission_rate?: number // percentage 0-50, will be sent as-is to edge fn
}

interface InviteClientResult {
  success: boolean
  invitation: {
    id: string
    token: string
    email: string
    company_name: string | null
    status: string
    created_at: string
    expires_at: string
  }
  profile_id: string
  email_sent: boolean
}

export function useMutationInviteClient() {
  const queryClient = useQueryClient()
  const { tenant } = useTenant()
  const tenantId = tenant?.id

  return useMutation({
    mutationFn: async (data: InviteClientData): Promise<InviteClientResult> => {
      if (!tenantId) {
        throw new Error('Missing tenant context')
      }

      const { data: result, error } = await supabase.functions.invoke('invite-client', {
        body: {
          email: data.email,
          company_name: data.company_name || undefined,
          commission_rate: data.commission_rate || undefined,
          tenant_id: tenantId,
        },
      })

      if (error) {
        throw new Error(error.message || 'Failed to invite client')
      }

      if (result?.error) {
        throw new Error(result.error)
      }

      return result as InviteClientResult
    },
    onSuccess: () => {
      // Invalidate clients list so the new invited client appears
      queryClient.invalidateQueries({ queryKey: ['tenant', tenantId, 'clients'] })
      queryClient.invalidateQueries({ queryKey: ['tenant', tenantId, 'invitations'] })
    },
  })
}

export function useMutationResendInvite() {
  const queryClient = useQueryClient()
  const { tenant } = useTenant()
  const tenantId = tenant?.id

  return useMutation({
    mutationFn: async (data: { email: string; company_name?: string }) => {
      if (!tenantId) {
        throw new Error('Missing tenant context')
      }

      const { data: result, error } = await supabase.functions.invoke('invite-client', {
        body: {
          email: data.email,
          company_name: data.company_name || undefined,
          tenant_id: tenantId,
        },
      })

      if (error) {
        throw new Error(error.message || 'Failed to resend invite')
      }

      if (result?.error) {
        throw new Error(result.error)
      }

      return result
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenant', tenantId, 'clients'] })
      queryClient.invalidateQueries({ queryKey: ['tenant', tenantId, 'invitations'] })
    },
  })
}
