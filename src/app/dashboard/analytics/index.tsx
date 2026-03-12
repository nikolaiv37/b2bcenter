// This is the page owners open every morning with their coffee ☕
import { useState, useMemo } from 'react'
import { useAppContext } from '@/lib/app/AppContext'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase/client'
import { GlassCard } from '@/components/GlassCard'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
} from 'recharts'
import { useAuth } from '@/hooks/useAuth'
import { formatCurrency, calculatePercentageChange } from '@/lib/utils'
import { OrderStatusBadge } from '@/components/OrderStatusBadge'
import {
  DollarSign,
  ShoppingCart,
  TrendingUp,
  TrendingDown,
  Package,
  BarChart3,
  AlertTriangle,
  FileText,
  CheckCircle,
  Send,
} from 'lucide-react'

type DateRange = 'last30' | 'last90' | 'alltime'

interface AnalyticsData {
  // Metrics
  totalRevenue: number
  totalRevenueMoM: number // Month-over-month % change
  totalOrders: number
  averageOrderValue: number
  quotesToOrdersConversion: number // Last 30 days conversion rate (admin only)
  
  // Charts
  revenueOverTime: Array<{ month: string; revenue: number }>
  
  // Top Products
  topProducts: Array<{
    sku: string
    name: string
    revenue: number
    quantity: number
  }>
  
  // Top Customers (admin only)
  topCustomers: Array<{
    companyName: string
    totalSpent: number
    ordersCount: number
    lastOrderDate: string
  }>
  
  // Low Stock
  lowStockProducts: Array<{
    id: string
    sku: string
    name: string
    stock: number
  }>
  
  // Quote Funnel (last 30 days, admin only)
  quoteFunnel: {
    draft: number
    sent: number
    accepted: number
    ordered: number
  }
  
  // Company user specific data
  myQuotesStatus?: {
    pending: number
    approved: number
    rejected: number
    expired: number
  }
  myRecentQuotes?: Array<{
    id: string
    order_number?: number
    total: number
    status: string
    created_at: string
  }>
  myOrderStatus?: {
    pending: number
    approved: number
    processing: number
    shipped: number
    delivered: number
  }
  myPendingQuotesCount?: number
}

interface QuoteRow {
  id?: string | number | null
  quote_id?: string | number | null
  company_id?: string | null
  customer_id?: string | null
  customer_email?: string | null
  customer_name?: string | null
  user_id?: string | null
  company_name?: string | null
  email?: string | null
  items?: unknown
  subtotal?: string | number | null
  tax?: string | number | null
  shipping?: string | number | null
  total?: string | number | null
  status?: string | null
  payment_status?: string | null
  created_at?: string
  updated_at?: string | null
}

interface QuoteItemRow {
  sku?: string | null
  product_name?: string | null
  name?: string | null
  unit_price?: string | number | null
  quantity?: string | number | null
  total?: string | number | null
}

interface ProductRow {
  id?: string | number | null
  sku?: string | null
  name?: string | null
  quantity?: string | number | null
}

interface AnalyticsOrderRow {
  id?: string | number | null
  quote_id?: string | number | null
  company_id?: string | null
  customer_id?: string | null
  customer_email?: string | null
  customer_name?: string | null
  user_id?: string | null
  items?: unknown
  subtotal?: string | number | null
  tax?: string | number | null
  shipping?: string | number | null
  total?: string | number | null
  status?: string | null
  payment_status?: string | null
  created_at?: string
  updated_at?: string | null
}

