import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { format } from 'date-fns'
import { bg, enUS } from 'date-fns/locale'
import { supabase } from '@/lib/supabase/client'
import { useAppContext } from '@/lib/app/AppContext'
import { useTenantPath } from '@/lib/tenant/TenantProvider'
import { getCarrierAdapter } from '@/lib/shipping/carriers/registry'
import { GlassCard } from '@/components/GlassCard'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { useToast } from '@/components/ui/use-toast'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Tooltip } from '@/components/ui/tooltip'
import {
  PackageOpen,
  Search,
  RefreshCw,
  Printer,
  Trash2,
  ExternalLink,
  Loader2,
  AlertCircle,
} from 'lucide-react'

// Statuses present in the shipments table (see shipments_status_check). We only
// list shipments that actually became waybills (econt_waybill_number set), so
// draft/calculated are intentionally absent from the status filter.
const WAYBILL_STATUSES = ['created', 'in_transit', 'delivered', 'returned', 'cancelled', 'error'] as const
type WaybillStatus = (typeof WAYBILL_STATUSES)[number]

// A waybill may only be cancelled/deleted while still cancellable in Econt.
const CANCELLABLE_STATUSES = new Set<string>(['created'])

interface WaybillReceiver {
  name?: string | null
  phone?: string | null
  email?: string | null
}

interface WaybillDestination {
  type?: 'office' | 'address' | string | null
  officeCode?: string | null
  address?: { city?: string | null } | null
}

interface ShipmentRow {
  id: string
  tenant_id: string
  quote_id: number | null
  carrier: string
  status: string
  receiver: WaybillReceiver | null
  destination: WaybillDestination | null
  price_amount: number | null
  currency: string | null
  econt_waybill_number: string | null
  econt_label_data: Record<string, unknown> | null
  pdf_url?: string | null
  print_url?: string | null
  created_at: string
}

interface QuoteMeta {
  id: number
  order_number: number | null
  company_name: string | null
}

function pickStr(...vals: unknown[]): string | null {
  for (const v of vals) {
    if (typeof v === 'string' && v.trim()) return v.trim()
  }
  return null
}

function readLabelData(shipment: ShipmentRow): Record<string, unknown> {
  return shipment.econt_label_data && typeof shipment.econt_label_data === 'object'
    ? (shipment.econt_label_data as Record<string, unknown>)
    : {}
}

function getLabelUrl(shipment: ShipmentRow): string | null {
  const labelData = readLabelData(shipment)
  return (
    pickStr(shipment.print_url) ||
    pickStr(shipment.pdf_url) ||
    pickStr(labelData.printUrl, labelData.print_url) ||
    pickStr(labelData.pdfUrl, labelData.pdf_url)
  )
}

function getPayer(shipment: ShipmentRow): 'SENDER' | 'RECEIVER' | null {
  const value = pickStr(readLabelData(shipment).shipment_payer)
  if (value === 'SENDER' || value === 'RECEIVER') return value
  return null
}

function statusBadgeVariant(status: string): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (status) {
    case 'delivered':
      return 'default'
    case 'created':
    case 'in_transit':
      return 'secondary'
    case 'cancelled':
    case 'error':
    case 'returned':
      return 'destructive'
    default:
      return 'outline'
  }
}

