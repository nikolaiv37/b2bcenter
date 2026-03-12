import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { Product, CartItem } from '@/types'

/**
 * Get the effective price for a product.
 * Uses adjusted_price if available (for commission discounts), otherwise weboffer_price.
 */
function getEffectivePrice(product: Product): number {
  // Use adjusted_price if set (commission-based discount), otherwise weboffer_price
  return product.adjusted_price ?? product.weboffer_price ?? 0
}

interface CartState {
  items: CartItem[]
  addItem: (product: Product, quantity: number, userRole?: 'admin' | 'sales' | 'buyer' | 'company') => {
    success: boolean
    message?: string
  }
  removeItem: (productId: string) => void
  updateQuantity: (productId: string, quantity: number, userRole?: 'admin' | 'sales' | 'buyer' | 'company') => {
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

      addItem: (product, quantity, _userRole) => {
        void _userRole
        // Validate stock (use quantity field)
        const stock = product.quantity ?? 0
        if (quantity > stock) {
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

        if (existingItemIndex > -1) {
          // Update existing item
          const newQuantity = items[existingItemIndex].quantity + quantity
          if (newQuantity > stock) {
            return {
              success: false,
              message: `Only ${stock} units available in stock`,
            }
          }

          // Use effective price (adjusted_price if commission discount applies, else weboffer_price)
          const unitPrice = getEffectivePrice(product)
          const updatedItems = [...items]
          updatedItems[existingItemIndex] = {
            ...updatedItems[existingItemIndex],
            product, // Update product to store latest adjusted_price
            quantity: newQuantity,
            price: unitPrice,
            total: unitPrice * newQuantity,
          }

          set({ items: updatedItems })
        } else {
          // Add new item - use effective price (adjusted_price or weboffer_price)
          const unitPrice = getEffectivePrice(product)
          const newItem: CartItem = {
            product,
            quantity,
            price: unitPrice,
            total: unitPrice * quantity,
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

      updateQuantity: (productId, quantity, _userRole) => {
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
        if (quantity > stock) {
          return {
            success: false,
            message: `Only ${stock} units available in stock`,
          }
        }

        // Use effective price (adjusted_price if commission discount applies, else weboffer_price)
        const unitPrice = getEffectivePrice(item.product)
        const updatedItems = [...items]
        updatedItems[itemIndex] = {
          ...item,
          quantity,
          price: unitPrice,
          total: unitPrice * quantity,
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
