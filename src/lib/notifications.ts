import { supabase } from '@/lib/supabase/client'
import type { NotificationType } from '@/types'

interface SendNotificationParams {
  type: NotificationType
  entityType?: string
  entityId?: string
  metadata?: Record<string, unknown>
  targetAudience: 'admins' | 'company' | 'all_companies' | 'user'
  targetCompanyId?: string
  targetUserId?: string
}

/**
 * Fire-and-forget wrapper around the create_notification RPC.
 * Tenant and actor are derived server-side from the authenticated session.
 *
 * Errors are logged but never thrown -- notifications should never
 * block the primary mutation from completing.
 */
export async function sendNotification({
  type,
  entityType,
  entityId,
  metadata = {},
  targetAudience,
  targetCompanyId,
  targetUserId,
}: SendNotificationParams): Promise<void> {
  try {
    const { error } = await supabase.rpc('create_notification', {
      p_type: type,
      p_entity_type: entityType ?? null,
      p_entity_id: entityId ?? null,
      p_metadata: metadata,
      p_target_audience: targetAudience,
      p_target_company_id: targetCompanyId ?? null,
      p_target_user_id: targetUserId ?? null,
    })

    if (error) {
      console.error('[notifications] RPC error:', error.message)
    }
  } catch (err) {
    console.error('[notifications] Unexpected error:', err)
  }
}
