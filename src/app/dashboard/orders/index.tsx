import { useState, useMemo, useEffect } from 'react'
import { useAppContext } from '@/lib/app/AppContext'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
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
import { Checkbox } from '@/components/ui/checkbox'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { OrderDetailsSheet } from '@/components/OrderDetailsSheet'
import { useAuth } from '@/hooks/useAuth'
import { useTenantPath } from '@/lib/tenant/TenantProvider'
import { AdminOrdersView } from './AdminOrdersView'
import {
  Eye,
  MoreVertical,
  Search,
  FileText,
  Mail,
  Copy,
  Loader2,
} from 'lucide-react'
import { formatPrice } from '@/lib/utils'
import { cn } from '@/lib/utils'
import { ShippingMethodBadge } from '@/components/ShippingMethodBadge'
import type { ProformaInvoicePDFProps } from '@/components/ProformaInvoicePDF'
import { Company } from '@/types'
import { useToast } from '@/components/ui/use-toast'

// Order status types - new simplified workflow
type OrderStatus =
  | 'processing'
  | 'awaiting_payment'
  | 'shipped'
  | 'completed'
  | 'rejected'

interface OrderItem {
  product_id: string
  product_name: string
  sku: string
  quantity: number
  unit_price: number
  total: number
  image_url?: string
}

interface Order {
  id: number
  order_number: number
  user_id: string
  company_name: string
  email: string
  phone: string | null
  address: string | null
  notes: string | null
  items: OrderItem[]
  total: number
  shipping_method: 'warehouse_pickup' | 'transport_company' | 'dropshipping' | 'shop_delivery'
  status: OrderStatus
  created_at: string
  updated_at: string
}

interface QuoteRow {
  id?: number | string | null
  order_number?: number | string | null
  user_id?: string | null
  company_name?: string | null
  email?: string | null
  phone?: string | null
  notes?: string | null
  items?: unknown
  total?: number | string | null
  shipping_method?: string | null
  status?: string | null
  created_at?: string
  updated_at?: string | null
}

