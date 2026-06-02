import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase/client'
import { useAppContext } from '@/lib/app/AppContext'
import { useAuth } from '@/hooks/useAuth'
import type {
  PricingPolicy,
  PricingPolicyItem,
  ResolvedPricingPolicy,
} from '@/types'

/**
 * Fetch the active pricing policy (and its items) for the currently logged-in
 * client/member user, scoped to the current tenant.
 *
 * Returns `ResolvedPricingPolicy | null`:
 *   - `null` when the user has no active policy (the caller should then fall
 *     back to legacy `profiles.commission_rate` via `resolveProductPricing`).
 *
 * RLS does the security work — this hook does not bypass anything. The
 * `pricing_policies_client_read_own_active` and
 * `pricing_policy_items_client_read_own_active` policies (see Phase 1
 * migration) restrict reads to the caller's own active policy.
 */
export function usePricingPolicy() {
  const { user } = useAuth()
  const { workspaceId: tenantId } = useAppContext()
  const userId = user?.id ?? null

  return useQuery<ResolvedPricingPolicy | null>({
    queryKey: ['workspace', 'pricing-policy', 'mine', tenantId, userId],
    enabled: !!userId && !!tenantId,
    staleTime: 60 * 1000,
    gcTime: 5 * 60 * 1000,
    queryFn: async () => {
      if (!userId || !tenantId) return null

      const { data: policyRow, error: policyError } = await supabase
        .from('pricing_policies')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('client_user_id', userId)
        .eq('is_active', true)
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
