import { useState, useMemo, useEffect } from 'react'
import { useAppContext } from '@/lib/app/AppContext'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase/client'
import { sendNotification } from '@/lib/notifications'
import { Button } from '@/components/ui/button'
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { useToast } from '@/components/ui/use-toast'
import { Eye, Search, Building2, X } from 'lucide-react'
import { SHIPPING_METHOD_CONFIG } from '@/types'
import { ShippingMethodBadge } from '@/components/ShippingMethodBadge'
import { formatPrice, formatDateTime, cn } from '@/lib/utils'
import { ShipmentPanel } from '@/components/shipping/ShipmentPanel'
// Proforma PDFs are generated only from company user accounts (see OrdersPage/OrderDetailsSheet)

interface OrderItem {
  product_id?: string
  product_name: string
  sku: string
  quantity: number
  unit_price: number
  total: number
  image_url?: string
}

interface Order {
  id: number | string
  order_number: number
  user_id: string
  company_name: string
  email: string
  phone: string | null
  address: string | null
  notes: string | null
  internal_notes?: string
  items: OrderItem[]
  total: number
  shipping_method: 'warehouse_pickup' | 'transport_company' | 'dropshipping' | 'shop_delivery'
  status: 'processing' | 'awaiting_payment' | 'shipped' | 'completed' | 'rejected'
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
  internal_notes?: string | null
  items?: unknown
  total?: number | string | null
  shipping_method?: string | null
  status?: string | null
  created_at?: string
  updated_at?: string | null
}

// Map old database status values to new UI statuses
function mapStatus(status: string): Order['status'] {
  const statusMap: Record<string, Order['status']> = {
    // Legacy DB values
    new: 'processing',
    draft: 'processing',
    pending: 'awaiting_payment',
    approved: 'completed',
    paid: 'completed',
    delivered: 'completed',
    // Current UI statuses
    processing: 'processing',
    awaiting_payment: 'awaiting_payment',
    shipped: 'shipped',
    completed: 'completed',
    rejected: 'rejected',
    // Edge cases
    expired: 'awaiting_payment',
    partially_paid: 'awaiting_payment',
    ready_to_ship: 'shipped',
  }
  return statusMap[status] || 'processing'
}

// Map new UI statuses to database values
function mapStatusToDb(status: Order['status']): string {
  const statusMap: Record<Order['status'], string> = {
    processing: 'new',
    awaiting_payment: 'pending',
    shipped: 'shipped',
    completed: 'approved',
    rejected: 'rejected',
  }
  return statusMap[status]
}

// Status badge function removed - using OrderStatusBadge component instead

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