// Dummy orders for demonstration (remove when you have real data)
// TODO: Remove DUMMY_ORDERS once you have enough real orders
/*
const _DUMMY_ORDERS: any[] = [
  {
    id: 1,
    order_number: 1003,
    user_id: 'user-1',
    company_name: 'Sofia Furniture Ltd',
    email: 'orders@sofiafurniture.bg',
    phone: '+359 2 123 4567',
    address: '123 Vitosha Blvd, Sofia, Bulgaria',
    notes: 'Please deliver to back entrance',
    items: [
      {
        product_id: 'prod-1',
        product_name: 'Modern Office Chair',
        sku: 'CHAIR-001',
        quantity: 5,
        unit_price: 120.0,
        total: 600.0,
      },
      {
        product_id: 'prod-2',
        product_name: 'Executive Desk',
        sku: 'DESK-002',
        quantity: 2,
        unit_price: 345.0,
        total: 690.0,
      },
    ],
    total: 1290.0,
    deposit_amount: 500.0,
    deposit_paid: true,
    status: 'awaiting_payment',
    created_at: '2025-11-17T23:15:00Z',
    updated_at: '2025-11-17T23:15:00Z',
  },
  {
    id: 2,
    order_number: 1002,
    user_id: 'user-2',
    company_name: 'Bucharest Home Solutions',
    email: 'contact@bhs.ro',
    phone: '+40 21 987 6543',
    address: '45 Calea Victoriei, Bucharest, Romania',
    notes: null,
    items: [
      {
        product_id: 'prod-3',
        product_name: 'Dining Table Set',
        sku: 'TABLE-003',
        quantity: 1,
        unit_price: 850.0,
        total: 850.0,
      },
    ],
    total: 850.0,
    deposit_amount: null,
    deposit_paid: false,
    status: 'paid',
    created_at: '2025-11-15T14:30:00Z',
    updated_at: '2025-11-15T14:30:00Z',
  },
  {
    id: 3,
    order_number: 1001,
    user_id: 'user-3',
    company_name: 'Warsaw Office Supplies',
    email: 'info@wos.pl',
    phone: '+48 22 555 1234',
    address: '78 Nowy Świat, Warsaw, Poland',
    notes: 'Urgent delivery required',
    items: [
      {
        product_id: 'prod-4',
        product_name: 'Conference Table',
        sku: 'TABLE-004',
        quantity: 1,
        unit_price: 1200.0,
        total: 1200.0,
      },
      {
        product_id: 'prod-5',
        product_name: 'Ergonomic Chair',
        sku: 'CHAIR-005',
        quantity: 8,
        unit_price: 180.0,
        total: 1440.0,
      },
    ],
    total: 2640.0,
    deposit_amount: 1000.0,
    deposit_paid: true,
    status: 'ready_to_ship',
    created_at: '2025-11-10T09:20:00Z',
    updated_at: '2025-11-16T11:00:00Z',
  },
  {
    id: 4,
    order_number: 1000,
    user_id: 'user-4',
    company_name: 'Budapest Retail Group',
    email: 'orders@brg.hu',
    phone: '+36 1 234 5678',
    address: '12 Andrássy út, Budapest, Hungary',
    notes: null,
    items: [
      {
        product_id: 'prod-6',
        product_name: 'Storage Cabinet',
        sku: 'CAB-006',
        quantity: 3,
        unit_price: 250.0,
        total: 750.0,
      },
    ],
    total: 750.0,
    deposit_amount: 200.0,
    deposit_paid: true,
    status: 'partially_paid',
    created_at: '2025-11-08T16:45:00Z',
    updated_at: '2025-11-12T10:30:00Z',
  },
  {
    id: 5,
    order_number: 999,
    user_id: 'user-5',
    company_name: 'Prague Furniture Co',
    email: 'sales@pfc.cz',
    phone: '+420 2 987 6543',
    address: '56 Wenceslas Square, Prague, Czech Republic',
    notes: 'Customer will pick up',
    items: [
      {
        product_id: 'prod-7',
        product_name: 'Bookshelf Unit',
        sku: 'SHELF-007',
        quantity: 4,
        unit_price: 150.0,
        total: 600.0,
      },
    ],
    total: 600.0,
    deposit_amount: null,
    deposit_paid: false,
    status: 'shipped',
    created_at: '2025-11-05T11:00:00Z',
    updated_at: '2025-11-18T08:00:00Z',
  },
]
*/

function getStatusBadge(status: OrderStatus, t: (key: string) => string) {
  const configs = {
    processing: {
      label: t('orders.processing'),
      className: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    },
    awaiting_payment: {
      label: t('orders.awaitingPayment'),
      className: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
    },
    shipped: {
      label: t('orders.shipped'),
      className: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
    },
    completed: {
      label: t('orders.completedSent'),
      className: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    },
    rejected: {
      label: t('orders.rejected'),
      className: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    },
  }

  const config = configs[status]
  return (
    <Badge variant="outline" className={cn('font-medium', config.className)}>
      {config.label}
    </Badge>
  )
}

function formatOrderDate(dateString: string): string {
  const date = new Date(dateString)
  const day = date.getDate()
  const month = date.toLocaleDateString('en-US', { month: 'short' })
  const year = date.getFullYear()
  const hours = date.getHours().toString().padStart(2, '0')
  const minutes = date.getMinutes().toString().padStart(2, '0')
  return `${day} ${month} ${year}, ${hours}:${minutes}`
}

function isToday(dateString: string): boolean {
  const date = new Date(dateString)
  const today = new Date()
  return (
    date.getDate() === today.getDate() &&
    date.getMonth() === today.getMonth() &&
    date.getFullYear() === today.getFullYear()
  )
}

function isThisWeek(dateString: string): boolean {
  const date = new Date(dateString)
  const today = new Date()
  const weekAgo = new Date(today)
  weekAgo.setDate(today.getDate() - 7)
  return date >= weekAgo
}

function isThisMonth(dateString: string): boolean {
  const date = new Date(dateString)
  const today = new Date()
  return (
    date.getMonth() === today.getMonth() &&
    date.getFullYear() === today.getFullYear()
  )
}

export function OrdersPage() {
  const { isAdmin } = useAuth()

  if (isAdmin) {
    return <AdminOrdersView />
  }

  return <CompanyOrdersView />
}