export function WaybillsPage() {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const { withBase } = useTenantPath()
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const { workspaceId: tenantId, currentAccount } = useAppContext()
  const isAdmin = currentAccount.isAdmin
  const dateLocale = i18n.resolvedLanguage === 'bg' ? bg : enUS

  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<WaybillStatus | 'all'>('all')
  const [pendingDelete, setPendingDelete] = useState<ShipmentRow | null>(null)
  const [trackingId, setTrackingId] = useState<string | null>(null)

  // Admin-only page. Members/clients are redirected to the dashboard. The
  // shipments RLS policy itself is tenant-wide (not admin-scoped), so this
  // gate is the access control for the waybills view.
  useEffect(() => {
    if (!isAdmin) navigate(withBase('/dashboard'))
  }, [isAdmin, navigate, withBase])

  const adapter = useMemo(() => (tenantId ? getCarrierAdapter(tenantId, 'econt') : null), [tenantId])

  const shipmentsQuery = useQuery({
    queryKey: ['workspace', 'waybills', 'econt', tenantId],
    queryFn: async () => {
      if (!tenantId) return [] as ShipmentRow[]
      // Tenant-scoped; only rows that actually produced a waybill number.
      const { data, error } = await supabase
        .from('shipments')
        .select(
          'id, tenant_id, quote_id, carrier, status, receiver, destination, price_amount, currency, econt_waybill_number, econt_label_data, pdf_url, print_url, created_at',
        )
        .eq('tenant_id', tenantId)
        .eq('carrier', 'econt')
        .not('econt_waybill_number', 'is', null)
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data || []) as ShipmentRow[]
    },
    enabled: !!tenantId && isAdmin,
    staleTime: 15_000,
  })

  const quoteIds = useMemo(() => {
    const ids = new Set<number>()
    for (const s of shipmentsQuery.data ?? []) {
      if (typeof s.quote_id === 'number') ids.add(s.quote_id)
    }
    return Array.from(ids)
  }, [shipmentsQuery.data])

  // Enrich with order number + company name from the linked quote. Separate
  // query (rather than a PostgREST embed) keeps it resilient to RLS/embed quirks
  // and mirrors the existing orders view pattern.
  const quotesQuery = useQuery({
    queryKey: ['workspace', 'waybills', 'quotes', tenantId, quoteIds],
    queryFn: async () => {
      if (!tenantId || quoteIds.length === 0) return new Map<number, QuoteMeta>()
      const { data, error } = await supabase
        .from('quotes')
        .select('id, order_number, company_name')
        .in('id', quoteIds)
      if (error) throw error
      const map = new Map<number, QuoteMeta>()
      for (const row of (data || []) as QuoteMeta[]) map.set(row.id, row)
      return map
    },
    enabled: !!tenantId && isAdmin && quoteIds.length > 0,
    staleTime: 30_000,
  })

  const quotesMap = quotesQuery.data ?? new Map<number, QuoteMeta>()

  const invalidate = async () => {
    await queryClient.invalidateQueries({ queryKey: ['workspace', 'waybills', 'econt', tenantId] })
  }

  const trackMutation = useMutation({
    mutationFn: async (shipment: ShipmentRow) => {
      if (!tenantId || !adapter) throw new Error('No carrier adapter')
      setTrackingId(shipment.id)
      return adapter.track({ tenantId, shipmentId: shipment.id })
    },
    onSuccess: async (result) => {
      if (result.throttled) {
        toast({
          title: t('waybills.toasts.trackThrottledTitle'),
          description: t('waybills.toasts.trackThrottledDescription', {
            minutes: result.retry_after_minutes ?? 1,
          }),
        })
        return
      }
      toast({
        title: t('waybills.toasts.trackSuccessTitle'),
        description: result.result?.status_name || result.result?.status || '',
      })
      await invalidate()
    },
    onError: (error: Error) => {
      toast({
        title: t('waybills.toasts.trackErrorTitle'),
        description: error.message,
        variant: 'destructive',
      })
    },
    onSettled: () => setTrackingId(null),
  })

  const deleteMutation = useMutation({
    mutationFn: async (shipment: ShipmentRow) => {
      if (!tenantId || !adapter?.deleteLabel) throw new Error('No carrier adapter')
      await adapter.deleteLabel({ tenantId, shipmentId: shipment.id })
    },
    onSuccess: async () => {
      toast({
        title: t('waybills.toasts.cancelSuccessTitle'),
        description: t('waybills.toasts.cancelSuccessDescription'),
      })
      setPendingDelete(null)
      await invalidate()
    },
    onError: (error: Error) => {
      toast({
        title: t('waybills.toasts.cancelErrorTitle'),
        description: error.message,
        variant: 'destructive',
      })
    },
  })

  const rows = useMemo(() => {
    const all = shipmentsQuery.data ?? []
    const query = searchQuery.trim().toLowerCase()
    return all.filter((s) => {
      if (statusFilter !== 'all' && s.status !== statusFilter) return false
      if (!query) return true
      const quote = s.quote_id != null ? quotesMap.get(s.quote_id) : undefined
      const haystack = [
        s.econt_waybill_number,
        quote?.order_number != null ? String(quote.order_number) : null,
        quote?.company_name,
        s.receiver?.name,
        s.receiver?.phone,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      return haystack.includes(query)
    })
  }, [shipmentsQuery.data, searchQuery, statusFilter, quotesMap])

  if (!isAdmin) return null

  const isLoading = shipmentsQuery.isLoading
  const isError = shipmentsQuery.isError

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <PackageOpen className="h-6 w-6" />
        <div>
          <h1 className="text-2xl font-bold">{t('waybills.title')}</h1>
          <p className="text-sm text-muted-foreground">{t('waybills.subtitle')}</p>
        </div>
      </div>

      <GlassCard className="p-4 space-y-4">
        {/* Filters */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('waybills.searchPlaceholder')}
              className="pl-9"
            />
          </div>
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as WaybillStatus | 'all')}>
            <SelectTrigger className="sm:w-56">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('waybills.filters.allStatuses')}</SelectItem>
              {WAYBILL_STATUSES.map((status) => (
                <SelectItem key={status} value={status}>
                  {t(`waybills.status.${status}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="icon"
            onClick={() => shipmentsQuery.refetch()}
            disabled={shipmentsQuery.isFetching}
            aria-label={t('waybills.actions.refreshList')}
          >
            <RefreshCw className={shipmentsQuery.isFetching ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />
          </Button>
        </div>

        {/* States */}
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : isError ? (
          <div className="flex items-center gap-2 rounded border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            <AlertCircle className="h-4 w-4" />
            {t('waybills.errorLoading')}
          </div>
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
            <PackageOpen className="h-10 w-10 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">{t('waybills.empty')}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('waybills.columns.created')}</TableHead>
                  <TableHead>{t('waybills.columns.waybill')}</TableHead>
                  <TableHead>{t('waybills.columns.order')}</TableHead>
                  <TableHead>{t('waybills.columns.company')}</TableHead>
                  <TableHead>{t('waybills.columns.recipient')}</TableHead>
                  <TableHead>{t('waybills.columns.delivery')}</TableHead>
                  <TableHead>{t('waybills.columns.payer')}</TableHead>
                  <TableHead>{t('waybills.columns.status')}</TableHead>
                  <TableHead className="text-right">{t('waybills.columns.actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((shipment) => {
                  const quote = shipment.quote_id != null ? quotesMap.get(shipment.quote_id) : undefined
                  const labelUrl = getLabelUrl(shipment)
                  const payer = getPayer(shipment)
                  const destType = shipment.destination?.type
                  const canCancel = CANCELLABLE_STATUSES.has(shipment.status)
                  const isTracking = trackingId === shipment.id && trackMutation.isPending

                  return (
                    <TableRow key={shipment.id}>
                      <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                        {format(new Date(shipment.created_at), 'dd.MM.yyyy HH:mm', { locale: dateLocale })}
                      </TableCell>
                      <TableCell className="font-mono text-sm font-medium">
                        {shipment.econt_waybill_number || '—'}
                      </TableCell>
                      <TableCell>
                        {quote?.order_number != null ? `#${quote.order_number}` : '—'}
                      </TableCell>
                      <TableCell className="max-w-[180px] truncate">
                        {quote?.company_name || '—'}
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">{shipment.receiver?.name || '—'}</div>
                        {shipment.receiver?.phone ? (
                          <div className="text-xs text-muted-foreground">{shipment.receiver.phone}</div>
                        ) : null}
                      </TableCell>
                      <TableCell>
                        {destType === 'office'
                          ? t('waybills.delivery.office')
                          : destType === 'address'
                            ? t('waybills.delivery.address')
                            : '—'}
                      </TableCell>
                      <TableCell>
                        {payer === 'SENDER'
                          ? t('waybills.payer.sender')
                          : payer === 'RECEIVER'
                            ? t('waybills.payer.receiver')
                            : '—'}
                      </TableCell>
                      <TableCell>
                        <Badge variant={statusBadgeVariant(shipment.status)}>
                          {t(`waybills.status.${shipment.status}`, { defaultValue: shipment.status })}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end gap-1">
                          {/* Open related order */}
                          <Tooltip content={t('waybills.actions.openOrder')}>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              disabled={quote?.order_number == null}
                              onClick={() =>
                                navigate(withBase(`/dashboard/orders?newOrder=${quote?.order_number}`))
                              }
                              aria-label={t('waybills.actions.openOrder')}
                            >
                              <ExternalLink className="h-4 w-4" />
                            </Button>
                          </Tooltip>

                          {/* Track / refresh status */}
                          <Tooltip content={t('waybills.actions.track')}>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              disabled={isTracking}
                              onClick={() => trackMutation.mutate(shipment)}
                              aria-label={t('waybills.actions.track')}
                            >
                              {isTracking ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <RefreshCw className="h-4 w-4" />
                              )}
                            </Button>
                          </Tooltip>

                          {/* Print / open label */}
                          <Tooltip content={t('waybills.actions.printLabel')}>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              disabled={!labelUrl}
                              onClick={() => labelUrl && window.open(labelUrl, '_blank', 'noopener,noreferrer')}
                              aria-label={t('waybills.actions.printLabel')}
                            >
                              <Printer className="h-4 w-4" />
                            </Button>
                          </Tooltip>

                          {/* Cancel / delete */}
                          <Tooltip content={t('waybills.actions.cancel')}>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-red-600 hover:text-red-700"
                              disabled={!canCancel}
                              onClick={() => setPendingDelete(shipment)}
                              aria-label={t('waybills.actions.cancel')}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </Tooltip>
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </GlassCard>

      {/* Cancel/delete confirmation */}
      <Dialog open={!!pendingDelete} onOpenChange={(open) => !open && setPendingDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('waybills.cancelDialog.title')}</DialogTitle>
            <DialogDescription>
              {t('waybills.cancelDialog.description', {
                waybill: pendingDelete?.econt_waybill_number || '',
              })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPendingDelete(null)} disabled={deleteMutation.isPending}>
              {t('waybills.cancelDialog.keep')}
            </Button>
            <Button
              variant="destructive"
              onClick={() => pendingDelete && deleteMutation.mutate(pendingDelete)}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="mr-2 h-4 w-4" />
              )}
              {t('waybills.cancelDialog.confirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default WaybillsPage
