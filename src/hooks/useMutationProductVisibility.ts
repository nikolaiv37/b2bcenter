import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useAppContext } from '@/lib/app/AppContext'
import { supabase } from '@/lib/supabase/client'
import { Product } from '@/types'

interface UpdateProductVisibilityData {
  productId: string
  sku: string
  isVisible: boolean
}

interface BulkUpdateProductVisibilityData {
  productIds: string[]
  isVisible: boolean
}

function invalidateProductVisibilityCaches(
  queryClient: ReturnType<typeof useQueryClient>,
  tenantId: string | null | undefined,
  products: Pick<Product, 'id' | 'sku'>[],
) {
  queryClient.invalidateQueries({ queryKey: ['workspace', 'products'] })
  queryClient.invalidateQueries({ queryKey: ['workspace', 'public-products'] })
  queryClient.invalidateQueries({ queryKey: ['workspace', 'product'] })
  for (const product of products) {
    queryClient.invalidateQueries({ queryKey: ['workspace', 'product', 'sku', product.sku] })
  }
  queryClient.invalidateQueries({ queryKey: ['tenant', tenantId, 'products'] })
  queryClient.invalidateQueries({ queryKey: ['tenant', tenantId, 'category-products'] })
  queryClient.invalidateQueries({ queryKey: ['workspace', 'category-hierarchy'] })
  queryClient.invalidateQueries({ queryKey: ['workspace', 'category-product-counts'] })
  queryClient.invalidateQueries({ queryKey: ['workspace', 'category-manufacturers'] })
  queryClient.invalidateQueries({ queryKey: ['workspace', 'products', 'categories-for-filter'] })
  queryClient.invalidateQueries({ queryKey: ['workspace', 'products', 'manufacturer-options'] })
  queryClient.invalidateQueries({ queryKey: ['workspace', 'wishlist-products'] })
}

export function useMutationUpdateProductVisibility() {
  const queryClient = useQueryClient()
  const { workspaceId: tenantId } = useAppContext()

  return useMutation({
    mutationFn: async ({ productId, sku, isVisible }: UpdateProductVisibilityData) => {
      if (!tenantId) throw new Error('Missing tenant context')
      if (!productId || !sku) throw new Error('Missing product identifier')

      const { data, error } = await supabase
        .from('products')
        .update({ is_visible: isVisible })
        .eq('id', productId)
        .eq('sku', sku)
        .eq('tenant_id', tenantId)
        .select('id, sku')
        .maybeSingle()

      if (error) throw error
      if (!data) throw new Error('Product visibility could not be updated')

      return data as Pick<Product, 'id' | 'sku'>
    },
    onSuccess: (product) => {
      invalidateProductVisibilityCaches(queryClient, tenantId, [product])
    },
  })
}

export function useMutationBulkUpdateProductVisibility() {
  const queryClient = useQueryClient()
  const { workspaceId: tenantId } = useAppContext()

  return useMutation({
    mutationFn: async ({ productIds, isVisible }: BulkUpdateProductVisibilityData) => {
      const uniqueProductIds = Array.from(new Set(productIds.filter(Boolean)))

      if (!tenantId) throw new Error('Missing tenant context')
      if (uniqueProductIds.length === 0) throw new Error('Missing products')

      const { data, error } = await supabase
        .from('products')
        .update({ is_visible: isVisible })
        .in('id', uniqueProductIds)
        .eq('tenant_id', tenantId)
        .select('id, sku')

      if (error) throw error
      if (!data || data.length !== uniqueProductIds.length) {
        throw new Error('Some products could not be updated')
      }

      return data as Pick<Product, 'id' | 'sku'>[]
    },
    onSuccess: (products) => {
      invalidateProductVisibilityCaches(queryClient, tenantId, products)
    },
  })
}