function CompanyOrdersView() {
  const { t } = useTranslation()
  const { user, company, profile } = useAuth()
  const { toast } = useToast()
  const { workspaceId: tenantId } = useAppContext()
  const { withBase } = useTenantPath()

  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null)
  const [detailsOpen, setDetailsOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [shippingFilter, setShippingFilter] = useState<string>('all')
  const [dateFilter, setDateFilter] = useState<string>('all')
  const [selectedOrders, setSelectedOrders] = useState<Set<number>>(new Set())
  const [isGeneratingBulkPdfs, setIsGeneratingBulkPdfs] = useState(false)

  const isDevMode = import.meta.env.VITE_DEV_MODE === 'true'
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || ''
  const isDemoMode = supabaseUrl.includes('placeholder')
  // Use the same dev user ID as in useAuth hook
  const devUserId = (isDevMode || isDemoMode) ? '00000000-0000-0000-0000-000000000123' : null
  const userId = user?.id || devUserId

  // Fetch real orders from quotes table (Eastern Europe B2B style: quotes are orders)
  const { data: quotesData, isLoading } = useQuery<Order[]>({
    queryKey: ['workspace', 'orders', userId, isDevMode || isDemoMode],
    queryFn: async (): Promise<Order[]> => {
      if (!tenantId) {
        return []
      }
      // In dev/demo mode, show all orders. In production, filter by user_id
      let query = supabase
        .from('quotes')
        .select('id, order_number, user_id, company_name, email, phone, notes, items, total, shipping_method, status, created_at, updated_at')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false })

      // Only filter by user_id in production mode
      if (!isDevMode && !isDemoMode && userId) {
        query = query.eq('user_id', userId)
      }

      const { data, error } = await query

      if (error) {
        console.error('Error fetching orders:', error)
        throw error
      }

      // Map quotes to orders format
      const rows = (data as QuoteRow[] | null) ?? []

      return rows.map((quote) => {
        const rawStatus = typeof quote.status === 'string' ? quote.status : 'processing'

        // Map database status values to new UI status system
        const statusMap: Record<string, OrderStatus> = {
          new: 'processing',           // Processing
          draft: 'processing',         // Processing
          pending: 'awaiting_payment', // Awaiting Payment
          shipped: 'shipped',          // Shipped
          approved: 'completed',       // Completed & Sent
          paid: 'completed',           // Completed & Sent
          delivered: 'completed',      // Completed & Sent
          completed: 'completed',      // Completed & Sent
          rejected: 'rejected',        // Rejected
          expired: 'awaiting_payment',  // Treat expired as awaiting payment
        }

        // Default status if not in map
        const mappedStatus = statusMap[rawStatus] || 'processing'

        const parsedId =
          typeof quote.id === 'number' ? quote.id : parseInt(String(quote.id ?? ''), 10) || 0
        const orderNumberRaw = quote.order_number ?? parsedId
        const parsedOrderNumber =
          typeof orderNumberRaw === 'number'
            ? orderNumberRaw
            : parseInt(String(orderNumberRaw ?? ''), 10) || parsedId

        const shippingMethod =
          quote.shipping_method === 'warehouse_pickup' ||
          quote.shipping_method === 'transport_company' ||
          quote.shipping_method === 'dropshipping' ||
          quote.shipping_method === 'shop_delivery'
            ? quote.shipping_method
            : 'shop_delivery'

        return {
          id: parsedId,
          order_number: parsedOrderNumber,
          user_id: quote.user_id || '',
          company_name: quote.company_name || 'Unknown Company',
          email: quote.email || '',
          phone: quote.phone || null,
          address: null, // Address not stored in quotes table yet
          notes: quote.notes || null,
          items: Array.isArray(quote.items) ? (quote.items as OrderItem[]) : [],
          total: Number(quote.total ?? 0),
          shipping_method: shippingMethod,
          status: mappedStatus,
          created_at: quote.created_at || '',
          updated_at: quote.updated_at || quote.created_at || '',
        } as Order
      })
    },
    enabled: !!userId && !!tenantId,
    staleTime: 60 * 1000,
    gcTime: 5 * 60 * 1000,
  })

  // Combine real orders with dummy data for demonstration (remove DUMMY_ORDERS later)
  const orders = useMemo(() => quotesData ?? [], [quotesData])

  // Auto-open order details if coming from order submission
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search)
    const newOrderId = urlParams.get('newOrder')
    if (newOrderId && orders && orders.length > 0) {
      // Try to find by order_number first, then by id
      const newOrder = orders.find(
        (o) =>
          o.order_number?.toString() === newOrderId ||
          o.id.toString() === newOrderId
      )
      if (newOrder) {
        setSelectedOrder(newOrder)
        setDetailsOpen(true)
        // Clean up URL
        window.history.replaceState({}, '', withBase('/dashboard/orders'))
      }
    }
  }, [orders, withBase])

  // Filter and search orders
  const filteredOrders = useMemo(() => {
    let filtered = orders

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(
        (order) =>
          order.order_number.toString().includes(query) ||
          order.company_name.toLowerCase().includes(query)
      )
    }

    // Status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter((order) => order.status === statusFilter)
    }

    // Shipping method filter
    if (shippingFilter !== 'all') {
      filtered = filtered.filter((order) => order.shipping_method === shippingFilter)
    }

    // Date filter
    if (dateFilter === 'today') {
      filtered = filtered.filter((order) => isToday(order.created_at))
    } else if (dateFilter === 'this_week') {
      filtered = filtered.filter((order) => isThisWeek(order.created_at))
    } else if (dateFilter === 'this_month') {
      filtered = filtered.filter((order) => isThisMonth(order.created_at))
    }

    return filtered
  }, [orders, searchQuery, statusFilter, shippingFilter, dateFilter])

  // Status counts for filter badges (similar to returns/complaints page)
  const statusCounts = useMemo(
    () => ({
      processing: orders.filter((o) => o.status === 'processing').length,
      awaiting_payment: orders.filter((o) => o.status === 'awaiting_payment').length,
      shipped: orders.filter((o) => o.status === 'shipped').length,
      completed: orders.filter((o) => o.status === 'completed').length,
      rejected: orders.filter((o) => o.status === 'rejected').length,
    }),
    [orders],
  )

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedOrders(new Set(filteredOrders.map((o) => o.id)))
    } else {
      setSelectedOrders(new Set())
    }
  }

  const handleSelectOrder = (orderId: number, checked: boolean) => {
    const newSelected = new Set(selectedOrders)
    if (checked) {
      newSelected.add(orderId)
    } else {
      newSelected.delete(orderId)
    }
    setSelectedOrders(newSelected)
  }

  const handleBulkAction = async (action: string) => {
    if (action === 'proforma') {
      if (!company || profile?.role !== 'company') {
        toast({
          title: t('settings.error'),
          description: 'PDF generation only available for company users',
          variant: 'destructive',
        })
        return
      }

      if (selectedOrders.size === 0) {
        return
      }

      setIsGeneratingBulkPdfs(true)

      try {
        if (!tenantId) {
          throw new Error('Missing tenant context')
        }
        // Helper: parse city from address if not stored separately
        const parseCityFromAddress = (address: string | undefined | null): string | undefined => {
          if (!address) return undefined
          const parts = address.split(',').map(p => p.trim())
          if (parts.length >= 2) {
            return parts[parts.length - 2] || parts[parts.length - 1]
          }
          return parts[0] || undefined
        }

        // Fetch ADMIN's company data (Доставчик/Supplier - the platform owner)
        const { data: adminProfile } = await supabase
          .from('profiles')
          .select('company_id')
          .eq('role', 'admin')
          .eq('tenant_id', tenantId)
          .single()

        let adminCompany: Company | null = null
        if (adminProfile?.company_id) {
          const { data: adminCompanyData } = await supabase
            .from('companies')
            .select('*')
            .eq('id', adminProfile.company_id)
            .eq('tenant_id', tenantId)
            .single()

          if (adminCompanyData) {
            adminCompany = adminCompanyData as Company
          }
        }

        // Refresh logged-in company's data (Получател/Buyer)
        const { data: freshCompany } = await supabase
          .from('companies')
          .select('*')
          .eq('id', company.id)
          .eq('tenant_id', tenantId)
          .single()

        const buyerCompany = (freshCompany as Company) || company

        // Prepare supplier and buyer data
        const supplierCity = adminCompany?.city || parseCityFromAddress(adminCompany?.address)
        const supplier: ProformaInvoicePDFProps['supplier'] = {
          name: adminCompany?.name || '—',
          address: adminCompany?.address || '',
          city: supplierCity,
          phone: adminCompany?.phone,
          eik: adminCompany?.eik_bulstat,
          vatNumber: adminCompany?.vat_number,
          mol: adminCompany?.mol,
          bankName: adminCompany?.bank_name,
          iban: adminCompany?.iban,
          bic: adminCompany?.bic,
        }

        const buyerCity = buyerCompany.city || parseCityFromAddress(buyerCompany.address)
        const baseBuyer: Omit<ProformaInvoicePDFProps['buyer'], 'companyName' | 'email'> = {
          eik: buyerCompany.eik_bulstat,
          vatNumber: buyerCompany.vat_number,
          city: buyerCity,
          address: buyerCompany.address || undefined,
          phone: buyerCompany.phone || undefined,
          mol: buyerCompany.mol,
        }

        // Get selected orders from filtered orders
        const selectedOrderIds = Array.from(selectedOrders)
        const ordersToProcess = filteredOrders.filter(order => selectedOrderIds.includes(order.id))

        if (ordersToProcess.length === 0) {
          toast({
            title: t('settings.error'),
            description: 'No orders found to generate PDFs',
            variant: 'destructive',
          })
          return
        }

        // Dynamically import react-pdf to avoid bundling the heavy package upfront
        const [{ pdf }, { ProformaInvoicePDF }] = await Promise.all([
          import('@react-pdf/renderer'),
          import('@/components/ProformaInvoicePDF'),
        ])

        // Generate and download PDFs for each selected order
        for (let i = 0; i < ordersToProcess.length; i++) {
          const order = ordersToProcess[i]
          
          const buyer: ProformaInvoicePDFProps['buyer'] = {
            ...baseBuyer,
            companyName: buyerCompany.name || order.company_name,
            email: order.email,
          }

          const mappedOrder = {
            ...order,
            items: order.items.map(item => ({
              ...item,
              product_id: item.product_id,
            })),
          }

          const blob = await pdf(
            <ProformaInvoicePDF
              order={mappedOrder}
              supplier={supplier}
              buyer={buyer}
              settings={{
                currency: 'EUR',
                vatRate: 0.2,
              }}
            />
          ).toBlob()

          // Download with a small delay between downloads to avoid browser blocking
          const url = URL.createObjectURL(blob)
          const link = document.createElement('a')
          link.href = url
          link.download = `proforma-${order.order_number}.pdf`
          document.body.appendChild(link)
          link.click()
          document.body.removeChild(link)
          URL.revokeObjectURL(url)

          // Small delay between downloads (except for the last one)
          if (i < ordersToProcess.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 300))
          }
        }

        toast({
          title: t('settings.success'),
          description: `Generated ${ordersToProcess.length} proforma invoice(s)`,
        })

        // Clear selection after successful generation
        setSelectedOrders(new Set())
      } catch (error) {
        console.error('Error generating bulk PDFs:', error)
        toast({
          title: t('settings.error'),
          description: error instanceof Error ? error.message : 'Failed to generate PDFs',
          variant: 'destructive',
        })
      } finally {
        setIsGeneratingBulkPdfs(false)
      }
    } else if (action === 'send_email') {
      // TODO: Implement bulk email sending
      setSelectedOrders(new Set())
    }
  }

  const handleOrderAction = (_order: Order, action: string) => {
    // TODO: Implement per-order actions (duplicate, send email, etc.)
    switch (action) {
      case 'duplicate':
        // TODO: Duplicate order logic
        break
      case 'proforma':
        // TODO: Generate proforma invoice
        break
      case 'send_email':
        // TODO: Send email
        break
    }
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold sm:text-3xl">{t('orders.title')}</h1>
        <p className="text-muted-foreground mt-1">
          {t('orders.subtitle')}
        </p>
      </div>

      {/* Top Bar: Search + Dropdown Filters */}
      <div className="space-y-4">
        <div className="flex flex-col lg:flex-row gap-4 lg:items-center">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={t('orders.searchPlaceholder')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>

          {/* Dropdown Filters: Status, Shipping, Date */}
          <div className="flex flex-col sm:flex-row gap-2 w-full lg:w-auto">
            {/* Status Filter */}
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder={t('orders.allStatuses')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('orders.allStatuses')}</SelectItem>
                <SelectItem value="processing">{t('orders.processing')}</SelectItem>
                <SelectItem value="awaiting_payment">{t('orders.awaitingPayment')}</SelectItem>
                <SelectItem value="shipped">{t('orders.shipped')}</SelectItem>
                <SelectItem value="completed">{t('orders.completedSent')}</SelectItem>
                <SelectItem value="rejected">{t('orders.rejected')}</SelectItem>
              </SelectContent>
            </Select>

            {/* Shipping Method Filter */}
            <Select value={shippingFilter} onValueChange={setShippingFilter}>
              <SelectTrigger className="w-full sm:w-[190px]">
                <SelectValue placeholder={t('orders.shippingMethodFilter')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('orders.allShippingMethods')}</SelectItem>
                <SelectItem value="shop_delivery">{t('shipping.shopDeliveryShort')}</SelectItem>
                <SelectItem value="warehouse_pickup">{t('shipping.warehousePickupShort')}</SelectItem>
                <SelectItem value="transport_company">{t('shipping.transportCompanyShort')}</SelectItem>
                <SelectItem value="dropshipping">{t('shipping.dropshippingShort')}</SelectItem>
              </SelectContent>
            </Select>

            {/* Date Range Filter */}
            <Select value={dateFilter} onValueChange={setDateFilter}>
              <SelectTrigger className="w-full sm:w-[170px]">
                <SelectValue placeholder={t('orders.dateFilter')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('orders.allDates')}</SelectItem>
                <SelectItem value="today">{t('orders.today')}</SelectItem>
                <SelectItem value="this_week">{t('orders.thisWeek')}</SelectItem>
                <SelectItem value="this_month">{t('orders.thisMonth')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Status Count Badges (clickable filters, similar to returns page) */}
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/20 shadow-sm hover:bg-blue-500/15 transition-colors cursor-pointer"
            onClick={() =>
              setStatusFilter(statusFilter === 'processing' ? 'all' : 'processing')
            }
          >
            <span className="w-2.5 h-2.5 rounded-full bg-blue-500 shadow-sm" />
            <span className="text-xs font-semibold text-blue-700 dark:text-blue-400">
              {t('orders.processing')}: {statusCounts.processing}
            </span>
          </button>
          <button
            type="button"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-orange-500/10 border border-orange-500/20 shadow-sm hover:bg-orange-500/15 transition-colors cursor-pointer"
            onClick={() =>
              setStatusFilter(
                statusFilter === 'awaiting_payment' ? 'all' : 'awaiting_payment',
              )
            }
          >
            <span className="w-2.5 h-2.5 rounded-full bg-orange-500 shadow-sm" />
            <span className="text-xs font-semibold text-orange-700 dark:text-orange-400">
              {t('orders.awaitingPayment')}: {statusCounts.awaiting_payment}
            </span>
          </button>
          <button
            type="button"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-purple-500/10 border border-purple-500/20 shadow-sm hover:bg-purple-500/15 transition-colors cursor-pointer"
            onClick={() =>
              setStatusFilter(statusFilter === 'shipped' ? 'all' : 'shipped')
            }
          >
            <span className="w-2.5 h-2.5 rounded-full bg-purple-500 shadow-sm" />
            <span className="text-xs font-semibold text-purple-700 dark:text-purple-400">
              {t('orders.shipped')}: {statusCounts.shipped}
            </span>
          </button>
          <button
            type="button"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-green-500/10 border border-green-500/20 shadow-sm hover:bg-green-500/15 transition-colors cursor-pointer"
            onClick={() =>
              setStatusFilter(statusFilter === 'completed' ? 'all' : 'completed')
            }
          >
            <span className="w-2.5 h-2.5 rounded-full bg-green-500 shadow-sm" />
            <span className="text-xs font-semibold text-green-700 dark:text-green-400">
              {t('orders.completedSent')}: {statusCounts.completed}
            </span>
          </button>
          <button
            type="button"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-red-500/10 border border-red-500/20 shadow-sm hover:bg-red-500/15 transition-colors cursor-pointer"
            onClick={() =>
              setStatusFilter(statusFilter === 'rejected' ? 'all' : 'rejected')
            }
          >
            <span className="w-2.5 h-2.5 rounded-full bg-red-500 shadow-sm" />
            <span className="text-xs font-semibold text-red-700 dark:text-red-400">
              {t('orders.rejected')}: {statusCounts.rejected}
            </span>
          </button>
        </div>

      </div>

      {/* Bulk Action Bar */}
      {selectedOrders.size > 0 && (
        <div className="flex flex-col gap-3 rounded-lg border border-primary/20 bg-primary/10 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">
              {selectedOrders.size} {selectedOrders.size === 1 ? t('orders.order') : t('orders.orders')}{' '}
              {t('orders.selected')}
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleBulkAction('proforma')}
              disabled={isGeneratingBulkPdfs}
            >
              {isGeneratingBulkPdfs ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Генериране...
                </>
              ) : (
                <>
                  <FileText className="w-4 h-4 mr-2" />
                  {t('orders.generateProforma')}
                </>
              )}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleBulkAction('send_email')}
            >
              <Mail className="w-4 h-4 mr-2" />
              {t('orders.sendEmail')}
            </Button>
          </div>
        </div>
      )}

      {/* Orders Table */}
      <div className="border rounded-lg bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">
                <Checkbox
                  checked={
                    filteredOrders.length > 0 &&
                    selectedOrders.size === filteredOrders.length
                  }
                  onCheckedChange={handleSelectAll}
                />
              </TableHead>
              <TableHead>{t('orders.orderNumber')}</TableHead>
              <TableHead>{t('orders.date')}</TableHead>
              <TableHead>{t('orders.items')}</TableHead>
              <TableHead>{t('orders.total')}</TableHead>
              <TableHead>{t('orders.shipping')}</TableHead>
              <TableHead>{t('orders.status')}</TableHead>
              <TableHead className="text-right">{t('orders.actions')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-8">
                  {t('orders.loadingOrders')}
                </TableCell>
              </TableRow>
            ) : filteredOrders.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-8">
                  <div className="flex flex-col items-center gap-2">
                    <p className="text-muted-foreground">{t('orders.noOrdersFound')}</p>
                    {searchQuery || statusFilter !== 'all' ? (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setSearchQuery('')
                          setStatusFilter('all')
                        }}
                      >
                        {t('orders.clearFilters')}
                      </Button>
                    ) : null}
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              filteredOrders.map((order) => (
                <TableRow
                  key={order.id}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => {
                    setSelectedOrder(order)
                    setDetailsOpen(true)
                  }}
                >
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <Checkbox
                      checked={selectedOrders.has(order.id)}
                      onCheckedChange={(checked) =>
                        handleSelectOrder(order.id, checked as boolean)
                      }
                    />
                  </TableCell>
                  <TableCell>
                    <span className="font-mono font-semibold text-primary">
                      #{order.order_number}
                    </span>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatOrderDate(order.created_at)}
                  </TableCell>
                  <TableCell>
                    <span className="text-sm">
                      {order.items.length} {order.items.length === 1 ? t('products.item') : t('products.items')}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className="font-bold">{formatPrice(order.total)}</span>
                  </TableCell>
                  <TableCell>
                    <ShippingMethodBadge method={order.shipping_method} size="sm" />
                  </TableCell>
                  <TableCell>{getStatusBadge(order.status, t)}</TableCell>
                  <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => {
                          setSelectedOrder(order)
                          setDetailsOpen(true)
                        }}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                          >
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() => handleOrderAction(order, 'duplicate')}
                          >
                            <Copy className="w-4 h-4 mr-2" />
                            {t('orders.duplicateAsNewOrder')}
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleOrderAction(order, 'proforma')}
                          >
                            <FileText className="w-4 h-4 mr-2" />
                            {t('orders.generateProformaInvoice')}
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => handleOrderAction(order, 'send_email')}
                          >
                            <Mail className="w-4 h-4 mr-2" />
                            {t('orders.sendByEmail')}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Order Details Sheet */}
      {selectedOrder && (
        <OrderDetailsSheet
          order={selectedOrder}
          open={detailsOpen}
          onOpenChange={setDetailsOpen}
        />
      )}

    </div>
  )
}
