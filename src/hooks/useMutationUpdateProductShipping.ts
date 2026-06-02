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
  /**
   * Optional. NOT used as a filter — order items historically carry the SKU in
   * their `product_id` field (since the catalog gets re-imported and UUIDs
   * change but SKUs persist). Treat it as a hint only.
   */
  productId?: string
}

export class ProductNotFoundError extends Error {
  sku: string
  constructor(sku: string) {
    super(`Product not found for SKU ${sku}`)
    this.name = 'ProductNotFoundError'
    this.sku = sku
  }
}

const SHIPPING_FIELD_KEYS: Array<keyof ProductShippingInput> = [
  'shipping_weight_kg',
  'shipping_parcels_count',
  'shipping_length_cm',
  'shipping_width_cm',
  'shipping_height_cm',
  'shipping_requires_review',
]

function pickShippingFields(input: ProductShippingInput): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const key of SHIPPING_FIELD_KEYS) {
    if (key in input) out[key] = input[key] ?? null
  }
  return out
}

export function useMutationUpdateProductShipping() {
  const queryClient = useQueryClient()
  const { workspaceId: tenantId } = useAppContext()

  return useMutation({
    mutationFn: async ({ sku, ...rest }: UpdateProductShippingArgs) => {
      if (!tenantId) throw new Error('Missing tenant context')
      if (!sku) throw new Error('Missing product SKU')

      const fields = pickShippingFields(rest)

      // Update strictly by tenant_id + sku. SKU is the stable product key on
      // this platform — products.id rotates on catalog re-imports, and order
      // items can carry a SKU in their `product_id` field, so filtering by id
      // is unsafe.
      const { data, error } = await supabase
        .from('products')
        .update(fields)
        .eq('tenant_id', tenantId)
        .eq('sku', sku)
        .select('id, sku')

      if (error) {
        if (import.meta.env.DEV) {
          // eslint-disable-next-line no-console
          console.error('[updateProductShipping] supabase error', { sku, error })
        }
        throw error
      }

      const rows = (data ?? []) as Array<Pick<Product, 'id' | 'sku'>>
      if (rows.length === 0) {
        throw new ProductNotFoundError(sku)
      }

      return rows[0]
    },
    onSuccess: (product) => {
      queryClient.invalidateQueries({ queryKey: ['workspace', 'products'] })
      queryClient.invalidateQueries({ queryKey: ['workspace', 'product'] })
      queryClient.invalidateQueries({ queryKey: ['workspace', 'product', 'sku', product.sku] })
      queryClient.invalidateQueries({ queryKey: ['workspace', 'products', 'shipping'] })
    },
  })
}
