import { useQuery } from '@tanstack/react-query'
import { useAppContext } from '@/lib/app/AppContext'
import { supabase } from '@/lib/supabase/client'

export interface TeamMember {
  id: string
  user_id: string
  role: 'owner' | 'admin' | 'member'
  email: string | null
  full_name: string | null
  created_at: string
}

export function useQueryTeamMembers() {
  const { workspaceId: tenantId } = useAppContext()

  return useQuery({
    queryKey: ['workspace', 'team-members'],
    queryFn: async (): Promise<TeamMember[]> => {
      if (!tenantId) return []

      const { data: memberships, error: membershipsError } = await supabase
        .from('tenant_memberships')
        .select('id, user_id, role, created_at')
        .eq('tenant_id', tenantId)
        .in('role', ['owner', 'admin'])
        .order('created_at', { ascending: true })

      if (membershipsError) throw membershipsError
      if (!memberships?.length) return []

      const userIds = [...new Set(memberships.map((m) => m.user_id))]
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', userIds)

      if (profilesError) throw profilesError

      const profileMap = new Map(
        (profiles || []).map((p) => [p.id, p as { id: string; full_name?: string | null }])
      )

      // For email: profiles may not have email column; try tenant_invitations for invited admins
      const { data: invites } = await supabase
        .from('tenant_invitations')
        .select('profile_id, email')
        .eq('tenant_id', tenantId)
        .in('profile_id', userIds)
      const inviteEmailMap = new Map(
        (invites || []).filter((i) => i.profile_id).map((i) => [i.profile_id!, i.email])
      )

      return memberships.map((row) => {
        const profile = profileMap.get(row.user_id)
        const email = inviteEmailMap.get(row.user_id) ?? null
        return {
          id: row.id,
          user_id: row.user_id,
          role: row.role as TeamMember['role'],
          email,
          full_name: profile?.full_name ?? null,
          created_at: row.created_at,
        }
      })
    },
    staleTime: 30_000,
    enabled: !!tenantId,
  })
}

export function useQueryTeamInvitations() {
  const { workspaceId: tenantId } = useAppContext()

  return useQuery({
    queryKey: ['workspace', 'team-invitations'],
    queryFn: async () => {
      if (!tenantId) return []

      const { data, error } = await supabase
        .from('tenant_invitations')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('target_role', 'admin')
        .eq('status', 'pending')
        .order('created_at', { ascending: false })

      if (error) throw error
      return data || []
    },
    staleTime: 30_000,
    enabled: !!tenantId,
  })
}
