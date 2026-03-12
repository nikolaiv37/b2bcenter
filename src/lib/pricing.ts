import { Product, PriceTier } from '@/types'

/**
 * Calculate the price based on quantity and tiered pricing
 */
export function calculateTieredPrice(
  product: Product,
  quantity: number,
  userRole?: 'admin' | 'sales' | 'buyer' | 'company'
): number {
  const basePrice = (userRole === 'buyer' || userRole === 'company') 
    ? (product.wholesale_price ?? product.retail_price ?? 0)
    : (product.retail_price ?? 0)

  if (basePrice === 0) return 0

  // Tiered pricing logic
  if (quantity >= 51) {
    return basePrice * 0.8 // 20% discount for 51+
  } else if (quantity >= 11) {
    return basePrice * 0.9 // 10% discount for 11-50
  }
  
  return basePrice
}

/**
 * Get tiered pricing breakdown for a product
 */
export function getTieredPricing(product: Product, userRole?: 'admin' | 'sales' | 'buyer' | 'company'): PriceTier[] {
  const basePrice = (userRole === 'buyer' || userRole === 'company')
    ? (product.wholesale_price ?? product.retail_price ?? 0)
    : (product.retail_price ?? 0)

  if (basePrice === 0) {
    return [
      { min_quantity: 1, price: 0, discount_percentage: 0 },
    ]
  }

  return [
    {
      min_quantity: 1,
      max_quantity: 10,
      price: basePrice,
      discount_percentage: 0,
    },
    {
      min_quantity: 11,
      max_quantity: 50,
      price: basePrice * 0.9,
      discount_percentage: 10,
    },
    {
      min_quantity: 51,
      price: basePrice * 0.8,
      discount_percentage: 20,
    },
  ]
}

/**
 * Calculate total for a line item
 */
export function calculateLineTotal(
  product: Product,
  quantity: number,
  userRole?: 'admin' | 'sales' | 'buyer' | 'company'
): number {
  const unitPrice = calculateTieredPrice(product, quantity, userRole)
  return unitPrice * quantity
}

/**
 * Validate if quantity meets MOQ requirement
 */
export function validateMOQ(product: Product, quantity: number): {
  valid: boolean
  message?: string
} {
  const moq = product.moq ?? 1
  if (quantity < moq) {
    return {
      valid: false,
      message: `Minimum order quantity is ${moq} units`,
    }
  }
  return { valid: true }
}

/**
 * Check if product has sufficient stock
 */
export function validateStock(product: Product, quantity: number): {
  valid: boolean
  message?: string
} {
  const stock = product.stock ?? product.quantity ?? 0
  if (quantity > stock) {
    return {
      valid: false,
      message: `Only ${stock} units available in stock`,
    }
  }
  return { valid: true }
}

/**
 * Calculate order subtotal
 */
export function calculateSubtotal(
  items: Array<{ product: Product; quantity: number }>,
  userRole?: 'admin' | 'sales' | 'buyer' | 'company'
): number {
  return items.reduce((total, item) => {
    return total + calculateLineTotal(item.product, item.quantity, userRole)
  }, 0)
}

/**
 * Calculate tax (example: 10%)
 */
export function calculateTax(subtotal: number, taxRate = 0.1): number {
  return subtotal * taxRate
}

/**
 * Calculate shipping (flat rate or tiered by total)
 */
export function calculateShipping(subtotal: number): number {
  if (subtotal >= 1000) return 0 // Free shipping over $1000
  if (subtotal >= 500) return 25
  return 50
}

/**
 * Calculate order total
 */
export function calculateOrderTotal(
  subtotal: number,
  includeShipping = true,
  includeTax = true
): {
  subtotal: number
  tax: number
  shipping: number
  total: number
} {
  const tax = includeTax ? calculateTax(subtotal) : 0
  const shipping = includeShipping ? calculateShipping(subtotal) : 0
  const total = subtotal + tax + shipping

  return {
    subtotal,
    tax,
    shipping,
    total,
  }
}