export function AnalyticsPage() {
  const { t } = useTranslation()
  const { user, profile, isAdmin } = useAuth()
  const { workspaceId: tenantId } = useAppContext()
  const [dateRange, setDateRange] = useState<DateRange>('alltime')

  // Calculate date range
  const dateRangeConfig = useMemo(() => {
    const now = new Date()
    let startDate: Date | null = null

    switch (dateRange) {
      case 'last30':
        startDate = new Date(now)
        startDate.setDate(startDate.getDate() - 30)
        break
      case 'last90':
        startDate = new Date(now)
        startDate.setDate(startDate.getDate() - 90)
        break
      case 'alltime':
        startDate = null // No filter
        break
    }

    return {
      start: startDate?.toISOString() || null,
      end: now.toISOString(),
    }
  }, [dateRange])

  // Get company ID from profile or fetch it
  const companyId = useMemo(() => {
    // Try to get company_id from profile
    const profileCompanyId = profile?.company_id ?? null
    if (profileCompanyId) {
      return profileCompanyId
    }
    // For admin, we might not need company_id (they see all data)
    if (isAdmin) {
      return null
    }
    // If no company_id, we'll use user.id and rely on RLS
    return user?.id || null
  }, [profile, user, isAdmin])

  // Fetch all analytics data in parallel
  const { data: analytics, isLoading, error } = useQuery({
    queryKey: ['workspace', 'analytics', companyId, dateRange, user?.id],
    queryFn: async (): Promise<AnalyticsData> => {
      try {
        if (!tenantId) {
          return {
            totalRevenue: 0,
            totalRevenueMoM: 0,
            totalOrders: 0,
            averageOrderValue: 0,
            quotesToOrdersConversion: 0,
            revenueOverTime: [],
            topProducts: [],
            topCustomers: [],
            lowStockProducts: [],
            quoteFunnel: { draft: 0, sent: 0, accepted: 0, ordered: 0 },
          }
        }
        // For admin or if no company_id, we'll fetch all data (RLS will handle filtering)
        if (!user?.id && !isAdmin) {
          return {
            totalRevenue: 0,
            totalRevenueMoM: 0,
            totalOrders: 0,
            averageOrderValue: 0,
            quotesToOrdersConversion: 0,
            revenueOverTime: [],
            topProducts: [],
            topCustomers: [],
            lowStockProducts: [],
            quoteFunnel: { draft: 0, sent: 0, accepted: 0, ordered: 0 },
          }
        }

        const { start, end } = dateRangeConfig

      // Fetch from quotes table (this is the primary source - orders table doesn't exist)
      // Skip orders table query since it doesn't exist in this database
      const ordersTableData: AnalyticsOrderRow[] = []
      
      // Also fetch from quotes table (this is the primary source in Eastern Europe B2B style)
      // For company users, quotes table uses user_id. For admin, show all.
      let quotesQuery = supabase
        .from('quotes')
        .select('id, customer_name, user_id, company_name, email, items, subtotal, tax, shipping, total, status, created_at, updated_at')
        .eq('tenant_id', tenantId)

      // For company users, filter by user_id (TEXT field). For admin, show all quotes.
      if (!isAdmin && user?.id) {
        quotesQuery = quotesQuery.eq('user_id', user.id.toString())
      }

      if (start) {
        quotesQuery = quotesQuery.gte('created_at', start)
      }
      quotesQuery = quotesQuery.lte('created_at', end)

      const { data: quotesTableData, error: quotesError } = await quotesQuery.order('created_at', { ascending: false })
      
      // Filter quotes - already filtered by user_id for company users, so use as-is
      const filteredQuotes = quotesTableData || []
      

      // Combine orders and quotes, treating approved quotes as paid orders
      const allOrdersFromTable = ordersTableData || []
      const allQuotesFromTable = filteredQuotes || []

        // Transform quotes to orders format for analytics
      const quotesAsOrders = (allQuotesFromTable || []).map((q: QuoteRow): AnalyticsOrderRow => ({
        id: q.id ?? null,
        quote_id: q.id ?? null,
        company_id: companyId || null,
        customer_id: q.user_id || '',
        customer_email: q.email || '',
        customer_name: q.customer_name || q.company_name || '',
        items: q.items || [],
        subtotal: parseFloat(String(q.subtotal || q.total || 0)),
        tax: parseFloat(String(q.tax || 0)),
        shipping: parseFloat(String(q.shipping || 0)),
        total: parseFloat(String(q.total || 0)),
        status: q.status === 'approved' ? 'paid' : 'pending',
        payment_status: q.status === 'approved' ? 'paid' : 'pending',
        created_at: q.created_at,
        updated_at: q.updated_at || q.created_at,
      }))

      // Combine both sources, prioritizing orders table data
      const allOrdersCombined = [...allOrdersFromTable, ...quotesAsOrders]
      
      // Remove duplicates (if a quote was converted to an order, prefer the order)
      const uniqueOrders = new Map<string | number, AnalyticsOrderRow>()
      allOrdersCombined.forEach((o) => {
        const key = o.quote_id ?? o.id
        if (key === null || key === undefined) return
        if (!uniqueOrders.has(key) || o.payment_status === 'paid' || o.status === 'paid') {
          uniqueOrders.set(key, o)
        }
      })
      const allOrders = Array.from(uniqueOrders.values())
      
      // Filter for paid orders (either payment_status='paid' or status='paid' or approved quotes)
      const ordersData = allOrders.filter(
        (o) => o.payment_status === 'paid' || o.status === 'paid' || o.status === 'approved'
      )

      // Quotes for funnel (last 30 days)
      const thirtyDaysAgo = new Date()
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
      const quotesData = ((filteredQuotes as QuoteRow[] | null) || []).filter((quote) => {
        const createdAt = quote?.created_at ? new Date(quote.created_at) : null
        return createdAt ? createdAt >= thirtyDaysAgo : false
      })

      // Fetch products for low stock (quantity < 10)
      // Products table uses 'quantity' not 'stock'
      // In this B2B model, company users (buyers) don't own products - they order from supplier
      // So show all low stock products for both admin and company users
      const productsQuery = supabase
        .from('products')
        .select('id, sku, name, quantity')
        .lt('quantity', 10)
        .eq('tenant_id', tenantId)
        .order('quantity', { ascending: true })
        .limit(10)
      
      // No filter needed - show all low stock products for everyone
      // (Company users need to see what's available/low stock to order)
      
      const { data: productsData, error: productsError } = await productsQuery
      
      const finalProductsData = (productsData as ProductRow[] | null) || []

      // Log errors for debugging (but don't fail the whole query)
      // These are expected - orders table doesn't exist, products might not have stock column
      // ordersError is always null (orders table doesn't exist), so skip this check
      if (quotesError) {
        console.warn('Error fetching quotes:', quotesError)
      }
      if (productsError) {
        console.warn('Error fetching products (might be column name issue):', productsError?.message || String(productsError))
      }

      // Calculate metrics
      const orders = ordersData || []
      const quotes = quotesData || []

      // Total Revenue (all time for this calculation)
      const totalRevenue = orders.reduce((sum, o) => sum + parseFloat(String(o.total || 0)), 0)

      // Month-over-month revenue change
      const now = new Date()
      const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1)
      const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1)
      const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0)

      const thisMonthRevenue = orders
        .filter((o) => new Date(o.created_at ?? 0) >= thisMonthStart)
        .reduce((sum, o) => sum + parseFloat(String(o.total || 0)), 0)

      const lastMonthRevenue = orders
        .filter(
          (o) =>
            new Date(o.created_at ?? 0) >= lastMonthStart &&
            new Date(o.created_at ?? 0) <= lastMonthEnd
        )
        .reduce((sum, o) => sum + parseFloat(String(o.total || 0)), 0)

      const totalRevenueMoM = calculatePercentageChange(thisMonthRevenue, lastMonthRevenue)

      // Total Orders
      const totalOrders = allOrders.length

      // Average Order Value
      const averageOrderValue = orders.length > 0 ? totalRevenue / orders.length : 0

      // Quotes → Orders conversion rate (last 30 days)
      const quotesLast30 = quotes || []
      // Count orders that came from quotes (have quote_id) or are approved quotes
      const ordersFromQuotesLast30 = allOrders.filter(
        (o) => {
          const orderDate = new Date(o.created_at ?? 0)
          return (
            orderDate >= thirtyDaysAgo &&
            (o.quote_id || (o.status === 'approved' && quotesLast30.some((q) => q.id === o.id || q.id === o.quote_id)))
          )
        }
      ).length
      const quotesToOrdersConversion =
        quotesLast30.length > 0
          ? (ordersFromQuotesLast30 / quotesLast30.length) * 100
          : 0

      // Revenue over time (monthly, last 12 months or all data)
      const revenueByMonth = new Map<string, number>()
      const monthsToShow = 12
      const cutoffDate = new Date()
      cutoffDate.setMonth(cutoffDate.getMonth() - monthsToShow)

      orders.forEach((order) => {
        const orderDate = new Date(order.created_at ?? 0)
        if (orderDate >= cutoffDate || dateRange === 'alltime') {
          const monthKey = `${orderDate.getFullYear()}-${String(orderDate.getMonth() + 1).padStart(2, '0')}`
          revenueByMonth.set(
            monthKey,
            (revenueByMonth.get(monthKey) || 0) + parseFloat(String(order.total || 0))
          )
        }
      })

      const revenueOverTime = Array.from(revenueByMonth.entries())
        .map(([monthKey, revenue]) => {
          const [year, month] = monthKey.split('-')
          const date = new Date(parseInt(year), parseInt(month) - 1)
          return {
            month: date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
            revenue,
          }
        })
        .sort((a, b) => {
          const dateA = new Date(a.month)
          const dateB = new Date(b.month)
          return dateA.getTime() - dateB.getTime()
        })

      // Top 10 Products by revenue
      const productRevenue = new Map<
        string,
        { sku: string; name: string; revenue: number; quantity: number }
      >()

      orders.forEach((order) => {
        const items = Array.isArray(order.items) ? (order.items as QuoteItemRow[]) : []
        if (Array.isArray(items)) {
          items.forEach((item) => {
            const sku = item.sku || 'UNKNOWN'
            const existing = productRevenue.get(sku)
            const revenue = parseFloat(
              String(item.total || Number(item.unit_price ?? 0) * Number(item.quantity ?? 0) || 0)
            )
            const quantity = parseInt(String(item.quantity || 0))

            if (existing) {
              existing.revenue += revenue
              existing.quantity += quantity
            } else {
              productRevenue.set(sku, {
                sku,
                name: item.product_name || item.name || sku,
                revenue,
                quantity,
              })
            }
          })
        }
      })

      const topProducts = Array.from(productRevenue.values())
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 10)

      // Top 10 Customers by revenue
      const customerRevenue = new Map<
        string,
        { companyName: string; totalSpent: number; ordersCount: number; lastOrderDate: string }
      >()

      orders.forEach((order) => {
        const customerKey = order.customer_email || 'unknown'
        const companyName = order.customer_name || 'Unknown Company'
        const existing = customerRevenue.get(customerKey)
        const revenue = parseFloat(String(order.total || 0))
        const orderDate = order.created_at || ''

        if (existing) {
          existing.totalSpent += revenue
          existing.ordersCount += 1
          if (new Date(orderDate) > new Date(existing.lastOrderDate)) {
            existing.lastOrderDate = orderDate
          }
        } else {
          customerRevenue.set(customerKey, {
            companyName,
            totalSpent: revenue,
            ordersCount: 1,
            lastOrderDate: orderDate,
          })
        }
      })

      const topCustomers = Array.from(customerRevenue.values())
        .sort((a, b) => b.totalSpent - a.totalSpent)
        .slice(0, 10)
        .map((customer, index) => ({
          ...customer,
          rank: index + 1,
        }))

      // Low stock products (use quantity field)
      const lowStockProducts = (finalProductsData || []).map((p) => ({
        id: String(p.id ?? ''),
        sku: String(p.sku ?? ''),
        name: String(p.name ?? ''),
        stock: Number(p.quantity ?? 0),
      }))

      // Quote funnel (last 30 days) - Admin only
      const quoteFunnel = {
        draft: quotesLast30.length,
        sent: quotesLast30.filter((q) => q.status === 'pending' || q.status === 'new').length,
        accepted: quotesLast30.filter((q) => q.status === 'approved').length,
        ordered: allOrders.filter(
          (o) => {
            const orderDate = new Date(o.created_at ?? 0)
            return (
              orderDate >= thirtyDaysAgo &&
              (o.quote_id || (o.status === 'approved' && quotesLast30.some((q) => q.id === o.id || q.id === o.quote_id)))
            )
          }
        ).length,
      }

      // Company user specific data
      let myQuotesStatus, myRecentQuotes, myOrderStatus, myPendingQuotesCount
      
      if (!isAdmin && user?.id) {
        // Fetch user's own quotes (which are orders in this system)
        const { data: myQuotes } = await supabase
          .from('quotes')
          .select('id, order_number, total, status, created_at')
          .eq('user_id', user.id.toString())
          .eq('tenant_id', tenantId)
          .order('created_at', { ascending: false })
          .limit(20)

        const myQuotesList = myQuotes || []
        
        // Quote status breakdown (these are actually orders)
        myQuotesStatus = {
          pending: myQuotesList.filter((q) => q.status === 'pending' || q.status === 'new').length,
          approved: myQuotesList.filter((q) => q.status === 'approved').length,
          rejected: myQuotesList.filter((q) => q.status === 'rejected').length,
          expired: myQuotesList.filter((q) => q.status === 'expired').length,
        }
        
        // Recent orders (from quotes table)
        myRecentQuotes = myQuotesList.slice(0, 5).map((q) => ({
          id: String(q.id ?? ''),
          order_number:
            q.order_number ??
            (typeof q.id === 'number' ? q.id : parseInt(String(q.id ?? ''), 10) || undefined),
          total: parseFloat(String(q.total || 0)),
          status: q.status || '',
          created_at: q.created_at || '',
        }))
        
        // Pending quotes count
        myPendingQuotesCount = myQuotesStatus.pending
        
        // Order status breakdown (from user's orders/quotes)
        const myOrdersList = allOrders.filter((o) => {
          // Match by user_id or customer_id
          return o.customer_id === user.id || o.user_id === user.id
        })
        
        myOrderStatus = {
          pending: myOrdersList.filter((o) => o.status === 'pending').length,
          approved: myOrdersList.filter((o) => o.status === 'approved' || o.status === 'paid').length,
          processing: myOrdersList.filter((o) => o.status === 'processing').length,
          shipped: myOrdersList.filter((o) => o.status === 'shipped').length,
          delivered: myOrdersList.filter((o) => o.status === 'delivered').length,
        }
      }

      const result = {
        totalRevenue,
        totalRevenueMoM,
        totalOrders,
        averageOrderValue,
        quotesToOrdersConversion,
        revenueOverTime,
        topProducts,
        topCustomers,
        lowStockProducts,
        quoteFunnel,
        myQuotesStatus,
        myRecentQuotes,
        myOrderStatus,
        myPendingQuotesCount,
      }

        return result
      } catch (err) {
        console.error('Error in analytics query:', err)
        // Return empty analytics data structure on error
        return {
          totalRevenue: 0,
          totalRevenueMoM: 0,
          totalOrders: 0,
          averageOrderValue: 0,
          quotesToOrdersConversion: 0,
          revenueOverTime: [],
          topProducts: [],
          topCustomers: [],
          lowStockProducts: [],
          quoteFunnel: { draft: 0, sent: 0, accepted: 0, ordered: 0 },
        }
      }
    },
    enabled: !!tenantId && (!!user?.id || isAdmin),
    retry: 1,
    staleTime: 2 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  })

  // Always show dashboard - use empty data if analytics is null
  // This must be BEFORE any conditional returns to follow React hooks rules
  const displayData = useMemo<AnalyticsData>(
    () =>
      analytics || {
        totalRevenue: 0,
        totalRevenueMoM: 0,
        totalOrders: 0,
        averageOrderValue: 0,
        quotesToOrdersConversion: 0,
        revenueOverTime: [],
        topProducts: [],
        topCustomers: [],
        lowStockProducts: [],
        quoteFunnel: { draft: 0, sent: 0, accepted: 0, ordered: 0 },
        myQuotesStatus: undefined,
        myRecentQuotes: undefined,
        myOrderStatus: undefined,
        myPendingQuotesCount: undefined,
      },
    [analytics]
  )

  // Generate sparkline data for metric cards (last 7 data points)
  // This must be BEFORE any conditional returns to follow React hooks rules
  const sparklineData = useMemo(() => {
    if (!displayData?.revenueOverTime) return []
    return displayData.revenueOverTime.slice(-7).map((d) => d.revenue)
  }, [displayData])

  if (isLoading) {
    return (
      <div className="space-y-6 p-6">
        <div className="flex items-center justify-between">
          <div>
            <Skeleton className="h-9 w-64 mb-2" />
            <Skeleton className="h-5 w-48" />
          </div>
          <Skeleton className="h-10 w-40" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <GlassCard key={i} className="p-6">
              <Skeleton className="h-12 w-12 mb-4 rounded-lg" />
              <Skeleton className="h-6 w-32 mb-2" />
              <Skeleton className="h-8 w-24" />
            </GlassCard>
          ))}
        </div>
      </div>
    )
  }

  if (error) {
    console.error('Analytics error:', error)
    return (
      <div className="p-6">
        <GlassCard className="p-12">
          <div className="text-center">
            <BarChart3 className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-xl font-semibold mb-2">{t('analytics.errorLoading')}</h3>
            <p className="text-muted-foreground mb-6">
              {error instanceof Error ? error.message : t('analytics.failedToLoad')}
            </p>
            <Button onClick={() => window.location.reload()}>{t('analytics.refresh')}</Button>
          </div>
        </GlassCard>
      </div>
    )
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold mb-2">{t('analytics.title')}</h1>
          <p className="text-muted-foreground">
            {t('analytics.subtitle')}
          </p>
        </div>
        <Select value={dateRange} onValueChange={(v) => setDateRange(v as DateRange)}>
          <SelectTrigger className="w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="last30">{t('analytics.last30Days')}</SelectItem>
            <SelectItem value="last90">{t('analytics.last90Days')}</SelectItem>
            <SelectItem value="alltime">{t('analytics.allTime')}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Top Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Revenue */}
        <GlassCard className="p-6 bg-white/80 backdrop-blur border-border/50">
          <div className="flex items-start justify-between mb-4">
            <div className="p-3 bg-blue-500/10 rounded-lg">
              <DollarSign className="w-5 h-5 text-blue-500" />
            </div>
            {sparklineData.length > 1 && (
              <div className="w-20 h-10 opacity-70">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={sparklineData.map((v, i) => ({ value: v, index: i }))}
                    margin={{ top: 2, right: 2, bottom: 2, left: 2 }}
                  >
                    <Line
                      type="monotone"
                      dataKey="value"
                      stroke="#3b82f6"
                      strokeWidth={2}
                      dot={false}
                      isAnimationActive={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">{t('analytics.totalRevenue')}</p>
            <p className="text-2xl font-bold">{formatCurrency(displayData.totalRevenue)}</p>
            <div className="flex items-center gap-1 text-xs">
              {displayData.totalRevenueMoM >= 0 ? (
                <TrendingUp className="w-3 h-3 text-green-500" />
              ) : (
                <TrendingDown className="w-3 h-3 text-red-500" />
              )}
              <span
                className={displayData.totalRevenueMoM >= 0 ? 'text-green-500' : 'text-red-500'}
              >
                {t('analytics.monthOverMonth', { value: Math.abs(displayData.totalRevenueMoM).toFixed(1) })}
              </span>
            </div>
          </div>
        </GlassCard>

        {/* Total Orders */}
        <GlassCard className="p-6 bg-white/80 backdrop-blur border-border/50">
          <div className="flex items-start justify-between mb-4">
            <div className="p-3 bg-purple-500/10 rounded-lg">
              <ShoppingCart className="w-5 h-5 text-purple-500" />
            </div>
          </div>
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">{t('analytics.totalOrders')}</p>
            <p className="text-2xl font-bold">{displayData.totalOrders}</p>
          </div>
        </GlassCard>

        {/* Average Order Value */}
        <GlassCard className="p-6 bg-white/80 backdrop-blur border-border/50">
          <div className="flex items-start justify-between mb-4">
            <div className="p-3 bg-green-500/10 rounded-lg">
              <TrendingUp className="w-5 h-5 text-green-500" />
            </div>
          </div>
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">{t('analytics.averageOrderValue')}</p>
            <p className="text-2xl font-bold">{formatCurrency(displayData.averageOrderValue)}</p>
          </div>
        </GlassCard>

        {/* Quotes → Orders Conversion (Admin only) */}
        {isAdmin && (
          <GlassCard className="p-6 bg-white/80 backdrop-blur border-border/50">
            <div className="flex items-start justify-between mb-4">
              <div className="p-3 bg-orange-500/10 rounded-lg">
                <FileText className="w-5 h-5 text-orange-500" />
              </div>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">{t('analytics.quotesToOrders')}</p>
              <p className="text-2xl font-bold">
                {displayData.quotesToOrdersConversion.toFixed(1)}%
              </p>
              <p className="text-xs text-muted-foreground">{t('analytics.last30Days')}</p>
            </div>
          </GlassCard>
        )}

        {/* Pending Quotes (Company users only) */}
        {!isAdmin && displayData.myPendingQuotesCount !== undefined && (
          <GlassCard className="p-6 bg-white/80 backdrop-blur border-border/50">
            <div className="flex items-start justify-between mb-4">
              <div className="p-3 bg-orange-500/10 rounded-lg">
                <FileText className="w-5 h-5 text-orange-500" />
              </div>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">{t('analytics.pendingQuotes')}</p>
              <p className="text-2xl font-bold">{displayData.myPendingQuotesCount}</p>
              <p className="text-xs text-muted-foreground">{t('analytics.awaitingApproval')}</p>
            </div>
          </GlassCard>
        )}
      </div>

      {/* Revenue Over Time */}
      <GlassCard className="p-6 bg-white/80 backdrop-blur border-border/50">
        <h3 className="text-lg font-semibold mb-4">{t('analytics.revenueOverTime')}</h3>
        {displayData.revenueOverTime.length > 0 ? (
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={displayData.revenueOverTime}>
              <defs>
                <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-gray-700" />
              <XAxis
                dataKey="month"
                className="text-xs"
                stroke="currentColor"
                tick={{ fill: 'currentColor' }}
              />
              <YAxis
                className="text-xs"
                stroke="currentColor"
                tick={{ fill: 'currentColor' }}
                tickFormatter={(value) => `€${(value / 1000).toFixed(0)}k`}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'hsl(var(--background))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                }}
                formatter={(value: number) => [formatCurrency(value), 'Revenue']}
              />
              <Area
                type="monotone"
                dataKey="revenue"
                stroke="#3b82f6"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#colorRevenue)"
              />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-[300px] flex items-center justify-center text-muted-foreground">
            {t('analytics.noRevenueData')}
          </div>
        )}
      </GlassCard>

      {/* Top 10 Products by Revenue - Modern Redesign */}
      <GlassCard className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-2xl font-bold mb-1">{t('analytics.top10Products')}</h3>
            <p className="text-sm text-muted-foreground">
              Best performing products by revenue
            </p>
          </div>
          <div className="hidden md:flex items-center gap-2.5 px-4 py-2.5 rounded-xl bg-gradient-to-br from-white/90 via-gray-50/80 to-white/70 dark:from-gray-800/90 dark:via-gray-700/80 dark:to-gray-800/70 border border-gray-200/60 dark:border-gray-600/40 backdrop-blur-md shadow-md">
            <div className="p-1.5 rounded-lg bg-gradient-to-br from-gray-100 to-gray-50 dark:from-gray-700 dark:to-gray-600 border border-gray-200/50 dark:border-gray-600/50">
              <Package className="w-4 h-4 text-gray-700 dark:text-gray-300" />
            </div>
            <span className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
              {displayData.topProducts.length} {displayData.topProducts.length === 1 ? 'product' : 'products'}
            </span>
          </div>
        </div>
        {displayData.topProducts.length > 0 ? (
          <div className="space-y-3">
            {displayData.topProducts.map((product, index) => {
              const maxRevenue = Math.max(...displayData.topProducts.map(p => p.revenue))
              const percentage = (product.revenue / maxRevenue) * 100
              const colors = [
                'hsl(var(--primary))',
                '#8b5cf6',
                '#ec4899',
                '#f59e0b',
                '#10b981',
                '#3b82f6',
              ]
              const color = colors[index % colors.length]
              
              return (
                <div
                  key={product.sku}
                  className="group relative p-5 rounded-2xl border border-border/30 bg-background/40 hover:bg-background/70 hover:border-border/60 transition-all duration-200"
                >
                  <div className="flex items-start gap-4">
                    {/* Rank Badge */}
                    <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-gradient-to-br from-muted/60 to-muted/40 dark:from-muted/40 dark:to-muted/30 flex items-center justify-center border border-border/40 shadow-sm">
                      <span className="text-sm font-bold text-foreground">#{index + 1}</span>
                    </div>
                    
                    {/* Product Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-4 mb-3">
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-base text-foreground leading-tight mb-1.5">
                            {product.name}
                          </p>
                          <p className="text-xs text-muted-foreground/70 font-mono mb-2">
                            {product.sku}
                          </p>
                        </div>
                        <div className="flex flex-col items-end gap-2 flex-shrink-0">
                          <p className="text-lg font-bold text-foreground">
                            {formatCurrency(product.revenue, 'EUR')}
                          </p>
                          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-gradient-to-r from-emerald-500/15 via-teal-500/10 to-cyan-500/15 border border-emerald-400/30 backdrop-blur-sm shadow-sm">
                            <div className="p-1 rounded-md bg-emerald-500/20">
                              <ShoppingCart className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                            </div>
                            <span className="text-xs font-bold text-emerald-700 dark:text-emerald-300">
                              {product.quantity} {product.quantity === 1 ? t('products.item') : t('products.items')}
                            </span>
                          </div>
                        </div>
                      </div>
                      
                      {/* Progress Bar */}
                      <div className="h-2 bg-muted/40 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-500 ease-out relative"
                          style={{
                            width: `${percentage}%`,
                            backgroundColor: color,
                            opacity: 0.75,
                          }}
                        >
                          <div
                            className="absolute inset-0 rounded-full"
                            style={{
                              background: `linear-gradient(90deg, transparent, rgba(255,255,255,0.25), transparent)`,
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <div className="h-[300px] flex items-center justify-center text-muted-foreground">
            {t('analytics.noProductSalesData')}
          </div>
        )}
      </GlassCard>

      {/* Top 10 Customers by Revenue (Admin only) */}
      {isAdmin && (
        <GlassCard className="p-6 bg-white/80 backdrop-blur border-border/50">
          <h3 className="text-lg font-semibold mb-4">{t('analytics.top10Customers')}</h3>
          {displayData.topCustomers.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-16">{t('analytics.rank')}</TableHead>
                    <TableHead>{t('analytics.companyName')}</TableHead>
                    <TableHead className="text-right">{t('analytics.totalSpent')}</TableHead>
                    <TableHead className="text-right">{t('analytics.orders')}</TableHead>
                    <TableHead>{t('analytics.lastOrder')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {displayData.topCustomers.map((customer, idx) => (
                    <TableRow key={idx}>
                      <TableCell className="font-semibold">#{idx + 1}</TableCell>
                      <TableCell className="font-medium">{customer.companyName}</TableCell>
                      <TableCell className="text-right font-semibold">
                        {formatCurrency(customer.totalSpent)}
                      </TableCell>
                      <TableCell className="text-right">{customer.ordersCount}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {new Date(customer.lastOrderDate).toLocaleDateString()}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="h-[200px] flex items-center justify-center text-muted-foreground">
              {t('analytics.noCustomerData')}
            </div>
          )}
        </GlassCard>
      )}

      {/* Recent Low-Stock Products */}
      <GlassCard className="p-6 bg-white/80 backdrop-blur border-border/50">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">{t('analytics.lowStockProducts')}</h3>
          <Badge variant="destructive">{displayData.lowStockProducts.length} {t('analytics.items')}</Badge>
        </div>
        {displayData.lowStockProducts.length > 0 ? (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('analytics.product')}</TableHead>
                  <TableHead>{t('analytics.currentStock')}</TableHead>
                  <TableHead>{t('analytics.alert')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                  {displayData.lowStockProducts.map((product) => (
                  <TableRow key={product.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{product.name}</p>
                        <p className="text-xs text-muted-foreground font-mono">{product.sku}</p>
                      </div>
                    </TableCell>
                    <TableCell>{product.stock} {t('analytics.units')}</TableCell>
                    <TableCell>
                      {product.stock <= 5 ? (
                        <Badge variant="destructive">{t('analytics.critical')}</Badge>
                      ) : (
                        <Badge variant="secondary">{t('analytics.low')}</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <div className="text-center py-12">
            <Package className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-muted-foreground">{t('analytics.allProductsWellStocked')}</p>
          </div>
        )}
      </GlassCard>

      {/* Quote Funnel (Admin only) */}
      {isAdmin && (
        <GlassCard className="p-6 bg-white/80 backdrop-blur border-border/50">
          <h3 className="text-lg font-semibold mb-4">{t('analytics.quoteFunnel')}</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Draft */}
            <div className="p-4 rounded-lg border border-border/50 bg-white/50">
              <div className="flex items-center gap-2 mb-2">
                <FileText className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm font-medium text-muted-foreground">{t('analytics.draft')}</span>
              </div>
              <p className="text-2xl font-bold mb-1">{displayData.quoteFunnel.draft}</p>
              <p className="text-xs text-muted-foreground">100%</p>
            </div>

            {/* Sent */}
            <div className="p-4 rounded-lg border border-border/50 bg-white/50">
              <div className="flex items-center gap-2 mb-2">
                <Send className="w-4 h-4 text-blue-500" />
                <span className="text-sm font-medium">{t('analytics.sent')}</span>
              </div>
              <p className="text-2xl font-bold mb-1">{displayData.quoteFunnel.sent}</p>
              <p className="text-xs text-muted-foreground">
                {displayData.quoteFunnel.draft > 0
                  ? ((displayData.quoteFunnel.sent / displayData.quoteFunnel.draft) * 100).toFixed(1)
                  : 0}
                % {t('analytics.fromDraft')}
              </p>
            </div>

            {/* Accepted */}
            <div className="p-4 rounded-lg border border-border/50 bg-white/50">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle className="w-4 h-4 text-green-500" />
                <span className="text-sm font-medium">{t('analytics.accepted')}</span>
              </div>
              <p className="text-2xl font-bold mb-1">{displayData.quoteFunnel.accepted}</p>
              <p className="text-xs text-muted-foreground">
                {displayData.quoteFunnel.sent > 0
                  ? ((displayData.quoteFunnel.accepted / displayData.quoteFunnel.sent) * 100).toFixed(1)
                  : 0}
                % {t('analytics.fromSent')}
              </p>
            </div>

            {/* Ordered */}
            <div className="p-4 rounded-lg border border-border/50 bg-white/50">
              <div className="flex items-center gap-2 mb-2">
                <ShoppingCart className="w-4 h-4 text-purple-500" />
                <span className="text-sm font-medium">{t('analytics.ordered')}</span>
              </div>
              <p className="text-2xl font-bold mb-1">{displayData.quoteFunnel.ordered}</p>
              <p className="text-xs text-muted-foreground">
                {displayData.quoteFunnel.accepted > 0
                  ? ((displayData.quoteFunnel.ordered / displayData.quoteFunnel.accepted) * 100).toFixed(1)
                  : 0}
                % {t('analytics.fromAccepted')}
              </p>
            </div>
          </div>
        </GlassCard>
      )}

      {/* Company User Specific Sections */}
      {!isAdmin && displayData.myQuotesStatus && (
        <>
          {/* My Order Status Breakdown */}
          <GlassCard className="p-6 bg-white/80 backdrop-blur border-border/50">
            <h3 className="text-lg font-semibold mb-4">{t('analytics.myOrderStatus')}</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="p-4 rounded-lg border border-border/50 bg-white/50">
                <div className="flex items-center gap-2 mb-2">
                  <FileText className="w-4 h-4 text-blue-500" />
                  <span className="text-sm font-medium">{t('analytics.pending')}</span>
                </div>
                <p className="text-2xl font-bold">{displayData.myQuotesStatus.pending}</p>
              </div>
              <div className="p-4 rounded-lg border border-border/50 bg-white/50">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle className="w-4 h-4 text-green-500" />
                  <span className="text-sm font-medium">{t('analytics.approved')}</span>
                </div>
                <p className="text-2xl font-bold">{displayData.myQuotesStatus.approved}</p>
              </div>
              <div className="p-4 rounded-lg border border-border/50 bg-white/50">
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle className="w-4 h-4 text-red-500" />
                  <span className="text-sm font-medium">{t('analytics.rejected')}</span>
                </div>
                <p className="text-2xl font-bold">{displayData.myQuotesStatus.rejected}</p>
              </div>
              <div className="p-4 rounded-lg border border-border/50 bg-white/50">
                <div className="flex items-center gap-2 mb-2">
                  <FileText className="w-4 h-4 text-gray-500" />
                  <span className="text-sm font-medium">{t('analytics.expired')}</span>
                </div>
                <p className="text-2xl font-bold">{displayData.myQuotesStatus.expired}</p>
              </div>
            </div>
          </GlassCard>

          {/* My Recent Orders */}
          {displayData.myRecentQuotes && displayData.myRecentQuotes.length > 0 && (
            <GlassCard className="p-6 bg-white/80 backdrop-blur border-border/50">
              <h3 className="text-lg font-semibold mb-4">{t('analytics.myRecentOrders')}</h3>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('analytics.orderNo')}</TableHead>
                      <TableHead>{t('analytics.total')}</TableHead>
                      <TableHead>{t('analytics.status')}</TableHead>
                      <TableHead>{t('analytics.date')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {displayData.myRecentQuotes.map((quote) => (
                      <TableRow key={quote.id}>
                        <TableCell className="font-mono text-sm font-semibold">
                          #{quote.order_number || quote.id}
                        </TableCell>
                        <TableCell className="font-semibold">
                          {formatCurrency(quote.total)}
                        </TableCell>
                        <TableCell>
                          <OrderStatusBadge status={quote.status} />
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {new Date(quote.created_at).toLocaleDateString()}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </GlassCard>
          )}

        </>
      )}
    </div>
  )
}
