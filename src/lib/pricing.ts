import {
  Product,
  PriceTier,
  EffectivePriceResult,
  PricingPolicyItem,
  ResolvedPricingPolicy,
} from '@/types'

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

// ---------------------------------------------------------------------------
// Pricing Policies — central resolver
//
// Priority (no stacking — most specific match wins):
//   1. Product policy item     (matched by product.sku)
//   2. Category policy item    (matched by product.category_id)
//   3. Policy default_discount (when a policy exists)
//   4. Legacy commission_rate fallback (profiles.commission_rate)
//   5. No discount
//
// Discount rates are decimals (0.10 = 10%, 0.50 = 50%), hard-capped at 0.50.
// Base price is always `product.weboffer_price`.
// ---------------------------------------------------------------------------

/** Hard cap on any discount rate. Matches the DB CHECK constraint. */
export const MAX_DISCOUNT_RATE = 0.5

/**
 * Clamp a discount rate into [0, MAX_DISCOUNT_RATE].
 * Treats null/undefined/NaN as 0.
 */
export function clampDiscountRate(rate: number | null | undefined): number {
  if (rate == null || Number.isNaN(rate)) return 0
  if (rate <= 0) return 0
  if (rate >= MAX_DISCOUNT_RATE) return MAX_DISCOUNT_RATE
  return rate
}

function round2(value: number): number {
  return Math.round(value * 100) / 100
}

/**
 * Apply a decimal discount rate to a base price.
 * Returns a non-negative number rounded to 2 decimals.
 */
export function applyDiscount(
  price: number | null | undefined,
  rate: number | null | undefined,
): number {
  const base = typeof price === 'number' && !Number.isNaN(price) ? price : 0
  const clamped = clampDiscountRate(rate)
  if (clamped === 0) return round2(base)
  return round2(base * (1 - clamped))
}

export interface PricingResolutionContext {
  /** Resolved policy for the user being priced for. */
  policy: ResolvedPricingPolicy | null
  /**
   * Legacy fallback (`profiles.commission_rate`). Used only when no policy
   * applies at any level. Kept for backwards compatibility while existing
   * tenants are migrated onto pricing policies.
   */
  legacyCommissionRate?: number | null
}

/**
 * Resolve the effective price for a single product given a pricing context.
 *
 * O(items) per call. Callers pricing many products in a tight loop can
 * memoise the bucketed lookup themselves (out of scope for Phase 2).
 */
export function resolveProductPricing(
  product: Pick<Product, 'sku' | 'category_id' | 'weboffer_price'>,
  context: PricingResolutionContext,
): EffectivePriceResult {
  const basePrice =
    typeof product.weboffer_price === 'number' &&
    !Number.isNaN(product.weboffer_price)
      ? product.weboffer_price
      : 0

  const policy = context.policy

  if (policy) {
    const items = policy.items ?? []

    // 1. Product-specific override (match by SKU)
    if (product.sku) {
      const productItem = findProductItem(items, product.sku)
      if (productItem) {
        const rate = clampDiscountRate(productItem.discount)
        return {
          basePrice,
          finalPrice: applyDiscount(basePrice, rate),
          discountRate: rate,
          discountSource: 'product',
          matchedPolicyItemId: productItem.id,
        }
      }
    }

    // 2. Category-specific override (match by category_id)
    if (product.category_id) {
      const categoryItem = findCategoryItem(items, product.category_id)
      if (categoryItem) {
        const rate = clampDiscountRate(categoryItem.discount)
        return {
          basePrice,
          finalPrice: applyDiscount(basePrice, rate),
          discountRate: rate,
          discountSource: 'category',
          matchedPolicyItemId: categoryItem.id,
        }
      }
    }

    // 3. Policy default
    const defaultRate = clampDiscountRate(policy.policy.default_discount)
    if (defaultRate > 0) {
      return {
        basePrice,
        finalPrice: applyDiscount(basePrice, defaultRate),
        discountRate: defaultRate,
        discountSource: 'default',
      }
    }
  }

  // 4. Legacy commission_rate fallback (only when no policy applied at all)
  const legacyRate = clampDiscountRate(context.legacyCommissionRate)
  if (legacyRate > 0) {
    return {
      basePrice,
      finalPrice: applyDiscount(basePrice, legacyRate),
      discountRate: legacyRate,
      discountSource: 'legacy',
    }
  }

  // 5. No discount
  return {
    basePrice,
    finalPrice: round2(basePrice),
    discountRate: 0,
    discountSource: 'none',
  }
}

/**
 * Phase-5 helper: build the `CartLinePricing` payload for `cartStore.addItem`
 * directly from a product and the current pricing context. Keeps cart write
 * paths in lockstep with the catalog display.
 */
export function resolveCartLinePricing(
  product: Pick<Product, 'sku' | 'category_id' | 'weboffer_price'>,
  context: PricingResolutionContext,
): {
  unitPrice: number
  basePrice: number
  discountRate: number
  discountSource: EffectivePriceResult['discountSource']
} {
  const r = resolveProductPricing(product, context)
  return {
    unitPrice: r.finalPrice,
    basePrice: r.basePrice,
    discountRate: r.discountRate,
    discountSource: r.discountSource,
  }
}

/**
 * Phase-4 compatibility bridge: map a list of products and stamp each one
 * with a policy-resolved `adjusted_price`. Existing card/detail components
 * already render `product.adjusted_price ?? product.weboffer_price`, so this
 * keeps the read path untouched while the new resolver becomes the source
 * of truth.
 *
 * Returns the same input array reference when empty so callers can `||` on it.
 */
export function applyPolicyToProducts<T extends Pick<Product, 'sku' | 'category_id' | 'weboffer_price'>>(
  products: T[] | null | undefined,
  context: PricingResolutionContext,
): T[] {
  if (!products || products.length === 0) return (products ?? []) as T[]
  return products.map((p) => {
    const { finalPrice } = resolveProductPricing(p, context)
    return { ...p, adjusted_price: finalPrice }
  })
}

function findProductItem(
  items: PricingPolicyItem[],
  sku: string,
): PricingPolicyItem | undefined {
  for (const item of items) {
    if (item.scope === 'product' && item.product_sku === sku) return item
  }
  return undefined
}

function findCategoryItem(
  items: PricingPolicyItem[],
  categoryId: string,
): PricingPolicyItem | undefined {
  for (const item of items) {
    if (item.scope === 'category' && item.category_id === categoryId) return item
  }
  return undefined
}