export function AdminOrdersView() {
  const { t } = useTranslation()
  const [searchParams, setSearchParams] = useSearchParams()
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null)
  const [detailsOpen, setDetailsOpen] = useState(false)
  const [supportsInternalNotes, setSupportsInternalNotes] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [companyFilter, setCompanyFilter] = useState<string>('all')
  const [shippingFilter, setShippingFilter] = useState<string>('all')
  const [dateFilter, setDateFilter] = useState<string>('all')
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const { workspaceId: tenantId } = useAppContext()

  // Handle URL query parameters for filtering
  useEffect(() => {
    const companyParam = searchParams.get('company')
    const filterParam = searchParams.get('filter')
    
    if (companyParam) {
      setCompanyFilter(companyParam)
    }
    if (filterParam === 'pending') {
      // Show both processing and awaiting_payment for "pending" filter
      setStatusFilter('awaiting_payment')
    } else if (filterParam === 'processing') {
      setStatusFilter('processing')
    }
  }, [searchParams])

  // Fetch all orders (admin sees all via RLS)
  const { data: orders, isLoading } = useQuery({
    queryKey: ['workspace', 'admin-orders'],
    queryFn: async () => {
      if (!tenantId) return []
      let data: unknown[] | null = null
      let error: { code?: string; message?: string } | null = null

      // Backward-compatible fallback for tenants that haven't applied the
      // quotes internal_notes migration yet.
      const withInternalNotes = await supabase
        .from('quotes')
        .select('id, order_number, user_id, company_name, email, phone, notes, items, total, shipping_method, status, created_at, updated_at, internal_notes')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false })

      data = withInternalNotes.data as unknown[] | null
      error = withInternalNotes.error as { code?: string; message?: string } | null

      if (error?.code === '42703' && error.message?.includes('internal_notes')) {
        setSupportsInternalNotes(false)

        const withoutInternalNotes = await supabase
          .from('quotes')
          .select('id, order_number, user_id, company_name, email, phone, notes, items, total, shipping_method, status, created_at, updated_at')
          .eq('tenant_id', tenantId)
          .order('created_at', { ascending: false })

        data = withoutInternalNotes.data as unknown[] | null
        error = withoutInternalNotes.error as { code?: string; message?: string } | null
      } else {
        setSupportsInternalNotes(true)
      }

      if (error) {
        console.error('Error fetching orders:', error)
        throw error
      }

      const rows = (data as QuoteRow[] | null) || []
      const missingCompanyNameUserIds = Array.from(
        new Set(
          rows
            .filter((quote) => !quote.company_name && quote.user_id)
            .map((quote) => quote.user_id)
            .filter((id): id is string => !!id)
        )
      )
      const companyNameByUserId = new Map<string, string>()

      if (missingCompanyNameUserIds.length > 0) {
        const { data: profiles, error: profilesError } = await supabase
          .from('profiles')
          .select('id, company_name')
          .in('id', missingCompanyNameUserIds)
          .eq('tenant_id', tenantId)

        if (profilesError) {
          console.warn('Error fetching profiles for orders:', profilesError)
        } else {
          for (const profile of profiles || []) {
            if (profile?.id && profile?.company_name) {
              companyNameByUserId.set(profile.id, profile.company_name)
            }
          }
        }
      }

      const ordersWithDetails = rows.map((quote) => {
        const fallbackCompanyName =
          (quote.user_id ? companyNameByUserId.get(quote.user_id) : undefined) || 'Unknown Company'
        const companyName = quote.company_name || fallbackCompanyName

          const parsedId =
            typeof quote.id === 'number' ? quote.id : parseInt(String(quote.id ?? ''), 10) || 0
          const orderNumberRaw = quote.order_number ?? parsedId
          const parsedOrderNumber =
            typeof orderNumberRaw === 'number'
              ? orderNumberRaw
              : parseInt(String(orderNumberRaw ?? ''), 10) || parsedId

          return {
            id: parsedId,
            order_number: parsedOrderNumber,
            user_id: quote.user_id,
            company_name: companyName,
            email: quote.email || '',
            phone: quote.phone || null,
            address: null,
            notes: quote.notes || null,
            internal_notes: quote.internal_notes || '',
            items: Array.isArray(quote.items) ? (quote.items as OrderItem[]) : [],
            total: Number(quote.total ?? 0),
            shipping_method:
              quote.shipping_method === 'warehouse_pickup' ||
              quote.shipping_method === 'transport_company' ||
              quote.shipping_method === 'dropshipping' ||
              quote.shipping_method === 'shop_delivery'
                ? quote.shipping_method
                : 'shop_delivery',
            status: mapStatus(quote.status || ''),
            created_at: quote.created_at || '',
            updated_at: quote.updated_at || quote.created_at || '',
          } as Order
      })

      return ordersWithDetails
    },
    enabled: !!tenantId,
    staleTime: 60 * 1000,
    gcTime: 5 * 60 * 1000,
  })

  // Set up real-time subscription for orders
  useEffect(() => {
    const channel = supabase
      .channel('admin-orders-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'quotes',
        },
        () => {
          // Refetch orders when any change occurs
          queryClient.invalidateQueries({ queryKey: ['workspace', 'admin-orders'] })
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [queryClient, tenantId])

  // Update status mutation
  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: number | string; status: Order['status']; userId?: string; orderNumber?: number; companyName?: string }) => {
      const dbStatus = mapStatusToDb(status)
      const { error } = await supabase
        .from('quotes')
        .update({ status: dbStatus })
        .eq('id', id)
        .eq('tenant_id', tenantId)

      if (error) throw error
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['workspace', 'admin-orders'] })

      // Notify the company user who placed the order
      if (variables.userId) {
        sendNotification({
          type: 'order_status_changed',
          entityType: 'quotes',
          entityId: String(variables.id),
          metadata: {
            order_number: variables.orderNumber,
            status: variables.status,
            company_name: variables.companyName,
          },
          targetAudience: 'user',
          targetUserId: variables.userId,
        })
      }

      toast({
        title: 'Status updated',
        description: 'The order status has been updated.',
      })
    },
    onError: (error: Error) => {
      toast({
        title: 'Error updating status',
        description: error.message || 'Failed to update order status.',
        variant: 'destructive',
      })
    },
  })

  // Update internal notes mutation
  const updateInternalNotesMutation = useMutation({
    mutationFn: async ({ id, notes }: { id: number | string; notes: string }) => {
      if (!supportsInternalNotes) {
        return
      }
      const { error } = await supabase
        .from('quotes')
        .update({ internal_notes: notes })
        .eq('id', id)
        .eq('tenant_id', tenantId)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workspace', 'admin-orders'] })
      toast({
        title: 'Notes updated',
        description: 'Internal notes have been saved.',
      })
    },
    onError: (error: Error) => {
      toast({
        title: 'Error updating notes',
        description: error.message || 'Failed to update internal notes.',
        variant: 'destructive',
      })
    },
  })

  // Extract unique company names for filter dropdown
  const uniqueCompanies = useMemo(() => {
    if (!orders) return []
    const companies = new Set<string>()
    orders.forEach((order) => {
      if (order.company_name && order.company_name !== 'Unknown Company') {
        companies.add(order.company_name)
      }
    })
    return Array.from(companies).sort((a, b) => a.localeCompare(b))
  }, [orders])

  // Company order counts for summary badges
  const companyOrderCounts = useMemo(() => {
    if (!orders) return []
    const counts = new Map<string, number>()
    orders.forEach((order) => {
      const name = order.company_name || t('overview.unknownCompany')
      counts.set(name, (counts.get(name) || 0) + 1)
    })
    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1])
  }, [orders, t])

  // Filter orders
  const filteredOrders = useMemo(() => {
    let filtered = orders || []

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(
        (order) =>
          order.order_number.toString().includes(query) ||
          order.company_name.toLowerCase().includes(query) ||
          order.email.toLowerCase().includes(query)
      )
    }

    // Status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter((order) => order.status === statusFilter)
    }

    // Company filter
    if (companyFilter !== 'all') {
      filtered = filtered.filter(
        (order) => 
          order.company_name === companyFilter || 
          order.email === companyFilter
      )
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
  }, [orders, searchQuery, statusFilter, companyFilter, shippingFilter, dateFilter])

  const handleViewDetails = (order: Order) => {
    setSelectedOrder(order)
    setDetailsOpen(true)
  }

  const handleStatusChange = (orderId: number | string, newStatus: Order['status']) => {
    const order = orders?.find((o) => o.id === orderId)
    updateStatusMutation.mutate({
      id: orderId,
      status: newStatus,
      userId: order?.user_id,
      orderNumber: order?.order_number,
      companyName: order?.company_name,
    })
  }

  const handleInternalNotesChange = (notes: string) => {
    if (!selectedOrder) return
    updateInternalNotesMutation.mutate({ id: selectedOrder.id, notes })
  }

  return (
    <>
      <div className="space-y-6">
        {/* Page Header */}
        <div>
          <h1 className="text-2xl font-bold sm:text-3xl">{t('adminOrders.title')}</h1>
          <p className="text-muted-foreground mt-1">
            {t('adminOrders.subtitle')}
          </p>
        </div>

        {/* Company summary badges */}
        {companyOrderCounts.length > 0 && (
          <div className="space-y-3 rounded-xl bg-muted/40 border border-border/60 px-4 py-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-semibold text-muted-foreground tracking-wide">
                {t('overview.company')} · {t('overview.orders')}
              </p>
              <span className="text-[11px] text-muted-foreground">
                {companyOrderCounts.length} companies
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              {companyOrderCounts.map(([name, count]) => {
                const isActive = companyFilter === name
                return (
                  <button
                    key={name}
                    type="button"
                    className={cn(
                      'flex items-center gap-2 px-3.5 py-1.5 rounded-full border text-xs font-medium shadow-sm transition-all duration-150',
                      isActive
                        ? 'bg-slate-900 text-white border-slate-900 shadow-md scale-[1.02]'
                        : 'bg-slate-50/90 text-slate-700 border-slate-200/80 hover:bg-slate-100 dark:bg-slate-800/80 dark:text-slate-100 dark:border-slate-700/80 dark:hover:bg-slate-700'
                    )}
                    onClick={() => {
                      const next = isActive ? 'all' : name
                      setCompanyFilter(next)
                      if (searchParams.has('company')) {
                        searchParams.delete('company')
                        setSearchParams(searchParams)
                      }
                    }}
                  >
                    <span className="truncate max-w-[180px]">{name}</span>
                    <span
                      className={cn(
                        'inline-flex items-center justify-center px-2 py-0.5 rounded-full text-[10px] font-semibold',
                        isActive
                          ? 'bg-white/20 text-white'
                          : 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-50'
                      )}
                    >
                      {count}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* Top Bar: Search and Filters */}
        <div className="space-y-4">
          <div className="flex flex-col lg:flex-row gap-4 lg:items-center">
            {/* Search */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={t('adminOrders.searchPlaceholder')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>

            {/* Company + Status + Shipping + Date filters */}
            <div className="flex flex-col sm:flex-row gap-2 w-full lg:w-auto">
              {/* Company Filter */}
              <div className="relative">
                <Select 
                  value={companyFilter} 
                  onValueChange={(value) => {
                    setCompanyFilter(value)
                    // Clear URL params when manually changing filter
                    if (searchParams.has('company')) {
                      searchParams.delete('company')
                      setSearchParams(searchParams)
                    }
                  }}
                >
                  <SelectTrigger className="w-full sm:w-[220px]">
                    <Building2 className="w-4 h-4 mr-2 text-muted-foreground" />
                    <SelectValue placeholder={t('adminOrders.allCompanies')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t('adminOrders.allCompanies')}</SelectItem>
                    {uniqueCompanies.map((company) => (
                      <SelectItem key={company} value={company}>
                        {company}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {companyFilter !== 'all' && (
                  <button
                    onClick={() => {
                      setCompanyFilter('all')
                      if (searchParams.has('company')) {
                        searchParams.delete('company')
                        setSearchParams(searchParams)
                      }
                    }}
                    className="absolute right-8 top-1/2 -translate-y-1/2 p-1 hover:bg-muted rounded-full"
                  >
                    <X className="w-3 h-3 text-muted-foreground" />
                  </button>
                )}
              </div>

              {/* Status Filter */}
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full sm:w-[180px]">
                  <SelectValue placeholder={t('adminOrders.allStatuses')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('adminOrders.allStatuses')}</SelectItem>
                  <SelectItem value="processing">{t('adminOrders.processing')}</SelectItem>
                  <SelectItem value="awaiting_payment">{t('adminOrders.awaitingPayment')}</SelectItem>
                  <SelectItem value="shipped">{t('adminOrders.shipped')}</SelectItem>
                  <SelectItem value="completed">{t('adminOrders.completedSent')}</SelectItem>
                  <SelectItem value="rejected">{t('adminOrders.rejected')}</SelectItem>
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

        </div>

        {/* Orders Table */}
        <div className="border rounded-lg bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('orders.orderNumber')}</TableHead>
                <TableHead>{t('orders.date')}</TableHead>
                <TableHead>{t('orders.companyName')}</TableHead>
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
                  <TableCell colSpan={8} className="text-center py-8">
                    {t('orders.loadingOrders')}
                  </TableCell>
                </TableRow>
              ) : filteredOrders.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8">
                    <div className="flex flex-col items-center gap-2">
                      <p className="text-muted-foreground">{t('orders.noOrdersFound')}</p>
                      {searchQuery || statusFilter !== 'all' || companyFilter !== 'all' || shippingFilter !== 'all' || dateFilter !== 'all' ? (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSearchQuery('')
                            setStatusFilter('all')
                            setCompanyFilter('all')
                            setShippingFilter('all')
                            setDateFilter('all')
                            // Clear URL params
                            if (searchParams.has('company') || searchParams.has('filter')) {
                              searchParams.delete('company')
                              searchParams.delete('filter')
                              setSearchParams(searchParams)
                            }
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
                  <TableRow key={order.id}>
                    <TableCell>
                      <span className="font-mono font-semibold text-primary">
                        #{order.order_number}
                      </span>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatOrderDate(order.created_at)}
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">{order.company_name}</div>
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
                    <TableCell>
                      <Select
                        value={order.status}
                        onValueChange={(value) =>
                          handleStatusChange(order.id, value as Order['status'])
                        }
                        disabled={updateStatusMutation.isPending}
                      >
                        <SelectTrigger className="w-[180px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="processing">{t('adminOrders.processing')}</SelectItem>
                          <SelectItem value="awaiting_payment">{t('adminOrders.awaitingPayment')}</SelectItem>
                          <SelectItem value="shipped">{t('adminOrders.shipped')}</SelectItem>
                          <SelectItem value="completed">{t('adminOrders.completedSent')}</SelectItem>
                          <SelectItem value="rejected">{t('adminOrders.rejected')}</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleViewDetails(order)}
                      >
                        <Eye className="w-4 h-4 mr-2" />
                        View Details
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Order Details Modal */}
      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          {selectedOrder && (
            <>
              <DialogHeader>
                <DialogTitle>
                  {t('orders.orderNumber')} {selectedOrder.order_number}
                </DialogTitle>
              </DialogHeader>

              <div className="space-y-6 mt-4">
                {/* Status and Order Info */}
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">{t('orders.status')}</p>
                    <Select
                      value={selectedOrder.status}
                      onValueChange={(value) => {
                        const updated = { ...selectedOrder, status: value as Order['status'] }
                        setSelectedOrder(updated)
                        handleStatusChange(selectedOrder.id, value as Order['status'])
                      }}
                      disabled={updateStatusMutation.isPending}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="processing">{t('orders.processing')}</SelectItem>
                        <SelectItem value="awaiting_payment">{t('orders.awaitingPayment')}</SelectItem>
                        <SelectItem value="shipped">{t('orders.shipped')}</SelectItem>
                        <SelectItem value="completed">{t('orders.completedSent')}</SelectItem>
                        <SelectItem value="rejected">{t('orders.rejected')}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">{t('orders.orderNo')}</p>
                    <p className="font-mono text-sm font-semibold">
                      #{selectedOrder.order_number}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">{t('orders.companyName')}</p>
                    <p className="text-sm font-medium">{selectedOrder.company_name}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">{t('general.date')}</p>
                    <p className="text-sm">{formatDateTime(selectedOrder.created_at)}</p>
                  </div>
                </div>

                {/* Shipping Method */}
                <div className="p-4 rounded-lg bg-muted/50 border">
                  <p className="text-sm text-muted-foreground mb-2">{t('orders.shipping')}</p>
                  <div className="flex flex-wrap items-center gap-3">
                    <ShippingMethodBadge method={selectedOrder.shipping_method} size="md" />
                    <span className="text-sm text-muted-foreground">
                      {SHIPPING_METHOD_CONFIG[selectedOrder.shipping_method || 'shop_delivery']?.label}
                    </span>
                  </div>
                </div>

                {/* Customer Info */}
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">{t('general.email')}</p>
                    <p className="text-sm">{selectedOrder.email}</p>
                  </div>
                  {selectedOrder.phone && (
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">{t('general.phone')}</p>
                      <p className="text-sm">{selectedOrder.phone}</p>
                    </div>
                  )}
                </div>

                {/* Order Items */}
                {selectedOrder.items && selectedOrder.items.length > 0 && (
                  <div>
                    <p className="text-sm text-muted-foreground mb-2">{t('orders.items')}</p>
                    <div className="space-y-2">
                      {selectedOrder.items.map((item, index) => (
                        <div
                          key={index}
                          className="flex flex-col gap-2 p-3 bg-muted rounded sm:flex-row sm:items-center sm:justify-between"
                        >
                          <div className="flex-1">
                            <p className="font-medium">{item.product_name}</p>
                            <p className="text-sm text-muted-foreground font-mono">
                              {t('products.sku')}: {item.sku}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {formatPrice(item.unit_price)} × {item.quantity}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="font-bold">{formatPrice(item.total)}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Total */}
                <div className="flex justify-between items-center pt-4 border-t">
                  <p className="text-lg font-semibold">{t('orders.total')}</p>
                  <p className="text-lg font-bold">{formatPrice(selectedOrder.total)}</p>
                </div>

                {/* Customer Notes */}
                {selectedOrder.notes && (
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Customer Notes</p>
                    <p className="text-sm whitespace-pre-wrap">{selectedOrder.notes}</p>
                  </div>
                )}

                <ShipmentPanel
                  seed={{
                    quoteId: selectedOrder.id,
                    orderNumber: selectedOrder.order_number,
                    receiverName: selectedOrder.company_name,
                    receiverPhone: selectedOrder.phone,
                    receiverEmail: selectedOrder.email,
                  }}
                />

                {/* Internal Notes (Admin Only) */}
                {supportsInternalNotes ? (
                  <div>
                    <Label htmlFor="internal-notes">Internal Notes</Label>
                    <Textarea
                      id="internal-notes"
                      value={selectedOrder.internal_notes || ''}
                      onChange={(e) => {
                        const updated = { ...selectedOrder, internal_notes: e.target.value }
                        setSelectedOrder(updated)
                      }}
                      onBlur={(e) => {
                        if (e.target.value !== (selectedOrder.internal_notes || '')) {
                          handleInternalNotesChange(e.target.value)
                        }
                      }}
                      placeholder="Add internal notes about this order (only visible to admins)..."
                      rows={4}
                      className="mt-2"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      These notes are only visible to admins and will not be shown to the customer.
                    </p>
                  </div>
                ) : (
                  <div className="rounded border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                    Internal notes are not available for this tenant yet (missing `quotes.internal_notes` migration).
                  </div>
                )}

                {/* PDF generation buttons removed from admin view.
                    Proforma invoices are generated only from company user accounts. */}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
