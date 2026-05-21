import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useAppContext } from '@/lib/app/AppContext'
import { supabase } from '@/lib/supabase/client'
import { Product } from '@/types'

interface UpdateProductCategoryData {
  productId: string
  sku: string
  categoryId: string
}

interface BulkUpdateProductCategoryData {
  productIds: string[]
  categoryId: string
}

export function useMutationUpdateProductCategory() {
  const queryClient = useQueryClient()
  const { workspaceId: tenantId } = useAppContext()

  return useMutation({
    mutationFn: async ({ productId, sku, categoryId }: UpdateProductCategoryData) => {
      if (!tenantId) {
        throw new Error('Missing tenant context')
      }
      if (!productId || !sku || !categoryId) {
        throw new Error('Missing product or category identifier')
      }

      const { data, error } = await supabase
        .from('products')
        .update({ category_id: categoryId })
        .eq('id', productId)
        .eq('sku', sku)
        .eq('tenant_id', tenantId)
        .select()
        .maybeSingle()

      if (error) throw error
      if (!data) {
        throw new Error('Product category could not be updated')
      }

      return data as Product
    },
    onSuccess: (product) => {
      queryClient.invalidateQueries({ queryKey: ['workspace', 'products'] })
      queryClient.invalidateQueries({ queryKey: ['workspace', 'public-products'] })
      queryClient.invalidateQueries({ queryKey: ['workspace', 'product'] })
      queryClient.invalidateQueries({ queryKey: ['workspace', 'product', 'sku', product.sku] })
      queryClient.invalidateQueries({ queryKey: ['tenant', tenantId, 'products'] })
      queryClient.invalidateQueries({ queryKey: ['tenant', tenantId, 'category-products'] })
      queryClient.invalidateQueries({ queryKey: ['workspace', 'category-hierarchy'] })
      queryClient.invalidateQueries({ queryKey: ['workspace', 'category-product-counts'] })
      queryClient.invalidateQueries({ queryKey: ['workspace', 'category-manufacturers'] })
      queryClient.invalidateQueries({ queryKey: ['workspace', 'products', 'categories-for-filter'] })
    },
  })
}

export function useMutationBulkUpdateProductCategory() {
  const queryClient = useQueryClient()
  const { workspaceId: tenantId } = useAppContext()

  return useMutation({
    mutationFn: async ({ productIds, categoryId }: BulkUpdateProductCategoryData) => {
      const uniqueProductIds = Array.from(new Set(productIds.filter(Boolean)))

      if (!tenantId) {
        throw new Error('Missing tenant context')
      }
      if (uniqueProductIds.length === 0 || !categoryId) {
        throw new Error('Missing products or category identifier')
      }

      const { data, error } = await supabase
        .from('products')
        .update({ category_id: categoryId })
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
    },
  })
}
