import { useMemo } from 'react'
import { usePricingPolicy } from '@/hooks/usePricingPolicy'
import { useCommissionRate } from '@/hooks/useCommissionRate'
import type { PricingResolutionContext } from '@/lib/pricing'

/**
 * Resolve the pricing context for the *current* logged-in user.
 *
 * Wraps `usePricingPolicy()` (Phase 2) and `useCommissionRate()` (legacy
 * commission_rate hook). Returns a `PricingResolutionContext` that can be
 * passed straight to `resolveProductPricing` / `applyPolicyToProducts`.
 *
 * Loading semantics:
 *   - While the policy query is still pending, `legacyCommissionRate` is
 *     suppressed (returned as 0). This prevents the catalog from briefly
 *     rendering legacy-commission prices for a user who *does* have an
 *     active policy before the policy finishes loading.
 *   - Once the policy query has settled and is `null`, the legacy
 *     commission_rate kicks in as the final fallback. This preserves
 *     backwards compatibility for tenants that have not yet created
 *     pricing policies for their clients.
 *
 * Admins get `policy=null, legacyCommissionRate=0` for free — admins do
 * not have a `client_user_id`-matched policy row, and `useCommissionRate()`
 * already returns 0 for non-`company` roles.
 */
export function usePricingContext(): PricingResolutionContext {
  const policyQuery = usePricingPolicy()
  const { commissionRate } = useCommissionRate()

  return useMemo<PricingResolutionContext>(() => {
    const policy = policyQuery.data ?? null
    // `isPending` is true on the very first load (no data, no error yet).
    // We only fall back to legacy commission once the policy lookup has
    // actually completed and returned no row.
    const policyLoaded = !policyQuery.isPending
    return {
      policy,
      legacyCommissionRate: policyLoaded ? commissionRate : 0,
    }
  }, [policyQuery.data, policyQuery.isPending, commissionRate])
}
