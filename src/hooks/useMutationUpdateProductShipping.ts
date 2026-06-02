import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useAppContext } from '@/lib/app/AppContext'
import { supabase } from '@/lib/supabase/client'
import { Product } from '@/types'

export interface ProductShippingInput {
  shipping_weight_kg?: number | null
  shipping_parcels_count?: number | null
  shipping_length_cm?: number | null
  shipping_width_cm?: number | null
  shipping_height_cm?: number | null
  shipping_requires_review?: boolean | null
}

interface UpdateProductShippingArgs extends ProductShippingInput {
  sku: string
  productId?: string
}

export function useMutationUpdateProductShipping() {
  const queryClient = useQueryClient()
  const { workspaceId: tenantId } = useAppContext()

  return useMutation({
    mutationFn: async ({ sku, productId, ...fields }: UpdateProductShippingArgs) => {
      if (!tenantId) throw new Error('Missing tenant context')
      if (!sku) throw new Error('Missing product SKU')

      let q = supabase
        .from('products')
        .update(fields)
        .eq('tenant_id', tenantId)
        .eq('sku', sku)
      if (productId) q = q.eq('id', productId)

      const { data, error } = await q.select('id, sku').maybeSingle()
      if (error) throw error
      if (!data) throw new Error('Product not found for shipping update')
      return data as Pick<Product, 'id' | 'sku'>
    },
    onSuccess: (product) => {
      queryClient.invalidateQueries({ queryKey: ['workspace', 'products'] })
      queryClient.invalidateQueries({ queryKey: ['workspace', 'product'] })
      queryClient.invalidateQueries({ queryKey: ['workspace', 'product', 'sku', product.sku] })
      queryClient.invalidateQueries({ queryKey: ['workspace', 'products', 'shipping'] })
    },
  })
}
