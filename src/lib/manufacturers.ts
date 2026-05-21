import { supabase } from '@/lib/supabase/client'
import { Product } from '@/types'

/**
 * Single source of truth for manufacturer/vendor handling across every
 * product list context (grid cards, list table, filter options, filter
 * matching). The catalog stores the value in `products.manufacturer`; this
 * resolver trims it and treats empty strings as "no manufacturer".
 */
export function getProductManufacturer(
  product: Pick<Product, 'manufacturer'> | null | undefined,
): string | null {
  const raw = product?.manufacturer
  if (typeof raw !== 'string') return null
  const trimmed = raw.trim()
  return trimmed.length > 0 ? trimmed : null
}

/** Manufacturer display string, with a caller-provided fallback. */
export function getManufacturerDisplayValue(
  product: Pick<Product, 'manufacturer'> | null | undefined,
  fallback = '',
): string {
  return getProductManufacturer(product) ?? fallback
}

// PostgREST caps a single response at the server `db-max-rows` setting
// (1000 for this project). A one-shot `select('manufacturer')` — even with a
// huge `.limit()` — is silently truncated to the first 1000 rows, so on large
// catalogs the manufacturer dropdown only ever shows whichever vendors happen
// to fall in that window. We page through the column instead.
const MANUFACTURER_PAGE_SIZE = 1000

interface ManufacturerOptionsParams {
  tenantId: string
  /** Restrict to these category ids (category product pages). */
  categoryIds?: string[]
  /**
   * Lifecycle scope:
   * - true  => only active/visible products
   * - false => only archived products
   * - null  => both (admin "All" lifecycle view)
   */
  isVisible: boolean | null
}

/**
 * Build the full, de-duplicated, sorted list of manufacturer values for a
 * product list context. Pages through the `manufacturer` column so the result
 * is never truncated by the server row cap. The payload is a single short
 * string column, so even a multi-thousand-product catalog stays lightweight.
 */
export async function fetchManufacturerOptions(
  params: ManufacturerOptionsParams,
): Promise<string[]> {
  const { tenantId, categoryIds, isVisible } = params

  // Keep first-seen display casing while de-duping case-insensitively.
  const seen = new Map<string, string>()
  let offset = 0

  for (;;) {
    let query = supabase
      .from('products')
      .select('manufacturer')
      .eq('tenant_id', tenantId)
      .order('manufacturer', { ascending: true })
      .range(offset, offset + MANUFACTURER_PAGE_SIZE - 1)

    if (categoryIds && categoryIds.length > 0) {
      query = query.in('category_id', categoryIds)
    }
    if (isVisible === true) {
      query = query.eq('is_visible', true)
    } else if (isVisible === false) {
      query = query.eq('is_visible', false)
    }

    const { data, error } = await query
    if (error) throw error

    const rows = data ?? []
    for (const row of rows) {
      const value = getProductManufacturer(row as Pick<Product, 'manufacturer'>)
      if (value) {
        const key = value.toLowerCase()
        if (!seen.has(key)) seen.set(key, value)
      }
    }

    if (rows.length < MANUFACTURER_PAGE_SIZE) break
    offset += MANUFACTURER_PAGE_SIZE
  }

  return Array.from(seen.values()).sort((a, b) => a.localeCompare(b))
}
