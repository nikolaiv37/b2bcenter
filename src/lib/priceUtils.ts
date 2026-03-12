/**
 * Price calculation utilities for personalized commission discounts.
 * 
 * Commission rates are stored as decimals (0.00 - 0.50) representing 0-50% discount.
 * Example: rate=0.15 means 15% discount → price * 0.85
 */

/**
 * Apply commission rate to a base price.
 * @param basePrice - The original weboffer_price
 * @param commissionRate - Decimal rate (0.00 to 0.50), e.g., 0.15 = 15% discount
 * @returns Adjusted price rounded to 2 decimal places
 */
export function applyCommissionRate(
  basePrice: number | null | undefined,
  commissionRate: number | null | undefined
): number {
  if (!basePrice && basePrice !== 0) return 0
  
  // No commission rate or zero rate = base price
  if (!commissionRate || commissionRate === 0) {
    return Math.round(basePrice * 100) / 100
  }
  
  // Clamp rate between 0 and 0.50 (max 50% discount)
  const clampedRate = Math.max(0, Math.min(0.50, commissionRate))
  
  // adjusted_price = basePrice * (1 - rate)
  const adjustedPrice = basePrice * (1 - clampedRate)
  
  // Round to 2 decimal places
  return Math.round(adjustedPrice * 100) / 100
}

/**
 * Check if a user should see adjusted prices.
 * Only company users with a commission rate > 0 get discounts.
 */
export function shouldApplyCommission(
  role: string | null | undefined,
  commissionRate: number | null | undefined
): boolean {
  // Only 'company' role users get commission-based discounts
  if (role !== 'company') return false
  
  // Must have a positive commission rate
  return !!commissionRate && commissionRate > 0
}

/**
 * Format commission rate as a percentage string.
 * @param rate - Decimal rate (e.g., 0.15)
 * @returns Formatted percentage (e.g., "15%")
 */
export function formatCommissionRate(rate: number | null | undefined): string {
  if (!rate || rate === 0) return '0%'
  const percentage = rate * 100
  return `${percentage.toFixed(percentage % 1 === 0 ? 0 : 1)}%`
}

