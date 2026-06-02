import { useQuery } from '@tanstack/react-query'
import { useAppContext } from '@/lib/app/AppContext'
import { supabase } from '@/lib/supabase/client'

export interface ProductShippingRow {
  id: string
  sku: string
  shipping_weight_kg: number | null
  shipping_parcels_count: number | null
  shipping_length_cm: number | null
  shipping_width_cm: number | null
  shipping_height_cm: number | null
  shipping_requires_review: boolean | null
  // Legacy fields from the catalog/import flow, used as a fallback when
  // `shipping_weight_kg` is not set. Treated as kilograms.
  weight: number | null
  transportational_weight: number | null
}

export function getEffectiveShippingWeightKg(row: Pick<ProductShippingRow, 'shipping_weight_kg' | 'transportational_weight' | 'weight'>): number | null {
  const candidates = [row.shipping_weight_kg, row.transportational_weight, row.weight]
  for (const value of candidates) {
    if (value === null || value === undefined) continue
    const n = Number(value)
    if (Number.isFinite(n) && n > 0) return n
  }
  return null
}

export function useQueryProductsShipping(skus: string[]) {
  const { workspaceId: tenantId } = useAppContext()
  const normalized = Array.from(new Set(skus.filter(Boolean))).sort()

  return useQuery({
    queryKey: ['workspace', 'products', 'shipping', tenantId, normalized],
    queryFn: async () => {
      if (!tenantId || normalized.length === 0) return [] as ProductShippingRow[]
      const { data, error } = await supabase
        .from('products')
        .select('id, sku, shipping_weight_kg, shipping_parcels_count, shipping_length_cm, shipping_width_cm, shipping_height_cm, shipping_requires_review, weight, transportational_weight')
        .eq('tenant_id', tenantId)
        .in('sku', normalized)
      if (error) throw error
      return (data ?? []) as ProductShippingRow[]
    },
    enabled: !!tenantId && normalized.length > 0,
    staleTime: 60_000,
  })
}
