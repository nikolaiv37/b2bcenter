import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useAppContext } from '@/lib/app/AppContext'
import { supabase } from '@/lib/supabase/client'
import { Product } from '@/types'
import { useAuthStore } from '@/stores/authStore'
import { applyPolicyToProducts } from '@/lib/pricing'
import { usePricingContext } from '@/hooks/usePricingContext'

// ---------------------------------------------------------------------------
// Phase 4: pricing comes from `pricing_policies` via `resolveProductPricing`.
//
// We deliberately stamp `adjusted_price` on each product *after* the fetch so
// that existing card/detail components (which read
// `product.adjusted_price ?? product.weboffer_price`) keep working unchanged.
// The commission-folding that used to live in this file is gone — the
// resolver now owns that, with `commission_rate` only used as a final
// fallback when no active policy exists (see `usePricingContext`).
// ---------------------------------------------------------------------------

export function useQueryProducts(supplierId?: string) {
  const profile = useAuthStore((state) => state.profile)
  const { workspaceId: tenantId } = useAppContext()
  const isAdmin = profile?.role === 'admin'
  const ctx = usePricingContext()

  const query = useQuery({
    queryKey: ['workspace', 'products', supplierId, profile?.id, isAdmin],
    queryFn: async () => {
      let q = supabase.from('products').select('*').order('created_at', { ascending: false })

      if (tenantId) {
        q = q.eq('tenant_id', tenantId)
      }

      if (supplierId) {
        q = q.eq('supplier_id', supplierId)
      }

      if (!isAdmin) {
        q = q.eq('is_visible', true)
      }

      const { data, error } = await q

      if (error) throw error
      return (data ?? []) as Product[]
    },
    enabled: !!tenantId,
  })

  const data = useMemo(
    () => applyPolicyToProducts(query.data, ctx),
    [query.data, ctx],
  )

  return { ...query, data }
}

export function useQueryProduct(productId: string) {
  const profile = useAuthStore((state) => state.profile)
  const { workspaceId: tenantId } = useAppContext()
  const isAdmin = profile?.role === 'admin'
  const ctx = usePricingContext()

  const query = useQuery({
    queryKey: ['workspace', 'product', productId, profile?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('id', productId)
        .eq('tenant_id', tenantId)
        .single()

      if (error) throw error

      if (!isAdmin && data?.is_visible === false) {
        return null
      }

      return data as Product
    },
    enabled: !!productId && !!tenantId,
  })

  const data = useMemo(() => {
    if (!query.data) return query.data ?? null
    const [adjusted] = applyPolicyToProducts([query.data], ctx)
    return adjusted ?? query.data
  }, [query.data, ctx])

  return { ...query, data }
}

export function useQueryPublicProducts(companySlug: string, filters?: {
  category?: string
  search?: string
  minPrice?: number
  maxPrice?: number
}) {
  const profile = useAuthStore((state) => state.profile)
  const { workspaceId: tenantId } = useAppContext()
  const ctx = usePricingContext()

  const query = useQuery({
    queryKey: ['workspace', 'public-products', companySlug, filters, profile?.id],
    queryFn: async () => {
      // For MVP: Show all visible products
      let q = supabase
        .from('products')
        .select('*')
        .eq('is_visible', true)
        .gt('quantity', 0) // Only show in-stock products
      if (tenantId) {
        q = q.eq('tenant_id', tenantId)
      }

      if (filters?.category) {
        q = q.eq('category', filters.category)
      }

      if (filters?.search) {
        q = q.or(
          `name.ilike.%${filters.search}%,description.ilike.%${filters.search}%,sku.ilike.%${filters.search}%`
        )
      }

      if (filters?.minPrice) {
        q = q.gte('weboffer_price', filters.minPrice)
      }

      if (filters?.maxPrice) {
        q = q.lte('weboffer_price', filters.maxPrice)
      }

      const { data, error } = await q.order('created_at', { ascending: false })

      if (error) throw error
      return (data ?? []) as Product[]
    },
    enabled: !!companySlug && !!tenantId,
  })

  const data = useMemo(
    () => applyPolicyToProducts(query.data, ctx),
    [query.data, ctx],
  )

  return { ...query, data }
}

/**
 * Hook to fetch a product by SKU with policy-resolved pricing.
 */
export function useQueryProductBySku(sku: string) {
  const profile = useAuthStore((state) => state.profile)
  const { workspaceId: tenantId } = useAppContext()
  const isAdmin = profile?.role === 'admin'
  const ctx = usePricingContext()

  const query = useQuery({
    queryKey: ['workspace', 'product', 'sku', sku, profile?.id],
    queryFn: async () => {
      if (!sku) throw new Error('SKU is required')

      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('sku', sku)
        .eq('tenant_id', tenantId)
        .single()

      if (error) {
        // If product not found, return null
        if (error.code === 'PGRST116') {
          return null
        }
        throw error
      }

      if (!isAdmin && data?.is_visible === false) {
        return null
      }

      return data as Product
    },
    enabled: !!sku && !!tenantId,
    retry: false,
  })

  const data = useMemo(() => {
    if (!query.data) return query.data ?? null
    const [adjusted] = applyPolicyToProducts([query.data], ctx)
    return adjusted ?? query.data
  }, [query.data, ctx])

  return { ...query, data }
}
