import { useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/useAuth'
import { useTenant } from '@/lib/tenant/TenantProvider'
import type { AppNotification } from '@/types'

const NOTIFICATIONS_LIMIT = 20

export function useNotifications() {
  const { user } = useAuth()
  const { tenant } = useTenant()
  const queryClient = useQueryClient()

  const userId = user?.id
  const tenantId = tenant?.id

  // ── Fetch latest notifications ──────────────────────────
  const {
    data: notifications = [],
    isLoading,
  } = useQuery({
    queryKey: ['tenant', tenantId, 'notifications'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', userId!)
        .eq('tenant_id', tenantId!)
        .order('created_at', { ascending: false })
        .limit(NOTIFICATIONS_LIMIT)

      if (error) throw error
      return (data ?? []) as AppNotification[]
    },
    enabled: !!userId && !!tenantId,
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
  })

  // ── Unread count (derived from fetched data) ────────────
  const unreadCount = notifications.filter((n) => !n.read_at).length

  // ── Realtime subscription ───────────────────────────────
  useEffect(() => {
    if (!userId || !tenantId) return

    const channel = supabase
      .channel('user-notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        },
        () => {
          queryClient.invalidateQueries({
            queryKey: ['tenant', tenantId, 'notifications'],
          })
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [userId, tenantId, queryClient])

  // ── Mark single notification as read ────────────────────
  const markAsRead = useMutation({
    mutationFn: async (notificationId: string) => {
      const { error } = await supabase
        .from('notifications')
        .update({ read_at: new Date().toISOString() })
        .eq('id', notificationId)
        .eq('user_id', userId!)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['tenant', tenantId, 'notifications'],
      })
    },
  })

  // ── Mark all as read ────────────────────────────────────
  const markAllAsRead = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('notifications')
        .update({ read_at: new Date().toISOString() })
        .eq('user_id', userId!)
        .eq('tenant_id', tenantId!)
        .is('read_at', null)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['tenant', tenantId, 'notifications'],
      })
    },
  })

  return {
    notifications,
    unreadCount,
    isLoading,
    markAsRead: markAsRead.mutate,
    markAllAsRead: markAllAsRead.mutate,
    isMarkingAllRead: markAllAsRead.isPending,
  }
}
