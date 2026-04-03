import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import { useAppContext } from '@/lib/app/AppContext'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase/client'
import { GlassCard } from '@/components/GlassCard'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { OrderStatusBadge } from '@/components/OrderStatusBadge'
import { formatCurrency, calculatePercentageChange, cn } from '@/lib/utils'
import { useAuth } from '@/hooks/useAuth'
import { useTenantPath } from '@/lib/tenant/TenantProvider'
import { useUnpaidBalance } from '@/hooks/useUnpaidBalance'
import { useCompanyUnpaidBalances } from '@/hooks/useCompanyUnpaidBalances'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  CartesianGrid,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import {
  DollarSign,
  ShoppingCart,
  Users,
  Package,
  TrendingUp,
  TrendingDown,
  ArrowRight,
  CreditCard,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { trackEvent, AnalyticsEvents } from '@/lib/analytics'

const OverviewChartsSection = lazy(() =>
  import('@/app/dashboard/overview-charts').then((m) => ({ default: m.OverviewChartsSection }))
)

interface DashboardStats {
  totalRevenue: number
  thisMonthRevenue: number
  lastMonthRevenue: number
  totalOrders: number
  thisMonthOrders: number
  lastMonthOrders: number
  activeCustomers: number
  totalProducts: number
  lowStockCount: number
  revenueByDay: Array<{ date: string; revenue: number }>
  ordersByDay: Array<{ date: string; orders: number }>
  categoriesByRevenue: Array<{ name: string; value: number; revenue: number }>
  recentOrders: Array<{
    id: string
    order_number?: number
    customer_name?: string
    customer_email: string
    total: number
    status: string
    created_at: string
  }>
  lowStockProducts: Array<{
    id: string
    sku: string
    name: string
    stock: number
    category?: string
    main_image?: string
    images?: string[]
  }>
  stockStatusCounts: {
    inStock: number
    lowStock: number
    outOfStock: number
  }
  processingOrdersCount: number
}

interface DashboardSummary {
  totalRevenue: number
  thisMonthRevenue: number
  lastMonthRevenue: number
  totalOrders: number
  thisMonthOrders: number
  lastMonthOrders: number
  activeCustomers: number
  totalProducts: number
  lowStockCount: number
}

interface QuoteRow {
  id?: string | number | null
  order_number?: string | number | null
  user_id?: string | null
  company_name?: string | null
  email?: string | null
  total?: string | number | null
  status?: string | null
  created_at?: string
  items?: unknown
}

interface ProductRow {
  id?: string | number | null
  sku?: string | null
  name?: string | null
  quantity?: string | number | null
  category?: string | null
  main_image?: string | null
  images?: string[] | null
}

interface OrderItemRow {
  product_id?: string | number | null
  sku?: string | null
  total?: string | number | null
}

interface ProductCategoryRow {
  id?: string | number | null
  category?: string | null
  sku?: string | null
}

const ADMIN_TEXT = '#1A1A2E'
const ADMIN_SUBLABEL = '#6B7280'
const ADMIN_CARD_CLASS =
  'rounded-[12px] border border-[#ECE8F7] bg-white p-6 shadow-[0_12px_32px_rgba(47,36,58,0.08)] backdrop-blur-none'
const ADMIN_SECTION_TITLE = 'text-[18px] font-semibold text-[#1A1A2E]'
const ADMIN_SUBLABEL_CLASS = 'text-[13px] text-[#6B7280]'
const ADMIN_LINK_CLASS =
  'inline-flex items-center gap-1 text-sm font-medium text-[#6C63A8] transition-colors hover:text-[#5b5492]'

function isProcessingStatus(status: string) {
  return ['new', 'draft', 'processing'].includes(status)
}

export function DashboardOverview() {
  const { t } = useTranslation()
  const { user, isAdmin } = useAuth()
  const { workspaceId: tenantId } = useAppContext()
  const navigate = useNavigate()
  const { withBase } = useTenantPath()
  
  // Fetch unpaid balance for non-admin users
  const { data: unpaidData, isLoading: unpaidLoading } = useUnpaidBalance()
  
  // Fetch company unpaid balances for admin users (top 10)
  const { data: companyUnpaidData, isLoading: companyUnpaidLoading } = useCompanyUnpaidBalances(10)
  const [detailsEnabled, setDetailsEnabled] = useState(false)

  useEffect(() => {
    trackEvent(AnalyticsEvents.DASHBOARD_VIEWED)
  }, [])

  useEffect(() => {
    setDetailsEnabled(false)
    if (!tenantId || (!isAdmin && !user?.id)) return

    let timeoutId: ReturnType<typeof setTimeout> | null = null
    let idleId: number | null = null

    const enable = () => setDetailsEnabled(true)

    if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
      idleId = window.requestIdleCallback(enable, { timeout: 1200 })
    } else {
      timeoutId = setTimeout(enable, 300)
    }

    return () => {
      if (idleId !== null && 'cancelIdleCallback' in window) {
        window.cancelIdleCallback(idleId)
      }
      if (timeoutId) {
        clearTimeout(timeoutId)
      }
    }
  }, [tenantId, isAdmin, user?.id])

  const { data: summary, isLoading: isSummaryLoading } = useQuery({
    queryKey: ['workspace', 'dashboard-summary', user?.id, isAdmin],
    queryFn: async () => {
      if (!tenantId) return null
      if (!isAdmin && !user?.id) return null

      const now = new Date()
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
      const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
      const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0)

      const allOrdersPromise = supabase
        .from('quotes')
        .select('total, created_at, user_id, email, status')
        .in('status', ['new', 'pending', 'shipped', 'approved'])
        .eq('tenant_id', tenantId)

      const lowStockCountQuery = supabase
        .from('products')
        .select('*', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .gt('quantity', 0)
        .lte('quantity', 10)

      const outOfStockCountQuery = supabase
        .from('products')
        .select('*', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .eq('quantity', 0)

      const inStockCountQuery = supabase
        .from('products')
        .select('*', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .gt('quantity', 10)

      const [allOrdersResult, lowStockResult, outOfStockResult, inStockResult] = await Promise.all([
        allOrdersPromise,
        lowStockCountQuery,
        outOfStockCountQuery,
        inStockCountQuery,
      ])

      const allOrders = (allOrdersResult.data as QuoteRow[] | null) ?? []

      const thisMonthOrders = allOrders.filter((o) =>
        (o.created_at ? new Date(o.created_at) : new Date(0)) >= startOfMonth
      )
      const lastMonthOrders = allOrders.filter((o) => {
        const createdAt = o.created_at ? new Date(o.created_at) : new Date(0)
        return createdAt >= startOfLastMonth && createdAt <= endOfLastMonth
      })

      const thisMonthCompleted = thisMonthOrders.filter((o) => o.status === 'approved')
      const lastMonthCompleted = lastMonthOrders.filter((o) => o.status === 'approved')

      const totalRevenue = allOrders.reduce((sum, o) => sum + Number(o.total || 0), 0)
      const thisMonthRevenue = thisMonthCompleted.reduce((sum, o) => sum + Number(o.total || 0), 0)
      const lastMonthRevenue = lastMonthCompleted.reduce((sum, o) => sum + Number(o.total || 0), 0)

      const uniqueCustomers = new Set(
        allOrders.map((o) => o.user_id || o.email).filter(Boolean)
      )

      const lowStockCount = lowStockResult.count ?? 0
      const outOfStockCount = outOfStockResult.count ?? 0
      const inStockCount = inStockResult.count ?? 0

      return {
        totalRevenue,
        thisMonthRevenue,
        lastMonthRevenue,
        totalOrders: allOrders.length,
        thisMonthOrders: thisMonthOrders.length,
        lastMonthOrders: lastMonthOrders.length,
        activeCustomers: uniqueCustomers.size,
        totalProducts: lowStockCount + outOfStockCount + inStockCount,
        lowStockCount,
      } as DashboardSummary
    },
    enabled: !!tenantId && (isAdmin || !!user?.id),
    staleTime: 30_000,
  })

  const { data: stats, isLoading } = useQuery({
    queryKey: ['workspace', 'dashboard-stats', user?.id, isAdmin],
    queryFn: async () => {
      if (!tenantId) return null
      // For admin, we can proceed without user.id (they see all data)
      // For company users, we need at least user.id (RLS will handle filtering)
      if (!isAdmin && !user?.id) return null

      const now = new Date()
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
      const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
      const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0)
      const thirtyDaysAgo = new Date(now)
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

      // Fetch all quotes (treating them as orders since orders table doesn't exist)
      // Status workflow: 'new' (Processing), 'pending' (Awaiting Payment), 'shipped', 'approved' (Completed & Sent)
      const { data: allOrdersRaw } = await supabase
        .from('quotes')
        .select('total, created_at, user_id, items, status, id, order_number, company_name, email')
        .in('status', ['new', 'pending', 'shipped', 'approved'])
        .eq('tenant_id', tenantId)
      const allOrders = (allOrdersRaw as QuoteRow[] | null) ?? []

      // Fetch this month's quotes
      const { data: thisMonthOrdersRaw } = await supabase
        .from('quotes')
        .select('total, created_at, items, status')
        .in('status', ['new', 'pending', 'shipped', 'approved'])
        .gte('created_at', startOfMonth.toISOString())
        .eq('tenant_id', tenantId)
      const thisMonthOrders = (thisMonthOrdersRaw as QuoteRow[] | null) ?? []

      // Fetch last month's quotes
      const { data: lastMonthOrdersRaw } = await supabase
        .from('quotes')
        .select('total, created_at, status')
        .in('status', ['new', 'pending', 'shipped', 'approved'])
        .gte('created_at', startOfLastMonth.toISOString())
        .lte('created_at', endOfLastMonth.toISOString())
        .eq('tenant_id', tenantId)
      const lastMonthOrders = (lastMonthOrdersRaw as QuoteRow[] | null) ?? []

      // Fetch recent orders from quotes table (last 5, newest first)
      // Admin sees all orders, company users see only their own (RLS handles this)
      const { data: recentOrdersDataRaw, error: recentOrdersError } = await supabase
        .from('quotes')
        .select('id, user_id, company_name, email, total, status, created_at, order_number')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false })
        .limit(5)
      const recentOrdersData = (recentOrdersDataRaw as QuoteRow[] | null) ?? []
      
      if (recentOrdersError) {
        console.error('Error fetching recent orders:', recentOrdersError)
      }

      // Fetch products - use the EXACT same query structure as products page to ensure consistency
      // Use select('*') to match products page, and use count queries for accurate totals
      // RLS will handle filtering for company users automatically
      
      // First, get counts for each stock status using the same filters as products page
      const lowStockCountQuery = supabase
        .from('products')
        .select('*', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .gt('quantity', 0)
        .lte('quantity', 10)
      
      const outOfStockCountQuery = supabase
        .from('products')
        .select('*', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .eq('quantity', 0)
      
      const inStockCountQuery = supabase
        .from('products')
        .select('*', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .gt('quantity', 10)
      
      // Execute count queries in parallel
      const [lowStockResult, outOfStockResult, inStockResult] = await Promise.all([
        lowStockCountQuery,
        outOfStockCountQuery,
        inStockCountQuery,
      ])
      
      // Extract counts
      const lowStockCount = lowStockResult.count ?? 0
      const outOfStockCount = outOfStockResult.count ?? 0
      const inStockCount = inStockResult.count ?? 0
      
      // Also fetch products for the low stock list (limit to reasonable number for display)
      // Use the same query structure as products page
      const { data: lowStockProductsDataRaw, error: productsError } = await supabase
        .from('products')
        .select('id, sku, name, quantity, category, weboffer_price, main_image, images')
        .gt('quantity', 0)
        .lte('quantity', 10)
        .eq('tenant_id', tenantId)
        .order('quantity', { ascending: true })
        .limit(10) // Only need a few for display
      const lowStockProductsData = (lowStockProductsDataRaw as ProductRow[] | null) ?? []
      
      if (productsError) {
        console.error('Error fetching low stock products:', productsError)
      }
      
      // Normalize quantity field for display products
      const filteredProducts = (lowStockProductsData || []).map((p) => ({
        ...p,
        quantity: Number(p.quantity ?? 0),
      }))

      // Calculate stats
      // Revenue includes all orders (Processing, Awaiting Payment, Shipped, Completed)
      // 'approved' = Completed & Sent (paid), others are in progress
      const approvedOrders = allOrders.filter((o) => 
        o.status === 'approved' || o.status === 'shipped' || o.status === 'new' || o.status === 'pending'
      )
      const totalRevenue = approvedOrders.reduce((sum, o) => sum + Number(o.total || 0), 0)
      
      // For revenue trend, count completed orders ('approved' = Completed & Sent)
      const thisMonthCompleted = thisMonthOrders.filter((o) => o.status === 'approved')
      const thisMonthRevenue = thisMonthCompleted.reduce((sum, o) => sum + Number(o.total || 0), 0)
      
      const lastMonthCompleted = lastMonthOrders.filter((o) => o.status === 'approved')
      const lastMonthRevenue = lastMonthCompleted.reduce((sum, o) => sum + Number(o.total || 0), 0)
      
      // For order counts, show all orders
      const totalOrders = allOrders.length
      const thisMonthOrdersCount = thisMonthOrders.length
      const lastMonthOrdersCount = lastMonthOrders.length

      // Active customers (unique user_ids or emails from quotes)
      const uniqueCustomers = new Set(
        allOrders.map((o) => o.user_id || o.email).filter(Boolean)
      )
      const activeCustomers = uniqueCustomers.size

      // Products stats - use counts from database queries (matches products page exactly)
      // These counts are calculated using the EXACT same filters as products page:
      // - Low Stock: gt('quantity', 0).lte('quantity', 10) - quantity 1-10 inclusive
      // - Out of Stock: eq('quantity', 0) - quantity = 0
      // - In Stock: gt('quantity', 10) - quantity > 10
      const totalProducts = lowStockCount + outOfStockCount + inStockCount
      
      const stockStatusCounts = {
        inStock: inStockCount,
        lowStock: lowStockCount,
        outOfStock: outOfStockCount,
      }
      

      // Revenue by day (this month) - only count completed orders
      const revenueByDayMap = new Map<string, number>()
      thisMonthCompleted.forEach((order) => {
        const date = new Date(order.created_at ?? 0).toISOString().split('T')[0]
        revenueByDayMap.set(date, (revenueByDayMap.get(date) || 0) + Number(order.total || 0))
      })
      const revenueByDay = Array.from(revenueByDayMap.entries())
        .map(([date, revenue]) => ({ date, revenue }))
        .sort((a, b) => a.date.localeCompare(b.date))
        .map((item) => ({
          date: new Date(item.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          revenue: item.revenue,
        }))

      // Orders by day (last 30 days) - count all quotes
      const ordersByDayMap = new Map<string, number>()
      allOrders.forEach((order) => {
        const orderDate = new Date(order.created_at ?? 0)
        if (orderDate >= thirtyDaysAgo) {
          const date = orderDate.toISOString().split('T')[0]
          ordersByDayMap.set(date, (ordersByDayMap.get(date) || 0) + 1)
        }
      })
      const ordersByDay = Array.from(ordersByDayMap.entries())
        .map(([date, orders]) => ({ date, orders }))
        .sort((a, b) => a.date.localeCompare(b.date))
        .map((item) => ({
          date: new Date(item.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          orders: item.orders,
        }))

      // Categories by revenue (from order items) - count ALL quotes (new, pending, approved)
      // This shows categories for all orders, not just approved ones
      // First, collect all unique product_ids AND skus from all quotes (not just approved)
      // Note: Product IDs may change after CSV re-imports, but SKUs are permanent
      const productIds = new Set<string>()
      const productSkus = new Set<string>()
      const allItems: Array<{ product_id: string; sku?: string; total: number }> = []
      
      // Use allOrders instead of approvedOrders for category calculation
      // This includes 'new', 'pending', and 'approved' statuses
      const normalizeItems = (
        rawItems: unknown
      ): Array<{ product_id: string; sku?: string; total: number }> => {
        const normalized: Array<{ product_id: string; sku?: string; total: number }> = []

        const pushItem = (item: OrderItemRow) => {
          const productId = item.product_id ?? null
          if (productId === null || productId === undefined) return
          const productIdStr = String(productId)
          if (!productIdStr) return
          normalized.push({
            product_id: productIdStr,
            sku: item.sku || undefined,
            total: Number(item.total ?? 0),
          })
        }

        if (Array.isArray(rawItems)) {
          rawItems.forEach((item) => pushItem(item as OrderItemRow))
          return normalized
        }

        if (typeof rawItems === 'string') {
          try {
            const parsed = JSON.parse(rawItems)
            if (Array.isArray(parsed)) {
              parsed.forEach((item) => pushItem(item as OrderItemRow))
            }
          } catch (e) {
            console.warn('Failed to parse items JSON:', e, rawItems)
          }
        }

        return normalized
      }

      allOrders.forEach((order) => {
        const items = normalizeItems(order.items)
        
        items.forEach((item) => {
          const productId = item.product_id
          const sku = item.sku
          if (productId) {
            // Normalize product_id to string
            const productIdStr = String(productId)
            productIds.add(productIdStr)
            if (sku) {
              productSkus.add(sku)
            }
            allItems.push({
              product_id: productIdStr,
              sku: sku,
              total: Number(item.total || 0),
            })
          }
        })
      })


      // Fetch all products that appear in approved quotes to get their categories
      // Product IDs in quotes are stored as strings, but products table uses SERIAL (integer) IDs
      const productsMap = new Map<string, string>() // product_id -> category
      if (productIds.size > 0) {
        const productIdsArray = Array.from(productIds)
        
        // Convert string IDs to integers for the query (products table uses SERIAL/integer IDs)
        const productIdsInt = productIdsArray
          .map(id => {
            const parsed = parseInt(id, 10)
            return isNaN(parsed) ? null : parsed
          })
          .filter((id): id is number => id !== null)
        
        
        if (productIdsInt.length > 0) {
          // Try multiple query strategies to find products
          // Strategy 1: Query by integer IDs
          let productsForCategories: ProductCategoryRow[] = []
          
          const { data, error } = await supabase
            .from('products')
            .select('id, category')
            .in('id', productIdsInt)
            .eq('tenant_id', tenantId)
          
          productsForCategories = (data as ProductCategoryRow[] | null) ?? []
          
          if (error) {
            console.error('Error fetching products for categories (by ID):', error)
          }
          
          // Strategy 2: If no products found, try querying as strings (in case Supabase auto-converts)
          if ((!productsForCategories || productsForCategories.length === 0) && productIdsInt.length > 0) {
            const { data: dataStr, error: errorStr } = await supabase
              .from('products')
              .select('id, category')
              .in('id', productIdsArray) // Try with original string array
              .eq('tenant_id', tenantId)
            
            if (!errorStr && dataStr && dataStr.length > 0) {
              productsForCategories = dataStr as ProductCategoryRow[]
            }
          }
          
          // Strategy 3: If no products found by ID, try by SKU (SKUs are permanent, IDs may change)
          if ((!productsForCategories || productsForCategories.length === 0) && productSkus.size > 0) {
            const skusArray = Array.from(productSkus)
            const { data: productsBySku, error: errorBySku } = await supabase
              .from('products')
              .select('id, category, sku')
              .in('sku', skusArray)
              .eq('tenant_id', tenantId)
            
            if (!errorBySku && productsBySku && productsBySku.length > 0) {
              productsForCategories = productsBySku as ProductCategoryRow[]
              
              // Create a map of SKU -> category for lookup
              const skuToCategoryMap = new Map<string, string>()
              productsBySku.forEach((p) => {
                skuToCategoryMap.set(p.sku, p.category || 'Uncategorized')
              })
              
              // Update allItems with categories from SKU lookup
              allItems.forEach((item) => {
                if (item.sku && skuToCategoryMap.has(item.sku)) {
                  const category = skuToCategoryMap.get(item.sku)!
                  // Store category by both product_id (for original lookup) and SKU
                  productsMap.set(item.product_id, category)
                  productsMap.set(item.sku, category)
                }
              })
            }
          }
          
          if (productsForCategories && productsForCategories.length > 0) {
            productsForCategories.forEach((p) => {
              // Store both string and integer versions for lookup
              const productIdStr = String(p.id)
              const category = p.category || 'Uncategorized'
              productsMap.set(productIdStr, category)
              // Also store the integer version as string
              if (typeof p.id === 'number') {
                productsMap.set(String(p.id), category)
              }
            })
          }
        }
      }

      // Calculate revenue by category
      const categoryRevenueMap = new Map<string, number>()
      allItems.forEach((item) => {
        const productIdStr = String(item.product_id)
        // Try to get category by product_id first, then by SKU
        let category = productsMap.get(productIdStr)
        if (!category && item.sku) {
          category = productsMap.get(item.sku)
        }
        category = category || t('overview.uncategorized')
        const currentRevenue = categoryRevenueMap.get(category) || 0
        categoryRevenueMap.set(category, currentRevenue + item.total)
      })
      
      
      let categoriesByRevenue = Array.from(categoryRevenueMap.entries())
        .map(([name, revenue]) => ({ name, value: revenue, revenue }))
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 5)
      
      // If we couldn't find any products (productsMap is empty) but have "Uncategorized",
      // it means products weren't matched - hide the chart
      if (productsMap.size === 0 && categoriesByRevenue.length === 1 && categoriesByRevenue[0].name === 'Uncategorized') {
        categoriesByRevenue = []
      }

      // Recent orders (from quotes table)
      const recentOrders = (recentOrdersData || []).map((order) => {
        let orderNumber: number | string | undefined = order.order_number ?? undefined
        
        // Fallback to using first 8 chars of order id if no order_number
        if (!orderNumber) {
          orderNumber = typeof order.id === 'string' 
            ? order.id.slice(0, 8).toUpperCase() 
            : typeof order.id === 'number'
            ? order.id
            : String(order.id).slice(0, 8).toUpperCase()
        }
        
        return {
          id: String(order.id),
          order_number: orderNumber,
          customer_name: order.company_name || t('overview.unknown'),
          customer_email: order.email || '',
          total: Number(order.total || 0),
          status: order.status || '',
          created_at: order.created_at || '',
        }
      })

      // Low stock products (for display - already fetched above)
      const lowStock = filteredProducts.map((p) => ({
        id: p.id,
        sku: p.sku,
        name: p.name,
        stock: p.quantity || 0,
        category: p.category,
        main_image: p.main_image,
        images: p.images || [],
      }))

      return {
        totalRevenue,
        thisMonthRevenue,
        lastMonthRevenue,
        totalOrders,
        thisMonthOrders: thisMonthOrdersCount,
        lastMonthOrders: lastMonthOrdersCount,
        activeCustomers,
        totalProducts,
        lowStockCount: lowStockCount,
        revenueByDay,
        ordersByDay,
        categoriesByRevenue,
        recentOrders,
        lowStockProducts: lowStock,
        stockStatusCounts,
        processingOrdersCount: allOrders.filter(
          (order) => order.status === 'new' || order.status === 'draft' || order.status === 'processing'
        ).length,
      } as DashboardStats
    },
    enabled: detailsEnabled && !!tenantId && (isAdmin || !!user?.id),
  })

  const topStats = summary ?? stats
  const isTopLoading = isSummaryLoading && !topStats

  const revenueChange = useMemo(() => {
    if (!topStats) return 0
    return calculatePercentageChange(topStats.thisMonthRevenue, topStats.lastMonthRevenue)
  }, [topStats])

  const ordersChange = useMemo(() => {
    if (!topStats) return 0
    return calculatePercentageChange(topStats.thisMonthOrders, topStats.lastMonthOrders)
  }, [topStats])

  const isDetailsLoading = isLoading || !detailsEnabled

  const topUnpaidCompanies = useMemo(
    () => companyUnpaidData?.companies.slice(0, 4) ?? [],
    [companyUnpaidData]
  )

  const topCategories = useMemo(
    () => stats?.categoriesByRevenue.slice(0, 4) ?? [],
    [stats?.categoriesByRevenue]
  )

  const lowStockPreview = useMemo(
    () => [...(stats?.lowStockProducts ?? [])].sort((a, b) => a.stock - b.stock).slice(0, 3),
    [stats?.lowStockProducts]
  )

  const totalTopCategoryRevenue = useMemo(
    () => topCategories.reduce((sum, category) => sum + category.revenue, 0),
    [topCategories]
  )

  const StatCard = ({
    title,
    value,
    subtitle,
    icon: Icon,
    color,
    change,
  }: {
    title: string
    value: string
    subtitle?: string
    icon: LucideIcon
    color: string
    change?: number
  }) => (
    <GlassCard hover className="relative overflow-hidden">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm text-muted-foreground mb-1">{title}</p>
          {isTopLoading ? (
            <Skeleton className="h-10 w-32 mb-2" />
          ) : (
            <p className="text-3xl font-bold mb-1">{value}</p>
          )}
          {subtitle && (
            <p className="text-sm text-muted-foreground mb-2">{subtitle}</p>
          )}
          {change !== undefined && !isTopLoading && (
            <div className="flex items-center gap-1 mt-2">
              {change > 0 ? (
                <TrendingUp className="w-4 h-4 text-green-500" />
              ) : (
                <TrendingDown className="w-4 h-4 text-red-500" />
              )}
              <span
                className={`text-sm font-semibold ${
                  change > 0 ? 'text-green-500' : 'text-red-500'
                }`}
              >
                {change > 0 ? '+' : ''}
                {change.toFixed(1)}%
              </span>
              <span className="text-xs text-muted-foreground ml-1">{t('overview.vsLastMonth')}</span>
            </div>
          )}
        </div>
        <div className={`p-3 rounded-lg bg-white/10 dark:bg-black/10`}>
          <Icon className={`w-6 h-6 ${color}`} />
        </div>
      </div>
    </GlassCard>
  )

  return (
    <div className={cn('pb-24 md:pb-8', isAdmin ? 'space-y-5' : 'space-y-8')}>
      {/* Header */}
      <div>
        <h1 className="mb-2 bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-3xl font-bold text-transparent sm:text-4xl">
          {t('overview.title')}
        </h1>
        <p className="text-muted-foreground">
          {t('overview.subtitle')}
        </p>
      </div>

      {isAdmin ? (
        <>
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4">
            <GlassCard
              className={cn(
                ADMIN_CARD_CLASS,
                'flex min-h-[176px] h-full flex-col justify-between border-transparent bg-[#2F243A] text-white shadow-[0_18px_40px_rgba(47,36,58,0.24)]'
              )}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-2">
                  <p className="text-[13px] text-white/70">{t('overview.totalRevenue')}</p>
                  {isTopLoading ? (
                    <Skeleton className="h-10 w-36 bg-white/10" />
                  ) : (
                    <p className="text-3xl font-semibold text-white">
                      {topStats ? formatCurrency(topStats.totalRevenue, 'EUR') : '—'}
                    </p>
                  )}
                  <p className="text-[13px] text-white/70">
                    {topStats ? `€${topStats.thisMonthRevenue.toFixed(2)} ${t('overview.thisMonth')}` : ' '}
                  </p>
                </div>
                <div className="rounded-[12px] bg-white/10 p-3">
                  <DollarSign className="h-6 w-6 text-white" />
                </div>
              </div>
              {isTopLoading ? (
                <Skeleton className="h-7 w-28 bg-white/10" />
              ) : (
                <div className="inline-flex w-fit items-center gap-1 rounded-full bg-green-500/15 px-3 py-1 text-xs font-semibold text-green-400">
                  {revenueChange >= 0 ? (
                    <TrendingUp className="h-3.5 w-3.5" />
                  ) : (
                    <TrendingDown className="h-3.5 w-3.5 text-red-300" />
                  )}
                  <span>
                    {revenueChange >= 0 ? '+' : ''}
                    {revenueChange.toFixed(1)}%
                  </span>
                </div>
              )}
            </GlassCard>

            <GlassCard className={cn(ADMIN_CARD_CLASS, 'flex min-h-[176px] h-full flex-col justify-between')}>
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-2">
                  <p className={ADMIN_SUBLABEL_CLASS}>{t('overview.totalOrders')}</p>
                  {isTopLoading ? (
                    <Skeleton className="h-10 w-24" />
                  ) : (
                    <p className="text-3xl font-semibold text-[#1A1A2E]">
                      {topStats?.totalOrders.toString() || '—'}
                    </p>
                  )}
                  <p className={ADMIN_SUBLABEL_CLASS}>
                    {topStats ? `${topStats.thisMonthOrders} ${t('overview.thisMonth')}` : ' '}
                  </p>
                </div>
                <div className="rounded-[12px] bg-[rgba(108,99,168,0.12)] p-3">
                  <ShoppingCart className="h-6 w-6 text-[#6C63A8]" />
                </div>
              </div>
              {isTopLoading ? (
                <Skeleton className="h-5 w-24" />
              ) : (
                <div className="flex items-center gap-2 text-sm">
                  {ordersChange >= 0 ? (
                    <TrendingUp className="h-4 w-4 text-green-500" />
                  ) : (
                    <TrendingDown className="h-4 w-4 text-red-500" />
                  )}
                  <span className={ordersChange >= 0 ? 'font-semibold text-green-500' : 'font-semibold text-red-500'}>
                    {ordersChange >= 0 ? '+' : ''}
                    {ordersChange.toFixed(1)}%
                  </span>
                  <span className={ADMIN_SUBLABEL_CLASS}>{t('overview.vsLastMonth')}</span>
                </div>
              )}
            </GlassCard>

            <GlassCard className={cn(ADMIN_CARD_CLASS, 'flex min-h-[176px] h-full flex-col justify-between')}>
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-2">
                  <p className={ADMIN_SUBLABEL_CLASS}>{t('overview.activeCustomers')}</p>
                  {isTopLoading ? (
                    <Skeleton className="h-10 w-24" />
                  ) : (
                    <p className="text-3xl font-semibold text-[#1A1A2E]">
                      {topStats?.activeCustomers.toString() || '—'}
                    </p>
                  )}
                  <p className={ADMIN_SUBLABEL_CLASS}>{t('overview.placedOrders')}</p>
                </div>
                <div className="rounded-[12px] bg-[rgba(108,99,168,0.12)] p-3">
                  <Users className="h-6 w-6 text-[#6C63A8]" />
                </div>
              </div>
            </GlassCard>

            <GlassCard className={cn(ADMIN_CARD_CLASS, 'flex min-h-[176px] h-full flex-col justify-between')}>
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-2">
                  <p className={ADMIN_SUBLABEL_CLASS}>{t('overview.productsInCatalog')}</p>
                  {isTopLoading ? (
                    <Skeleton className="h-10 w-24" />
                  ) : (
                    <p className="text-3xl font-semibold text-[#1A1A2E]">
                      {topStats?.totalProducts.toString() || '—'}
                    </p>
                  )}
                  <p className={ADMIN_SUBLABEL_CLASS}>
                    {topStats && topStats.lowStockCount > 0
                      ? `${topStats.lowStockCount} ${t('overview.lowStock')}`
                      : t('overview.allStocked')}
                  </p>
                </div>
                <div className="rounded-[12px] bg-[rgba(108,99,168,0.12)] p-3">
                  <Package className="h-6 w-6 text-[#6C63A8]" />
                </div>
              </div>
            </GlassCard>
          </div>

          {!isDetailsLoading && stats && stats.processingOrdersCount > 0 && (
            <div
              className="relative flex flex-col gap-3 overflow-hidden rounded-[18px] border border-[#E8E6EF] bg-white px-7 py-4 shadow-[0_10px_24px_rgba(26,26,46,0.05)] sm:flex-row sm:items-center sm:justify-between"
            >
              <span
                aria-hidden="true"
                className="absolute bottom-0 left-4 top-0 w-4 rounded-l-full border-l-4 border-[#6C63A8] border-t-4 border-b-4 border-[#6C63A8]/0"
              />
              <div className="relative flex items-center gap-3 pl-1">
                <span className="h-2.5 w-2.5 rounded-full bg-[#6C63A8]" />
                <p className="text-[15px] font-semibold tracking-[-0.01em]" style={{ color: ADMIN_TEXT }}>
                  {t('overview.processingOrdersAlert', { count: stats.processingOrdersCount })}
                </p>
              </div>
              <button
                onClick={() => navigate(`${withBase('/dashboard/orders')}?filter=processing`)}
                className="relative inline-flex items-center gap-1 text-[15px] font-semibold text-[#6C63A8] transition-colors hover:text-[#5b5492]"
              >
                {t('overview.viewOrders')}
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          )}

          <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1.6fr)_minmax(320px,1fr)]">
            <GlassCard className={cn(ADMIN_CARD_CLASS, 'h-full')}>
              <div className="mb-6 flex items-center justify-between gap-4">
                <div>
                  <h2 className={ADMIN_SECTION_TITLE}>{t('overview.ordersLast30Days')}</h2>
                  <p className={ADMIN_SUBLABEL_CLASS}>{t('overview.recentOrders')}</p>
                </div>
              </div>
              {isDetailsLoading ? (
                <Skeleton className="h-[280px] w-full rounded-[12px]" />
              ) : stats?.ordersByDay && stats.ordersByDay.length > 0 ? (
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={stats.ordersByDay}>
                    <CartesianGrid vertical={false} stroke="#E5E7EB" strokeDasharray="3 3" />
                    <XAxis
                      axisLine={false}
                      dataKey="date"
                      tick={{ fill: ADMIN_SUBLABEL, fontSize: 12 }}
                      tickLine={false}
                    />
                    <YAxis
                      axisLine={false}
                      allowDecimals={false}
                      tick={{ fill: ADMIN_SUBLABEL, fontSize: 12 }}
                      tickLine={false}
                    />
                    <Tooltip
                      cursor={{ fill: '#F5F3FF' }}
                      contentStyle={{
                        backgroundColor: '#FFFFFF',
                        border: 'none',
                        borderRadius: '12px',
                        boxShadow: '0 12px 32px rgba(15, 23, 42, 0.12)',
                      }}
                    />
                    <Bar dataKey="orders" fill="rgba(108, 99, 168, 0.8)" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-[280px] items-center justify-center rounded-[12px] bg-[#FAFAFC] text-sm text-[#6B7280]">
                  {t('overview.noOrdersLast30Days')}
                </div>
              )}
            </GlassCard>

            <GlassCard className={cn(ADMIN_CARD_CLASS, 'h-full')}>
              <div className="mb-6 flex items-start justify-between gap-4">
                <div>
                  <p className={ADMIN_SUBLABEL_CLASS}>{t('overview.unpaidBalancesByCompany')}</p>
                  {companyUnpaidLoading ? (
                    <Skeleton className="mt-3 h-10 w-36" />
                  ) : (
                    <p className="mt-2 text-3xl font-semibold text-[#1A1A2E]">
                      {companyUnpaidData
                        ? formatCurrency(companyUnpaidData.totalUnpaidAmount, 'EUR')
                        : '€0.00'}
                    </p>
                  )}
                  <p className="mt-2 text-[13px] text-[#6B7280]">
                    {companyUnpaidData?.totalOrdersCount || 0}{' '}
                    {companyUnpaidData?.totalOrdersCount === 1 ? t('orders.order') : t('orders.orders')}
                  </p>
                </div>
                <div className="rounded-[12px] bg-[rgba(108,99,168,0.12)] p-3">
                  <CreditCard className="h-6 w-6 text-[#6C63A8]" />
                </div>
              </div>

              {companyUnpaidLoading ? (
                <div className="space-y-3">
                  {Array.from({ length: 4 }).map((_, index) => (
                    <Skeleton key={index} className="h-16 w-full rounded-[12px]" />
                  ))}
                </div>
              ) : topUnpaidCompanies.length > 0 ? (
                <div className="space-y-3">
                  {topUnpaidCompanies.map((company, index) => (
                    <button
                      key={company.email || company.companyName || index}
                      onClick={() =>
                        navigate(
                          `${withBase('/dashboard/orders')}?company=${encodeURIComponent(
                            company.companyName || company.email
                          )}&filter=pending`
                        )
                      }
                      className="flex w-full items-center justify-between rounded-[12px] bg-[#F8F7FC] px-4 py-3 text-left transition-colors hover:bg-[#F3F1FA]"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-[#1A1A2E]">
                          {company.companyName || t('overview.unknownCompany')}
                        </p>
                        <p className="mt-1 text-[13px] text-[#6B7280]">
                          {company.orderCount} {company.orderCount === 1 ? t('orders.order') : t('orders.orders')}
                        </p>
                      </div>
                      <p className="text-sm font-semibold text-[#1A1A2E]">
                        {formatCurrency(company.unpaidAmount, 'EUR')}
                      </p>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="flex h-[280px] items-center justify-center rounded-[12px] bg-[#FAFAFC] text-center text-sm text-[#6B7280]">
                  {t('unpaidBalances.noUnpaidOrders')}
                </div>
              )}

              <div className="mt-6 border-t border-[#ECE8F7] pt-4">
                <button
                  onClick={() => navigate(withBase('/dashboard/unpaid-balances'))}
                  className={ADMIN_LINK_CLASS}
                >
                  {t('overview.viewAll')}
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </GlassCard>
          </div>

          <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
            <GlassCard className={cn(ADMIN_CARD_CLASS, 'h-full')}>
              <div className="mb-6 flex items-center justify-between gap-4">
                <h2 className={ADMIN_SECTION_TITLE}>{t('overview.recentOrders')}</h2>
                <button
                  onClick={() => navigate(withBase('/dashboard/orders'))}
                  className={ADMIN_LINK_CLASS}
                >
                  {t('overview.viewAll')}
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
              {isDetailsLoading ? (
                <div className="space-y-3">
                  {Array.from({ length: 5 }).map((_, index) => (
                    <Skeleton key={index} className="h-14 w-full rounded-[12px]" />
                  ))}
                </div>
              ) : stats?.recentOrders && stats.recentOrders.length > 0 ? (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-[#ECE8F7]">
                        <TableHead className="text-[13px] font-medium text-[#6B7280]">
                          {t('orders.order')}
                        </TableHead>
                        <TableHead className="text-[13px] font-medium text-[#6B7280]">
                          {t('overview.company')}
                        </TableHead>
                        <TableHead className="text-[13px] font-medium text-[#6B7280]">
                          {t('orders.status')}
                        </TableHead>
                        <TableHead className="text-right text-[13px] font-medium text-[#6B7280]">
                          {t('orders.total')}
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {stats.recentOrders.map((order) => (
                        <TableRow key={order.id} className="border-[#F2EFF9]">
                          <TableCell className="py-4 font-mono text-sm font-semibold text-[#1A1A2E]">
                            #{order.order_number || order.id.slice(0, 8)}
                          </TableCell>
                          <TableCell className="py-4">
                            <div>
                              <p className="text-sm font-medium text-[#1A1A2E]">
                                {order.customer_name || order.customer_email}
                              </p>
                              <p className="mt-1 text-[13px] text-[#6B7280]">
                                {new Date(order.created_at).toLocaleDateString('en-US', {
                                  month: 'short',
                                  day: 'numeric',
                                  year: 'numeric',
                                })}
                              </p>
                            </div>
                          </TableCell>
                          <TableCell className="py-4">
                            <OrderStatusBadge
                              status={order.status}
                              className={
                                isProcessingStatus(order.status)
                                  ? 'border-transparent bg-[rgba(108,99,168,0.15)] text-[#6C63A8]'
                                  : undefined
                              }
                            />
                          </TableCell>
                          <TableCell className="py-4 text-right text-sm font-semibold text-[#1A1A2E]">
                            {formatCurrency(order.total, 'EUR')}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="flex h-[320px] items-center justify-center rounded-[12px] bg-[#FAFAFC] text-sm text-[#6B7280]">
                  {t('overview.noRecentOrders')}
                </div>
              )}
            </GlassCard>

            <GlassCard className={cn(ADMIN_CARD_CLASS, 'h-full')}>
              <div className="space-y-8">
                <section>
                  <div className="mb-5 flex items-center justify-between gap-4">
                    <div>
                      <h2 className={ADMIN_SECTION_TITLE}>{t('overview.topCategoriesShort')}</h2>
                      <p className={ADMIN_SUBLABEL_CLASS}>
                        {formatCurrency(totalTopCategoryRevenue, 'EUR')}
                      </p>
                    </div>
                  </div>
                  {isDetailsLoading ? (
                    <div className="space-y-3">
                      {Array.from({ length: 4 }).map((_, index) => (
                        <Skeleton key={index} className="h-16 w-full rounded-[12px]" />
                      ))}
                    </div>
                  ) : topCategories.length > 0 ? (
                    <div className="space-y-4">
                      {topCategories.map((category, index) => {
                        const percentage =
                          totalTopCategoryRevenue > 0
                            ? (category.revenue / totalTopCategoryRevenue) * 100
                            : 0
                        const dotOpacity = 1 - index * 0.18

                        return (
                          <div key={category.name} className="space-y-2">
                            <div className="flex items-center justify-between gap-4">
                              <div className="flex min-w-0 items-center gap-2">
                                <span
                                  className="h-2.5 w-2.5 flex-shrink-0 rounded-full"
                                  style={{ backgroundColor: `rgba(108, 99, 168, ${Math.max(dotOpacity, 0.4)})` }}
                                />
                                <p className="truncate text-sm font-medium text-[#1A1A2E]">
                                  {category.name}
                                </p>
                              </div>
                              <span className="text-sm font-semibold text-[#1A1A2E]">
                                {percentage.toFixed(1)}%
                              </span>
                            </div>
                            <div className="h-2 overflow-hidden rounded-full bg-[#F3F1FA]">
                              <div
                                className="h-full rounded-full"
                                style={{
                                  width: `${percentage}%`,
                                  backgroundColor: `rgba(108, 99, 168, ${Math.max(dotOpacity, 0.55)})`,
                                }}
                              />
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  ) : (
                    <div className="rounded-[12px] bg-[#FAFAFC] px-4 py-12 text-center text-sm text-[#6B7280]">
                      {t('overview.noRevenueDataThisMonth')}
                    </div>
                  )}
                </section>

                <section className="border-t border-[#ECE8F7] pt-8">
                  <h2 className={ADMIN_SECTION_TITLE}>{t('overview.lowStockProducts')}</h2>
                  <div className="mt-5">
                    {isDetailsLoading ? (
                      <div className="space-y-3">
                        {Array.from({ length: 3 }).map((_, index) => (
                          <Skeleton key={index} className="h-16 w-full rounded-[12px]" />
                        ))}
                      </div>
                    ) : lowStockPreview.length > 0 ? (
                      <>
                        <div className="space-y-3">
                          {lowStockPreview.map((product) => (
                            <div
                              key={product.id}
                              className="flex items-center justify-between gap-4 rounded-[12px] bg-[#F8F7FC] px-4 py-3"
                            >
                              <div className="min-w-0">
                                <p className="truncate text-sm font-medium text-[#1A1A2E]">
                                  {product.name}
                                </p>
                                <p className="mt-1 text-[13px] text-[#6B7280]">SKU: {product.sku}</p>
                              </div>
                              <Badge
                                variant="outline"
                                className="border-orange-200 bg-orange-50 text-xs font-medium text-orange-500"
                              >
                                {t('overview.onlyLeft', { count: product.stock })}
                              </Badge>
                            </div>
                          ))}
                        </div>
                        <div className="mt-5 border-t border-[#ECE8F7] pt-4">
                          <button
                            onClick={() => navigate(`${withBase('/dashboard/products')}?filter=low-stock`)}
                            className={ADMIN_LINK_CLASS}
                          >
                            {t('overview.viewAllProducts')}
                            <ArrowRight className="h-4 w-4" />
                          </button>
                        </div>
                      </>
                    ) : (
                      <div className="rounded-[12px] bg-[#FAFAFC] px-4 py-12 text-center text-sm text-[#6B7280]">
                        {t('overview.allProductsSufficientStock')}
                      </div>
                    )}
                  </div>
                </section>
              </div>
            </GlassCard>
          </div>
        </>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <StatCard
              title={t('overview.totalRevenue')}
              value={topStats ? formatCurrency(topStats.totalRevenue, 'EUR') : '—'}
              subtitle={topStats ? `€${topStats.thisMonthRevenue.toFixed(2)} ${t('overview.thisMonth')}` : undefined}
              icon={DollarSign}
              color="text-green-500"
              change={revenueChange}
            />
            <StatCard
              title={t('overview.totalOrders')}
              value={topStats?.totalOrders.toString() || '—'}
              subtitle={topStats ? `${topStats.thisMonthOrders} ${t('overview.thisMonth')}` : undefined}
              icon={ShoppingCart}
              color="text-blue-500"
              change={ordersChange}
            />

            <GlassCard hover className="relative overflow-hidden">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <p className="text-sm text-muted-foreground mb-1">{t('overview.unpaidBalance')}</p>
                  {isTopLoading || unpaidLoading ? (
                    <Skeleton className="h-10 w-32 mb-2" />
                  ) : (
                    <p className="text-3xl font-bold mb-1">
                      {unpaidData ? formatCurrency(unpaidData.unpaidBalance, 'EUR') : '€0.00'}
                    </p>
                  )}
                  <p className="text-sm text-muted-foreground mb-2">
                    {unpaidData?.unpaidOrdersCount === 1
                      ? `1 ${t('overview.orderAwaitingPayment')}`
                      : `${unpaidData?.unpaidOrdersCount || 0} ${t('overview.ordersAwaitingPayment')}`}
                  </p>
                  {unpaidData && unpaidData.unpaidOrdersCount > 0 && (
                    <button
                      onClick={() => navigate(`${withBase('/dashboard/orders')}?filter=pending`)}
                      className="text-xs text-primary hover:underline flex items-center gap-1 mt-1"
                    >
                      {t('overview.viewPendingOrders')}
                      <ArrowRight className="w-3 h-3" />
                    </button>
                  )}
                </div>
                <div className="p-3 rounded-lg bg-white/10 dark:bg-black/10">
                  <CreditCard
                    className={`w-6 h-6 ${
                      unpaidData && unpaidData.unpaidBalance > 0 ? 'text-amber-500' : 'text-green-500'
                    }`}
                  />
                </div>
              </div>
            </GlassCard>

            <StatCard
              title={t('overview.productsInCatalog')}
              value={topStats?.totalProducts.toString() || '—'}
              subtitle={
                topStats && topStats.lowStockCount > 0
                  ? `${topStats.lowStockCount} ${t('overview.lowStock')}`
                  : t('overview.allStocked')
              }
              icon={Package}
              color={topStats && topStats.lowStockCount > 0 ? 'text-red-500' : 'text-amber-500'}
            />
          </div>

          <Suspense
            fallback={
              <div className="space-y-6">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <GlassCard><Skeleton className="h-64 w-full" /></GlassCard>
                  <GlassCard><Skeleton className="h-64 w-full" /></GlassCard>
                </div>
                <GlassCard className="p-6"><Skeleton className="h-96 w-full rounded-lg" /></GlassCard>
              </div>
            }
          >
            <OverviewChartsSection stats={stats} isLoading={isDetailsLoading} />
          </Suspense>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <GlassCard className="border border-white/10 dark:border-white/5">
              <div className="flex items-center justify-between mb-5 pb-4 border-b border-white/10 dark:border-white/5">
                <h2 className="text-xl font-semibold">{t('overview.recentOrders')}</h2>
                <button
                  onClick={() => navigate(withBase('/dashboard/orders'))}
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1.5 px-2 py-1 rounded-md hover:bg-white/5 dark:hover:bg-black/5"
                >
                  {t('overview.viewAll')}
                  <ArrowRight className="w-3 h-3" />
                </button>
              </div>
              {isLoading ? (
                <div className="space-y-2.5">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className="h-14 w-full rounded-lg" />
                  ))}
                </div>
              ) : stats?.recentOrders && stats.recentOrders.length > 0 ? (
                <div className="space-y-2.5">
                  {stats.recentOrders.map((order) => (
                    <div
                      key={order.id}
                      className="flex flex-col gap-2 rounded-lg border border-white/10 bg-white/5 p-3.5 shadow-sm transition-all duration-200 hover:border-white/20 hover:bg-white/10 hover:shadow-md sm:flex-row sm:items-center sm:justify-between dark:border-white/5 dark:bg-black/5 dark:hover:border-white/10 dark:hover:bg-black/10"
                    >
                      <div className="flex items-center gap-4 flex-1 min-w-0">
                        <div className="flex-shrink-0">
                          <span className="font-mono font-semibold text-sm text-foreground">
                            #{order.order_number || order.id.slice(0, 8)}
                          </span>
                        </div>
                        <div className="flex-shrink-0 text-xs text-muted-foreground font-medium">
                          {new Date(order.created_at).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                          })}
                        </div>
                        <div className="flex-1 min-w-0 truncate">
                          <p className="text-sm font-medium truncate text-foreground">
                            {order.customer_name || order.customer_email}
                          </p>
                        </div>
                        <div className="flex-shrink-0">
                          <OrderStatusBadge status={order.status} />
                        </div>
                      </div>
                      <div className="flex-shrink-0 text-left sm:ml-4 sm:text-right">
                        <p className="font-semibold text-sm text-foreground">
                          {formatCurrency(order.total, 'EUR')}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 text-muted-foreground border border-dashed border-white/10 dark:border-white/5 rounded-lg">
                  <p className="text-sm">{t('overview.noRecentOrders')}</p>
                </div>
              )}
            </GlassCard>

            <GlassCard className="border border-white/10 dark:border-white/5">
              <div className="mb-5 pb-4 border-b border-white/10 dark:border-white/5">
                <h2 className="text-xl font-semibold">{t('overview.lowStockProducts')}</h2>
              </div>
              {isLoading ? (
                <div className="space-y-2.5">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <Skeleton key={i} className="h-14 w-full rounded-lg" />
                  ))}
                </div>
              ) : stats && stats.lowStockCount > 0 ? (
                <>
                  <p className="text-base font-semibold text-foreground mb-5 px-1">
                    {t('overview.productsLowOnStock', { count: stats.lowStockCount })}
                  </p>
                  <div className="space-y-2.5 mb-5">
                    {stats.lowStockProducts
                      .sort((a, b) => a.stock - b.stock)
                      .slice(0, 5)
                      .map((product) => (
                        <div
                          key={product.id}
                          className="flex items-center justify-between gap-4 rounded-lg border border-white/10 bg-white/5 p-3.5 shadow-sm transition-all duration-200 hover:border-white/20 hover:bg-white/10 hover:shadow-md dark:border-white/5 dark:bg-black/5 dark:hover:border-white/10 dark:hover:bg-black/10"
                        >
                          <div className="min-w-0">
                            <p className="font-semibold text-sm truncate text-foreground mb-0.5">
                              {product.name}
                            </p>
                            <p className="text-xs text-muted-foreground font-medium">SKU: {product.sku}</p>
                          </div>
                          <Badge
                            variant="outline"
                            className="bg-orange-500/10 text-orange-700 dark:text-orange-400 border-orange-500/30 text-xs font-medium shadow-sm"
                          >
                            {t('overview.onlyLeft', { count: product.stock })}
                          </Badge>
                        </div>
                      ))}
                  </div>
                  <div className="flex justify-end pt-3 border-t border-white/10 dark:border-white/5">
                    <button
                      onClick={() => navigate(`${withBase('/dashboard/products')}?filter=low-stock`)}
                      className="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1.5 px-2 py-1 rounded-md hover:bg-white/5 dark:hover:bg-black/5"
                    >
                      {t('overview.viewAllProducts')}
                      <ArrowRight className="w-3 h-3" />
                    </button>
                  </div>
                </>
              ) : (
                <div className="flex items-center justify-center gap-2.5 py-12 text-muted-foreground border border-dashed border-white/10 dark:border-white/5 rounded-lg bg-white/5 dark:bg-black/5">
                  <Package className="w-4 h-4" />
                  <p className="text-sm font-medium">{t('overview.allProductsSufficientStock')}</p>
                </div>
              )}
            </GlassCard>
          </div>
        </>
      )}

    </div>
  )
}
