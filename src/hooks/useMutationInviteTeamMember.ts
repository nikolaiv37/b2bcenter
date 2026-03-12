import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useAppContext } from '@/lib/app/AppContext'
import { supabase } from '@/lib/supabase/client'

interface InviteTeamMemberData {
  email: string
}

interface InviteTeamMemberResult {
  success: boolean
  invitation: {
    id: string
    token: string
    email: string
    status: string
    created_at: string
    expires_at: string
  }
  profile_id: string
  email_sent: boolean
}

export function useMutationInviteTeamMember() {
  const queryClient = useQueryClient()
  const { workspaceId: tenantId } = useAppContext()

  return useMutation({
    mutationFn: async (data: InviteTeamMemberData): Promise<InviteTeamMemberResult> => {
      if (!tenantId) {
        throw new Error('Missing tenant context')
      }

      const { data: result, error } = await supabase.functions.invoke('invite-client', {
        body: {
          email: data.email,
          tenant_id: tenantId,
          target_role: 'admin',
        },
      })

      if (error) {
        throw new Error(error.message || 'Failed to invite team member')
      }

      if (result?.error) {
        throw new Error(result.error)
      }

      return result as InviteTeamMemberResult
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workspace', 'team-members'] })
      queryClient.invalidateQueries({ queryKey: ['workspace', 'team-invitations'] })
    },
  })
}

export function useMutationResendTeamInvite() {
  const queryClient = useQueryClient()
  const { workspaceId: tenantId } = useAppContext()

  return useMutation({
    mutationFn: async (data: { email: string }) => {
      if (!tenantId) {
        throw new Error('Missing tenant context')
      }

      const { data: result, error } = await supabase.functions.invoke('invite-client', {
        body: {
          email: data.email,
          tenant_id: tenantId,
          target_role: 'admin',
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
      queryClient.invalidateQueries({ queryKey: ['workspace', 'team-members'] })
      queryClient.invalidateQueries({ queryKey: ['workspace', 'team-invitations'] })
    },
  })
}

export function useMutationRevokeTeamInvite() {
  const queryClient = useQueryClient()
  const { workspaceId: tenantId } = useAppContext()

  return useMutation({
    mutationFn: async (invitationId: string) => {
      if (!tenantId) {
        throw new Error('Missing tenant context')
      }

      const { error } = await supabase
        .from('tenant_invitations')
        .update({ status: 'revoked' })
        .eq('id', invitationId)
        .eq('tenant_id', tenantId)

      if (error) throw new Error(error.message)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workspace', 'team-members'] })
      queryClient.invalidateQueries({ queryKey: ['workspace', 'team-invitations'] })
    },
  })
}
