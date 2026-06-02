import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase/client'
import { useAppContext } from '@/lib/app/AppContext'
import { useAuth } from '@/hooks/useAuth'
import type {
  PricingPolicy,
  PricingPolicyItem,
  PricingPolicyItemScope,
} from '@/types'

/**
 * Phase 3 mutations for pricing policies.
 *
 * All mutations rely on the RLS admin policies created in the Phase 1
 * migration (`pricing_policies_admin_all`, `pricing_policy_items_admin_all`)
 * — no service role, no policy bypass. The calling UI is still responsible
 * for hiding entry points from non-admin users.
 *
 * Query-key conventions follow the rest of the app:
 *   ['workspace', 'pricing-policy', 'mine',  tenantId, userId]          (Phase 2)
 *   ['workspace', 'pricing-policy', 'client', tenantId, clientUserId]   (Phase 2)
 *
 * All mutations invalidate the per-client key so the admin editor refreshes
 * and the `'mine'` key so an in-session client tab eventually re-fetches.
 */

interface UpsertPolicyInput {
  clientUserId: string
  name: string
  defaultDiscount: number
  isActive: boolean
}

interface AddItemInput {
  policyId: string
  clientUserId: string
  scope: PricingPolicyItemScope
  /** Required when scope === 'product' */
  productSku?: string | null
  /** Required when scope === 'category' */
  categoryId?: string | null
  discount: number
}

interface UpdateItemDiscountInput {
  itemId: string
  clientUserId: string
  discount: number
}

interface RemoveItemInput {
  itemId: string
  clientUserId: string
}

function invalidatePolicy(
  queryClient: ReturnType<typeof useQueryClient>,
  clientUserId: string,
) {
  // Per-client (admin) — exact-ish match via the 'client' segment
  queryClient.invalidateQueries({
    queryKey: ['workspace', 'pricing-policy', 'client'],
  })
  // 'mine' for any tab where the same user is logged in
  queryClient.invalidateQueries({
    queryKey: ['workspace', 'pricing-policy', 'mine'],
  })
  // Belt and braces — anything keyed by this clientUserId
  queryClient.invalidateQueries({
    predicate: (q) =>
      Array.isArray(q.queryKey) &&
      q.queryKey.includes('pricing-policy') &&
      q.queryKey.includes(clientUserId),
  })
}

/**
 * Insert-or-update the policy header (name, default_discount, is_active) for
 * a given client. Returns the resulting policy row.
 */
export function useMutationUpsertPricingPolicy() {
  const queryClient = useQueryClient()
  const { workspaceId: tenantId } = useAppContext()
  const { user } = useAuth()

  return useMutation({
    mutationFn: async (input: UpsertPolicyInput): Promise<PricingPolicy> => {
      if (!tenantId) throw new Error('Missing tenant context')

      // Check for an existing policy first — UNIQUE(tenant_id, client_user_id)
      // means there is at most one row to find.
      const { data: existing, error: lookupError } = await supabase
        .from('pricing_policies')
        .select('id')
        .eq('tenant_id', tenantId)
        .eq('client_user_id', input.clientUserId)
        .maybeSingle()

      if (lookupError) throw lookupError

      if (existing) {
        const { data, error } = await supabase
          .from('pricing_policies')
          .update({
            name: input.name,
            default_discount: input.defaultDiscount,
            is_active: input.isActive,
          })
          .eq('id', existing.id)
          .eq('tenant_id', tenantId)
          .select()
          .single()

        if (error) throw error
        return data as PricingPolicy
      }

      const { data, error } = await supabase
        .from('pricing_policies')
        .insert({
          tenant_id: tenantId,
          client_user_id: input.clientUserId,
          name: input.name,
          default_discount: input.defaultDiscount,
          is_active: input.isActive,
          created_by: user?.id ?? null,
        })
        .select()
        .single()

      if (error) throw error
      return data as PricingPolicy
    },
    onSuccess: (_data, variables) => invalidatePolicy(queryClient, variables.clientUserId),
  })
}

/**
 * Add a single override item (product or category). The partial unique
 * indexes on `pricing_policy_items` will reject duplicates server-side;
 * the UI should also prevent them before they hit the network.
 */
export function useMutationAddPricingPolicyItem() {
  const queryClient = useQueryClient()
  const { workspaceId: tenantId } = useAppContext()

  return useMutation({
    mutationFn: async (input: AddItemInput): Promise<PricingPolicyItem> => {
      if (!tenantId) throw new Error('Missing tenant context')

      const row: Record<string, unknown> = {
        tenant_id: tenantId,
        policy_id: input.policyId,
        scope: input.scope,
        discount: input.discount,
      }
      if (input.scope === 'product') {
        if (!input.productSku) throw new Error('product_sku required for product scope')
        row.product_sku = input.productSku
        row.category_id = null
      } else {
        if (!input.categoryId) throw new Error('category_id required for category scope')
        row.category_id = input.categoryId
        row.product_sku = null
      }

      const { data, error } = await supabase
        .from('pricing_policy_items')
        .insert(row)
        .select()
        .single()

      if (error) throw error
      return data as PricingPolicyItem
    },
    onSuccess: (_data, variables) => invalidatePolicy(queryClient, variables.clientUserId),
  })
}

/** Update the discount value of an existing item. */
export function useMutationUpdatePricingPolicyItem() {
  const queryClient = useQueryClient()
  const { workspaceId: tenantId } = useAppContext()

  return useMutation({
    mutationFn: async (input: UpdateItemDiscountInput): Promise<PricingPolicyItem> => {
      if (!tenantId) throw new Error('Missing tenant context')

      const { data, error } = await supabase
        .from('pricing_policy_items')
        .update({ discount: input.discount })
        .eq('id', input.itemId)
        .eq('tenant_id', tenantId)
        .select()
        .single()

      if (error) throw error
      return data as PricingPolicyItem
    },
    onSuccess: (_data, variables) => invalidatePolicy(queryClient, variables.clientUserId),
  })
}

/** Remove a single override item. */
export function useMutationRemovePricingPolicyItem() {
  const queryClient = useQueryClient()
  const { workspaceId: tenantId } = useAppContext()

  return useMutation({
    mutationFn: async (input: RemoveItemInput): Promise<void> => {
      if (!tenantId) throw new Error('Missing tenant context')

      const { error } = await supabase
        .from('pricing_policy_items')
        .delete()
        .eq('id', input.itemId)
        .eq('tenant_id', tenantId)

      if (error) throw error
    },
    onSuccess: (_data, variables) => invalidatePolicy(queryClient, variables.clientUserId),
  })
}
