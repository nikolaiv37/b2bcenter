export interface Company {
  id: string
  name: string
  slug: string
  logo_url?: string
  stripe_id?: string
  eik_bulstat?: string
  vat_number?: string
  phone?: string
  address?: string
  city?: string
  website?: string
  // МОЛ (Материално Отговорно Лице) - Legal representative full name
  mol?: string
  // Bank details for invoices
  bank_name?: string
  iban?: string
  bic?: string
  onboarding_completed?: boolean
  created_at: string
  updated_at: string
}

export type TenantStatus = 'active' | 'suspended'

export interface TenantBranding {
  logo_url?: string | null
  primary_color?: string | null
  accent_color?: string | null
  [key: string]: unknown
}

export interface Tenant {
  id: string
  name: string
  slug: string
  status: TenantStatus
  branding: TenantBranding | null
  primary_domain?: string | null
  owner_user_id?: string | null
  created_at?: string
}

export interface TenantDomain {
  id: string
  tenant_id: string
  domain: string
  verified: boolean
  is_primary: boolean
}

export interface TenantMembership {
  id: string
  user_id: string
  tenant_id: string
  role: string
}

export type UserRole = 'admin' | 'company'

export type InvitationStatus = 'active' | 'invited'

export interface Profile {
  id: string
  role: UserRole
  company_id?: string | null
  company_name?: string | null
  full_name?: string | null
  phone?: string | null
  email?: string | null
  avatar_url?: string | null
  commission_rate?: number | null
  invitation_status?: InvitationStatus
  is_platform_admin?: boolean
  created_at: string
  updated_at?: string // May not exist in DB
}

// Client is a Profile with role='company' - used for admin B2B client management
export interface Client extends Profile {
  role: 'company'
  // Optional aggregated stats used on admin clients page
  orders_count?: number
  // Optional aggregated unpaid balance (from quotes with unpaid statuses)
  unpaid_amount?: number
}

// Legacy alias: in older code we referred to B2B clients as "distributors"
// Keep this for backwards compatibility with existing hooks.
export type Distributor = Client

export interface Product {
  id: string
  supplier_id: string
  sku: string
  name: string
  description?: string
  category?: string // ← DEPRECATED – kept only for old CSV imports. Never use in queries.
  category_id?: string | null // Normalized foreign key to categories table
  model?: string
  manufacturer?: string
  retail_price?: number
  weboffer_price: number
  availability?: string
  quantity: number
  weight?: number
  transportational_weight?: number
  date_expected?: string
  main_image?: string
  images: string[]
  is_visible?: boolean
  specs?: Record<string, unknown>
  created_at?: string
  updated_at?: string
  // Legacy/alias fields for compatibility
  company_id?: string
  moq?: number
  wholesale_price?: number
  stock?: number
  // Computed field for personalized commission discounts (set at runtime, not stored in DB)
  // adjusted_price = weboffer_price * (1 - commission_rate) for company users
  adjusted_price?: number
  // Per-product shipping data used to auto-fill carrier shipment forms.
  shipping_weight_kg?: number | null
  shipping_parcels_count?: number | null
  shipping_length_cm?: number | null
  shipping_width_cm?: number | null
  shipping_height_cm?: number | null
  shipping_requires_review?: boolean | null
}

export interface QuoteItem {
  product_id: string
  product_name: string
  sku: string
  quantity: number
  unit_price: number
  total: number
  is_backorder?: boolean
}

// New order workflow statuses
export type QuoteStatus = 'processing' | 'awaiting_payment' | 'shipped' | 'completed' | 'rejected'

// Legacy status mapping for database compatibility
// DB values: 'new' -> 'processing', 'pending' -> 'awaiting_payment', 'approved' -> 'completed', 'shipped' -> 'shipped', 'rejected' -> 'rejected'

export interface Quote {
  id: string
  customer_id: string
  company_id: string
  items: QuoteItem[]
  subtotal: number
  tax?: number
  shipping?: number
  total: number
  status: QuoteStatus
  expires_at: string
  notes?: string
  customer_email?: string
  customer_name?: string
  has_backorder_items?: boolean
  created_at: string
  updated_at: string
}

// New simplified order statuses workflow
export type OrderStatus = 'processing' | 'awaiting_payment' | 'shipped' | 'completed' | 'rejected'

// Shipping method options
export type ShippingMethod = 
  | 'warehouse_pickup'    // Pick up from our Warehouse
  | 'transport_company'   // Delivery to a transportation company of your choice
  | 'dropshipping'        // Delivery to your Customer (Dropshipping)
  | 'shop_delivery'       // Delivery to your Shop (DEFAULT)

