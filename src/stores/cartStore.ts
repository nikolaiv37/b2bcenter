import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { Product, CartItem, PricingDiscountSource } from '@/types'

/**
 * Resolved pricing for a single cart line.
 *
 * Phase 5: every cart write path should compute this via
 * `resolveProductPricing(product, usePricingContext())` and pass it through
 * to `addItem` / `updateQuantity`. The cart then persists the unit price
 * (and a light audit trail) instead of recomputing from `product.adjusted_price`.
 *
 * Callers that do NOT pass `pricing` fall back to the legacy behaviour
 * (`product.adjusted_price ?? product.weboffer_price`). That keeps every
 * existing call site working until they are migrated.
 */
export interface CartLinePricing {
  unitPrice: number
  basePrice: number
  discountRate: number
  discountSource: PricingDiscountSource
}

interface CartLineOptions {
  is_backorder?: boolean
  pricing?: CartLinePricing
}

/**
 * Backwards-compatible price resolver for callers that did not supply
 * pricing metadata. Reads whatever `useQueryProducts` / `applyPolicyToProducts`
 * already stamped onto the product.
 */
function getEffectivePrice(product: Product): number {
  return product.adjusted_price ?? product.weboffer_price ?? 0
}

function pricingPatch(product: Product, pricing?: CartLinePricing): {
  unitPrice: number
  base_price?: number
  discount_rate?: number
  discount_source?: PricingDiscountSource
} {
  if (pricing) {
    return {
      unitPrice: pricing.unitPrice,
      base_price: pricing.basePrice,
      discount_rate: pricing.discountRate,
      discount_source: pricing.discountSource,
    }
  }
  return { unitPrice: getEffectivePrice(product) }
}

interface CartState {
  items: CartItem[]
  addItem: (
    product: Product,
    quantity: number,
    userRole?: 'admin' | 'sales' | 'buyer' | 'company',
    options?: CartLineOptions,
  ) => {
    success: boolean
    message?: string
  }
  removeItem: (productId: string) => void
  updateQuantity: (
    productId: string,
    quantity: number,
    userRole?: 'admin' | 'sales' | 'buyer' | 'company',
    options?: CartLineOptions,
  ) => {
    success: boolean
    message?: string
  }
  clearCart: () => void
  getTotal: () => number
  getItemCount: () => number
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],

      addItem: (product, quantity, _userRole, options) => {
        void _userRole
        // Validate stock (use quantity field)
        const stock = product.quantity ?? 0
        const isBackorder = options?.is_backorder ?? false

        if (product.is_visible === false) {
          return {
            success: false,
            message: 'This product is no longer available for ordering',
          }
        }

        if (!isBackorder && quantity > stock) {
          return {
            success: false,
            message: `Only ${stock} units available in stock`,
          }
        }

        if (quantity <= 0) {
          return {
            success: false,
            message: 'Quantity must be greater than 0',
          }
        }

        const items = get().items
        const existingItemIndex = items.findIndex(
          (item) => item.product.id === product.id
        )

        const patch = pricingPatch(product, options?.pricing)

        if (existingItemIndex > -1) {
          // Update existing item
          const existingItem = items[existingItemIndex]
          const nextIsBackorder = existingItem.is_backorder || isBackorder
          const newQuantity = items[existingItemIndex].quantity + quantity

          if (!nextIsBackorder && newQuantity > stock) {
            return {
              success: false,
              message: `Only ${stock} units available in stock`,
            }
          }

          const updatedItems = [...items]
          updatedItems[existingItemIndex] = {
            ...updatedItems[existingItemIndex],
            product, // Update product to store latest snapshot
            quantity: newQuantity,
            price: patch.unitPrice,
            total: patch.unitPrice * newQuantity,
            is_backorder: nextIsBackorder,
            base_price: patch.base_price,
            discount_rate: patch.discount_rate,
            discount_source: patch.discount_source,
          }

          set({ items: updatedItems })
        } else {
          // Add new item
          const newItem: CartItem = {
            product,
            quantity,
            price: patch.unitPrice,
            total: patch.unitPrice * quantity,
            is_backorder: isBackorder,
            base_price: patch.base_price,
            discount_rate: patch.discount_rate,
            discount_source: patch.discount_source,
          }

          set({ items: [...items, newItem] })
        }

        return { success: true }
      },

      removeItem: (productId) => {
        set((state) => ({
          items: state.items.filter((item) => item.product.id !== productId),
        }))
      },

      updateQuantity: (productId, quantity, _userRole, options) => {
        void _userRole
        const items = get().items
        const itemIndex = items.findIndex((item) => item.product.id === productId)

        if (itemIndex === -1) {
          return {
            success: false,
            message: 'Item not found in cart',
          }
        }

        const item = items[itemIndex]

        if (quantity === 0) {
          get().removeItem(productId)
          return { success: true }
        }

        // Validate stock (use quantity field)
        const stock = item.product.quantity ?? 0
        const nextIsBackorder = options?.is_backorder ?? item.is_backorder ?? false

        if (!nextIsBackorder && quantity > stock) {
          return {
            success: false,
            message: `Only ${stock} units available in stock`,
          }
        }

        // If the caller provided fresh pricing metadata, use it. Otherwise
        // KEEP the previously persisted price on this line — never silently
        // re-snap an existing line to today's catalog price (the user added
        // it at a specific price and quantity edits should not change that).
        const useFreshPricing = !!options?.pricing
        const unitPrice = useFreshPricing
          ? options!.pricing!.unitPrice
          : item.price

        const updatedItems = [...items]
        updatedItems[itemIndex] = {
          ...item,
          quantity,
          price: unitPrice,
          total: unitPrice * quantity,
          is_backorder: nextIsBackorder,
          ...(useFreshPricing
            ? {
                base_price: options!.pricing!.basePrice,
                discount_rate: options!.pricing!.discountRate,
                discount_source: options!.pricing!.discountSource,
              }
            : null),
        }

        set({ items: updatedItems })
        return { success: true }
      },

      clearCart: () => {
        set({ items: [] })
      },

      getTotal: () => {
        return get().items.reduce((total, item) => total + item.total, 0)
      },

      getItemCount: () => {
        return get().items.reduce((count, item) => count + item.quantity, 0)
      },
    }),
    {
      name: 'furnitrade-cart',
    }
  )
)
