import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase/client'
import { Product } from '@/types'
import { useAuthStore } from '@/stores/authStore'
import { applyCommissionRate, shouldApplyCommission } from '@/lib/priceUtils'
import { useTenant } from '@/lib/tenant/TenantProvider'

/**
 * Apply commission-based price adjustments to products.
 * Only company users with a commission_rate > 0 get adjusted prices.
 */
function applyCommissionToProducts(
  products: Product[],
  role: string | null | undefined,
  commissionRate: number | null | undefined
): Product[] {
  // Check if we should apply commission
  if (!shouldApplyCommission(role, commissionRate)) {
    // Return products with adjusted_price = weboffer_price (no discount)
    return products.map((p) => ({
      ...p,
      adjusted_price: p.weboffer_price,
    }))
  }

  // Apply commission rate to each product
  return products.map((p) => ({
    ...p,
    adjusted_price: applyCommissionRate(p.weboffer_price, commissionRate),
  }))
}

export function useQueryProducts(supplierId?: string) {
  const profile = useAuthStore((state) => state.profile)
  const { tenant } = useTenant()
  const tenantId = tenant?.id

  return useQuery({
    queryKey: ['tenant', tenantId, 'products', supplierId, profile?.id, profile?.commission_rate],
    queryFn: async () => {
      let query = supabase.from('products').select('*').order('created_at', { ascending: false })

      if (tenantId) {
        query = query.eq('tenant_id', tenantId)
      }

      if (supplierId) {
        query = query.eq('supplier_id', supplierId)
      }

      const { data, error } = await query

      if (error) throw error
      
      // Apply commission-based pricing
      return applyCommissionToProducts(data as Product[], profile?.role, profile?.commission_rate)
    },
    // For dev mode, always enable to show all products
    enabled: !!tenantId,
  })
}

export function useQueryProduct(productId: string) {
  const profile = useAuthStore((state) => state.profile)
  const { tenant } = useTenant()
  const tenantId = tenant?.id

  return useQuery({
    queryKey: ['tenant', tenantId, 'product', productId, profile?.id, profile?.commission_rate],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('id', productId)
        .eq('tenant_id', tenantId)
        .single()

      if (error) throw error
      
      // Apply commission-based pricing
      const products = applyCommissionToProducts([data as Product], profile?.role, profile?.commission_rate)
      return products[0]
    },
    enabled: !!productId && !!tenantId,
  })
}

export function useQueryPublicProducts(companySlug: string, filters?: {
  category?: string
  search?: string
  minPrice?: number
  maxPrice?: number
}) {
  const profile = useAuthStore((state) => state.profile)
  const { tenant } = useTenant()
  const tenantId = tenant?.id

  return useQuery({
    queryKey: ['tenant', tenantId, 'public-products', companySlug, filters, profile?.id, profile?.commission_rate],
    queryFn: async () => {
      // For MVP: Show all visible products
      // TODO: Later filter by company if needed
      let query = supabase
        .from('products')
        .select('*')
        .eq('is_visible', true)
        .gt('quantity', 0) // Only show in-stock products
      if (tenantId) {
        query = query.eq('tenant_id', tenantId)
      }

      if (filters?.category) {
        query = query.eq('category', filters.category)
      }

      if (filters?.search) {
        query = query.or(
          `name.ilike.%${filters.search}%,description.ilike.%${filters.search}%,sku.ilike.%${filters.search}%`
        )
      }

      if (filters?.minPrice) {
        query = query.gte('weboffer_price', filters.minPrice)
      }

      if (filters?.maxPrice) {
        query = query.lte('weboffer_price', filters.maxPrice)
      }

      const { data, error } = await query.order('created_at', { ascending: false })

      if (error) throw error
      
      // Apply commission-based pricing
      return applyCommissionToProducts(data as Product[], profile?.role, profile?.commission_rate)
    },
    enabled: !!companySlug && !!tenantId,
  })
}

/**
 * Hook to fetch a product by SKU with commission-adjusted pricing.
 */
export function useQueryProductBySku(sku: string) {
  const profile = useAuthStore((state) => state.profile)
  const { tenant } = useTenant()
  const tenantId = tenant?.id

  return useQuery({
    queryKey: ['tenant', tenantId, 'product', 'sku', sku, profile?.id, profile?.commission_rate],
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

      // Apply commission-based pricing
      const products = applyCommissionToProducts([data as Product], profile?.role, profile?.commission_rate)
      return products[0]
    },
    enabled: !!sku && !!tenantId,
    retry: false,
  })
}