// Shipping method display labels and icons
export const SHIPPING_METHOD_CONFIG: Record<ShippingMethod, { label: string; shortLabel: string; icon: string; color: string }> = {
  warehouse_pickup: {
    label: 'Pick up from our Warehouse',
    shortLabel: 'Warehouse',
    icon: '🏭',
    color: 'blue',
  },
  transport_company: {
    label: 'Delivery to transportation company',
    shortLabel: 'Transport',
    icon: '🚛',
    color: 'amber',
  },
  dropshipping: {
    label: 'Delivery to your Customer',
    shortLabel: 'Dropship',
    icon: '📦',
    color: 'purple',
  },
  shop_delivery: {
    label: 'Delivery to your Shop',
    shortLabel: 'Shop',
    icon: '🏪',
    color: 'green',
  },
}

export interface Order {
  id: string
  quote_id?: string
  company_id: string
  customer_id: string
  customer_email: string
  customer_name?: string
  items: QuoteItem[]
  subtotal: number
  tax?: number
  shipping?: number
  total: number
  status: OrderStatus
  shipping_method?: ShippingMethod
  payment_id?: string
  payment_status?: 'pending' | 'paid' | 'failed' | 'refunded'
  tracking_number?: string
  notes?: string
  has_backorder_items?: boolean
  created_at: string
  updated_at: string
  shipped_at?: string
  delivered_at?: string
}

export interface PriceTier {
  min_quantity: number
  max_quantity?: number
  price: number
  discount_percentage?: number
}

export interface CartItem {
  product: Product
  quantity: number
  /** Effective unit price persisted at the moment of add. */
  price: number
  /** price * quantity */
  total: number
  is_backorder?: boolean
  // ── Phase 5 pricing metadata (optional, backward compatible) ─────────
  /** Original `weboffer_price` at the moment of add. */
  base_price?: number
  /** Decimal discount rate applied (0–0.5). */
  discount_rate?: number
  /** Which pricing rule produced `price`. */
  discount_source?: PricingDiscountSource
}

export interface DashboardStats {
  total_revenue: number
  total_orders: number
  pending_quotes: number
  low_stock_products: number
  revenue_change: number
  orders_change: number
}

// Wishlist is per-user, persisted forever, survives catalog re-uploads (uses SKU)
export interface WishlistItem {
  id: string
  user_id: string
  product_sku: string
  created_at: string
}

// ── Pricing Policies ───────────────────────────────────────
//
// Client-specific pricing rules with priority:
//   1. Product-specific discount  (PricingPolicyItem with scope='product')
//   2. Category-specific discount (PricingPolicyItem with scope='category')
//   3. Default discount           (PricingPolicy.default_discount)
//   4. Legacy commission_rate fallback (Profile.commission_rate)
//   5. No discount
//
// Discount rates are stored as decimals (0.10 = 10%, 0.50 = 50%, capped at 0.5).

export type PricingPolicyItemScope = 'product' | 'category'

export interface PricingPolicy {
  id: string
  tenant_id: string
  client_user_id: string
  name: string
  default_discount: number
  is_active: boolean
  created_by?: string | null
  created_at: string
  updated_at: string
}

export interface PricingPolicyItem {
  id: string
  tenant_id: string
  policy_id: string
  scope: PricingPolicyItemScope
  product_sku?: string | null
  category_id?: string | null
  discount: number
  created_at: string
}

export interface ResolvedPricingPolicy {
  policy: PricingPolicy
  items: PricingPolicyItem[]
}

export type PricingDiscountSource =
  | 'product'
  | 'category'
  | 'default'
  | 'legacy'
  | 'none'

export interface EffectivePriceResult {
  basePrice: number
  finalPrice: number
  discountRate: number
  discountSource: PricingDiscountSource
  matchedPolicyItemId?: string
}

// ── Notifications ──────────────────────────────────────────

export type NotificationType =
  | 'order_created'
  | 'order_status_changed'
  | 'complaint_created'
  | 'complaint_status_changed'
  | 'client_registered'
  | 'commission_changed'
  | 'catalog_updated'

// Structured metadata stored per notification type (used for i18n interpolation).
// e.g. { company_name: "Acme", order_number: 1042, status: "shipped" }
export interface NotificationMetadata {
  company_name?: string
  order_number?: number
  status?: string
  commission_rate?: number
  imported_count?: number
  updated_count?: number
  [key: string]: unknown
}

// Named AppNotification to avoid collision with the browser's built-in Notification API.
export interface AppNotification {
  id: string
  tenant_id: string
  user_id: string
  actor_id?: string
  type: NotificationType
  entity_type?: string
  entity_id?: string
  metadata: NotificationMetadata
  read_at?: string | null
  created_at: string
}
