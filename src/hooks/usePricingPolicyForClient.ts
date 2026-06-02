import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase/client'
import { useAppContext } from '@/lib/app/AppContext'
import type {
  PricingPolicy,
  PricingPolicyItem,
  ResolvedPricingPolicy,
} from '@/types'

/**
 * Admin-side hook: fetch the pricing policy (active or inactive) for a given
 * client in the current tenant, along with its items.
 *
 * Returns `ResolvedPricingPolicy | null` — `null` means the admin has not yet
 * created a policy for this client.
 *
 * Relies on the `pricing_policies_admin_all` / `pricing_policy_items_admin_all`
 * RLS policies. The hook itself does no admin gating — the calling UI must
 * still hide this from non-admin users.
 *
 * Disabled until both `clientUserId` and the current tenant are known.
 */
export function usePricingPolicyForClient(clientUserId: string | null | undefined) {
  const { workspaceId: tenantId } = useAppContext()

  return useQuery<ResolvedPricingPolicy | null>({
    queryKey: ['workspace', 'pricing-policy', 'client', tenantId, clientUserId ?? null],
    enabled: !!clientUserId && !!tenantId,
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
    queryFn: async () => {
      if (!clientUserId || !tenantId) return null

      const { data: policyRow, error: policyError } = await supabase
        .from('pricing_policies')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('client_user_id', clientUserId)
        .maybeSingle()

      if (policyError) throw policyError
      if (!policyRow) return null

      const policy = policyRow as PricingPolicy

      const { data: itemRows, error: itemsError } = await supabase
        .from('pricing_policy_items')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('policy_id', policy.id)

      if (itemsError) throw itemsError

      return {
        policy,
        items: (itemRows ?? []) as PricingPolicyItem[],
      }
    },
  })
}
