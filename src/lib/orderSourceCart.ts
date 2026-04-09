import { useCallback } from 'react'
import { useAppContext } from '@/lib/app/AppContext'
import { applyCommissionRate, shouldApplyCommission } from '@/lib/priceUtils'
import { supabase } from '@/lib/supabase/client'
import { useAuthStore } from '@/stores/authStore'
import { useCartStore } from '@/stores/cartStore'
import { Product } from '@/types'

export interface OrderSourceLine {
  sku: string
  quantity: number
  product_name?: string
}

export interface OrderSourceAdjustedQuantity {
  sku: string
  requestedQuantity: number
  loadedQuantity: number
}

export interface OrderSourceCartLoadResult {
  addedCount: number
  missingSkus: string[]
  unavailableSkus: string[]
  adjustedQuantities: OrderSourceAdjustedQuantity[]
  cancelled: boolean
}

interface ReplaceCartOptions {
  confirmReplace?: () => boolean | Promise<boolean>
}

function buildEmptyResult(): OrderSourceCartLoadResult {
  return {
    addedCount: 0,
    missingSkus: [],
    unavailableSkus: [],
    adjustedQuantities: [],
    cancelled: false,
  }
}

function applyCommissionToProducts(
  products: Product[],
  role: string | null | undefined,
  commissionRate: number | null | undefined,
): Product[] {
  if (!shouldApplyCommission(role, commissionRate)) {
    return products.map((product) => ({
      ...product,
      adjusted_price: product.weboffer_price,
    }))
  }

  return products.map((product) => ({
    ...product,
    adjusted_price: applyCommissionRate(product.weboffer_price, commissionRate),
  }))
}

export function normalizeOrderSourceLines(lines: unknown): OrderSourceLine[] {
  if (!Array.isArray(lines)) {
    return []
  }

  const mergedLines = new Map<string, OrderSourceLine>()

  for (const rawLine of lines) {
    if (!rawLine || typeof rawLine !== 'object') {
      continue
    }

    const skuValue = 'sku' in rawLine ? rawLine.sku : undefined
    const quantityValue = 'quantity' in rawLine ? rawLine.quantity : undefined
    const productNameValue = 'product_name' in rawLine ? rawLine.product_name : undefined

    const sku = typeof skuValue === 'string' ? skuValue.trim() : ''
    const quantity = typeof quantityValue === 'number' ? quantityValue : Number(quantityValue)

    if (!sku || !Number.isFinite(quantity) || quantity <= 0) {
      continue
    }

    const existingLine = mergedLines.get(sku)
    mergedLines.set(sku, {
      sku,
      quantity: (existingLine?.quantity ?? 0) + quantity,
      product_name:
        typeof productNameValue === 'string' && productNameValue.trim().length > 0
          ? productNameValue
          : existingLine?.product_name,
    })
  }

  return Array.from(mergedLines.values())
}

export function useOrderSourceCartLoader() {
  const { workspaceId: tenantId } = useAppContext()
  const profile = useAuthStore((state) => state.profile)

  const replaceCartWithSource = useCallback(
    async (
      rawLines: unknown,
      options?: ReplaceCartOptions,
    ): Promise<OrderSourceCartLoadResult> => {
      if (!tenantId) {
        throw new Error('Missing tenant context')
      }

      const normalizedLines = normalizeOrderSourceLines(rawLines)
      const result = buildEmptyResult()

      if (normalizedLines.length === 0) {
        return result
      }

      const uniqueSkus = [...new Set(normalizedLines.map((line) => line.sku))]
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .in('sku', uniqueSkus)
        .eq('tenant_id', tenantId)

      if (error) {
        throw error
      }

      const products = applyCommissionToProducts(
        (data ?? []) as Product[],
        profile?.role,
        profile?.commission_rate,
      )
      const productsBySku = new Map(products.map((product) => [product.sku, product]))

      const preparedLines: Array<{ product: Product; quantity: number }> = []

      for (const line of normalizedLines) {
        const product = productsBySku.get(line.sku)

        if (!product) {
          result.missingSkus.push(line.sku)
          continue
        }

        const availableQuantity = product.quantity ?? 0
        if (availableQuantity <= 0) {
          result.unavailableSkus.push(line.sku)
          continue
        }

        const finalQuantity = Math.min(line.quantity, availableQuantity)
        if (finalQuantity < line.quantity) {
          result.adjustedQuantities.push({
            sku: line.sku,
            requestedQuantity: line.quantity,
            loadedQuantity: finalQuantity,
          })
        }

        preparedLines.push({
          product,
          quantity: finalQuantity,
        })
      }

      if (preparedLines.length === 0) {
        return result
      }

      const cartStore = useCartStore.getState()
      const currentCartItemCount = cartStore.getItemCount()

      if (currentCartItemCount > 0 && options?.confirmReplace) {
        const confirmed = await options.confirmReplace()
        if (!confirmed) {
          return {
            ...result,
            cancelled: true,
          }
        }
      }

      cartStore.clearCart()

      for (const preparedLine of preparedLines) {
        const addResult = cartStore.addItem(preparedLine.product, preparedLine.quantity, 'buyer')
        if (addResult.success) {
          result.addedCount += 1
        } else if ((preparedLine.product.quantity ?? 0) <= 0) {
          result.unavailableSkus.push(preparedLine.product.sku)
        }
      }

      return result
    },
    [profile?.commission_rate, profile?.role, tenantId],
  )

  return {
    replaceCartWithSource,
  }
}
