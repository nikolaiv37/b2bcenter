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
import { useAuth } from '@/hooks/useAuth'
import { Eye, AlertCircle, Image as ImageIcon, Filter } from 'lucide-react'
import { formatDate } from '@/lib/utils'
import { cn } from '@/lib/utils'

interface ComplaintItem {
  sku: string
  name: string
  quantity: number
}

interface Complaint {
  id: string
  order_id: string
  order_number?: number
  status: 'pending' | 'in-review' | 'approved' | 'rejected'
  items: ComplaintItem[]
  photos: string[]
  reason: string
  message: string
  created_at: string
  updated_at: string
}

function getStatusBadge(status: Complaint['status'] | string, t: (key: string) => string) {
  const configs: Record<string, { label: string; className: string }> = {
    pending: {
      label: t('complaints.pending'),
      className: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
    },
    'in-review': {
      label: t('complaints.inReview'),
      className: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    },
    approved: {
      label: t('complaints.approved'),
      className: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    },
    rejected: {
      label: t('complaints.rejected'),
      className: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    },
  }

  const config = configs[status]
  if (!config) {
    // Fallback for unknown status values
    return (
      <Badge variant="outline" className={cn('font-medium', 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400')}>
        {status}
      </Badge>
    )
  }

  return (
    <Badge variant="outline" className={cn('font-medium', config.className)}>
      {config.label}
    </Badge>
  )
}

function getReasonLabel(reason: string, t: (key: string) => string) {
  const labels: Record<string, string> = {
    damaged_transport: t('complaints.damagedTransport'),
    wrong_product: t('complaints.wrongProduct'),
    missing_parts: t('complaints.missingParts'),
    defective: t('complaints.defective'),
    other: t('complaints.other'),
  }
  return labels[reason] || reason
}

export function MyComplaintsTab() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const { workspaceId: tenantId } = useAppContext()
  const [selectedComplaint, setSelectedComplaint] = useState<Complaint | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [statusFilter, setStatusFilter] = useState<string>('all')

  const { data: complaints, isLoading } = useQuery({
    queryKey: ['workspace', 'complaints', user?.id],
    queryFn: async () => {
      if (!user?.id || !tenantId) return []

      const { data, error } = await supabase
        .from('complaints')
        .select('id, order_id, status, items, photos, reason, message, created_at, updated_at')
        .eq('user_id', user.id)
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false })

      if (error) {
        // If table doesn't exist, return empty array
        if (error.code === '42P01') {
          return []
        }
        throw error
      }

      const rows = (data as Complaint[] | null) || []
      const orderIds = Array.from(
        new Set(rows.map((complaint) => complaint.order_id).filter((id): id is string => !!id))
      )
      const orderNumberById = new Map<string, number>()

      if (orderIds.length > 0) {
        const { data: quotes, error: quoteError } = await supabase
          .from('quotes')
          .select('id, order_number')
          .in('id', orderIds)
          .eq('tenant_id', tenantId)

        if (quoteError && quoteError.code !== 'PGRST205') {
          console.warn('Error fetching quotes for complaints:', quoteError)
        } else {
          for (const quote of quotes || []) {
            if (quote?.id && typeof quote.order_number === 'number') {
              orderNumberById.set(String(quote.id), quote.order_number)
            }
          }
        }
      }

      return rows.map((complaint) => ({
        ...complaint,
        order_number: orderNumberById.get(String(complaint.order_id)) ?? null,
      })) as Complaint[]
    },
    enabled: !!user?.id && !!tenantId,
    staleTime: 60 * 1000,
    gcTime: 5 * 60 * 1000,
  })

  const handleViewComplaint = (complaint: Complaint) => {
    setSelectedComplaint(complaint)
    setDialogOpen(true)
  }

  // Calculate status counts
  const statusCounts = useMemo(() => {
    if (!complaints) return { pending: 0, 'in-review': 0, approved: 0, rejected: 0 }
    
    return {
      pending: complaints.filter(c => c.status === 'pending').length,
      'in-review': complaints.filter(c => c.status === 'in-review').length,
      approved: complaints.filter(c => c.status === 'approved').length,
      rejected: complaints.filter(c => c.status === 'rejected').length,
    }
  }, [complaints])

  // Filter complaints by status
  const filteredComplaints = useMemo(() => {
    if (!complaints) return []
    if (statusFilter === 'all') return complaints
    
    return complaints.filter(complaint => {
      // Map filter values to actual status values
      const statusMap: Record<string, string> = {
        'pending': 'pending',
        'in-review': 'in-review',
        'approved': 'approved',
        'rejected': 'rejected',
      }
      return complaint.status === statusMap[statusFilter]
    })
  }, [complaints, statusFilter])

  if (isLoading) {
    return (
      <GlassCard className="p-6">
        <div className="space-y-4">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      </GlassCard>
    )
  }

  if (!complaints || complaints.length === 0) {
    return (
      <GlassCard className="p-12">
        <div className="text-center">
          <AlertCircle className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
          <h3 className="text-xl font-semibold mb-2">{t('complaints.noComplaints')}</h3>
          <p className="text-muted-foreground">
            {t('complaints.noComplaintsDescription')}
          </p>
        </div>
      </GlassCard>
    )
  }

  return (
    <>
      <GlassCard className="p-6">
        {/* Status Count Badges and Filters */}
        <div className="mb-6 space-y-4">
          {/* Status Count Badges */}
          <div className="flex items-center gap-2 flex-wrap">
            {statusCounts.pending > 0 && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-yellow-500/10 border border-yellow-500/20 shadow-sm hover:bg-yellow-500/15 transition-colors cursor-pointer" onClick={() => setStatusFilter(statusFilter === 'pending' ? 'all' : 'pending')}>
                <div className="w-2.5 h-2.5 rounded-full bg-yellow-500 shadow-sm"></div>
                <span className="text-xs font-semibold text-yellow-700 dark:text-yellow-400">
                  {t('complaints.pending')}: {statusCounts.pending}
                </span>
              </div>
            )}
            {statusCounts['in-review'] > 0 && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/20 shadow-sm hover:bg-blue-500/15 transition-colors cursor-pointer" onClick={() => setStatusFilter(statusFilter === 'in-review' ? 'all' : 'in-review')}>
                <div className="w-2.5 h-2.5 rounded-full bg-blue-500 shadow-sm"></div>
                <span className="text-xs font-semibold text-blue-700 dark:text-blue-400">
                  {t('complaints.inReview')}: {statusCounts['in-review']}
                </span>
              </div>
            )}
            {statusCounts.approved > 0 && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-green-500/10 border border-green-500/20 shadow-sm hover:bg-green-500/15 transition-colors cursor-pointer" onClick={() => setStatusFilter(statusFilter === 'approved' ? 'all' : 'approved')}>
                <div className="w-2.5 h-2.5 rounded-full bg-green-500 shadow-sm"></div>
                <span className="text-xs font-semibold text-green-700 dark:text-green-400">
                  {t('complaints.approved')}: {statusCounts.approved}
                </span>
              </div>
            )}
            {statusCounts.rejected > 0 && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-red-500/10 border border-red-500/20 shadow-sm hover:bg-red-500/15 transition-colors cursor-pointer" onClick={() => setStatusFilter(statusFilter === 'rejected' ? 'all' : 'rejected')}>
                <div className="w-2.5 h-2.5 rounded-full bg-red-500 shadow-sm"></div>
                <span className="text-xs font-semibold text-red-700 dark:text-red-400">
                  {t('complaints.rejected')}: {statusCounts.rejected}
                </span>
              </div>
            )}
          </div>

          {/* Status Filter Buttons */}
          <div className="flex items-center gap-2 flex-wrap">
            <Filter className="w-4 h-4 text-muted-foreground" />
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider mr-1">
              {t('complaints.filterStatus')}:
            </span>
            <Button
              variant={statusFilter === 'all' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setStatusFilter('all')}
              className="h-8 rounded-lg"
            >
              {t('complaints.allStatuses')}
            </Button>
            <Button
              variant={statusFilter === 'pending' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setStatusFilter('pending')}
              className="h-8 rounded-lg"
            >
              {t('complaints.pending')}
            </Button>
            <Button
              variant={statusFilter === 'in-review' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setStatusFilter('in-review')}
              className="h-8 rounded-lg"
            >
              {t('complaints.inReview')}
            </Button>
            <Button
              variant={statusFilter === 'approved' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setStatusFilter('approved')}
              className="h-8 rounded-lg"
            >
              {t('complaints.approved')}
            </Button>
            <Button
              variant={statusFilter === 'rejected' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setStatusFilter('rejected')}
              className="h-8 rounded-lg"
            >
              {t('complaints.rejected')}
            </Button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('complaints.orderNumber')}</TableHead>
                <TableHead>{t('complaints.date')}</TableHead>
                <TableHead>{t('complaints.orderId')}</TableHead>
                <TableHead>{t('complaints.status')}</TableHead>
                <TableHead>{t('complaints.items')}</TableHead>
                <TableHead>{t('complaints.actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredComplaints.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8">
                    <p className="text-muted-foreground">
                      {statusFilter === 'all' 
                        ? t('complaints.noComplaints')
                        : t('complaints.noComplaintsFound')}
                    </p>
                    {statusFilter !== 'all' && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setStatusFilter('all')}
                        className="mt-3"
                      >
                        {t('complaints.showAll')}
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ) : (
                filteredComplaints.map((complaint) => (
                  <TableRow key={complaint.id}>
                    <TableCell className="font-mono text-sm">
                      #{complaint.id.slice(0, 8)}
                    </TableCell>
                    <TableCell>{formatDate(complaint.created_at)}</TableCell>
                    <TableCell className="font-mono text-sm">
                      {complaint.order_number
                        ? `#${complaint.order_number}`
                        : complaint.order_id.slice(0, 8)}
                    </TableCell>
                    <TableCell>{getStatusBadge(complaint.status, t)}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">
                        {t('complaints.itemsCount', { count: complaint.items?.length || 0 })}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleViewComplaint(complaint)}
                      >
                        <Eye className="w-4 h-4 mr-2" />
                        {t('complaints.view')}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </GlassCard>

      {/* Complaint Detail Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          {selectedComplaint && (
            <>
              <DialogHeader>
                <DialogTitle>
                  {t('complaints.complaintNumber', { id: selectedComplaint.id.slice(0, 8) })}
                </DialogTitle>
              </DialogHeader>

              <div className="space-y-6 mt-4">
                {/* Status and Order Info */}
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">{t('complaints.status')}</p>
                    {getStatusBadge(selectedComplaint.status, t)}
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">{t('complaints.orderId')}</p>
                    <p className="font-mono text-sm">
                      {selectedComplaint.order_number
                        ? `#${selectedComplaint.order_number}`
                        : selectedComplaint.order_id}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">{t('complaints.created')}</p>
                    <p className="text-sm">{formatDate(selectedComplaint.created_at)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">{t('complaints.lastUpdated')}</p>
                    <p className="text-sm">{formatDate(selectedComplaint.updated_at)}</p>
                  </div>
                </div>

                {/* Reason */}
                <div>
                  <p className="text-sm text-muted-foreground mb-1">{t('complaints.reason')}</p>
                  <p className="font-medium">{getReasonLabel(selectedComplaint.reason, t)}</p>
                </div>

                {/* Items */}
                {selectedComplaint.items && selectedComplaint.items.length > 0 && (
                  <div>
                    <p className="text-sm text-muted-foreground mb-2">{t('complaints.items')}</p>
                    <div className="space-y-2">
                      {selectedComplaint.items.map((item, index) => (
                        <div
                          key={index}
                          className="flex flex-col gap-2 p-3 bg-muted rounded sm:flex-row sm:items-center sm:justify-between"
                        >
                          <div>
                            <p className="font-medium">{item.name}</p>
                            <p className="text-sm text-muted-foreground font-mono">
                              {t('products.sku')}: {item.sku}
                            </p>
                          </div>
                          <Badge variant="secondary">{t('complaints.quantityShort', { count: item.quantity })}</Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Description */}
                {selectedComplaint.message && (
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">{t('complaints.description')}</p>
                    <p className="text-sm whitespace-pre-wrap">{selectedComplaint.message}</p>
                  </div>
                )}

                {/* Photos */}
                {selectedComplaint.photos && selectedComplaint.photos.length > 0 && (
                  <div>
                    <p className="text-sm text-muted-foreground mb-2">{t('complaints.photos')}</p>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                      {selectedComplaint.photos.map((photo, index) => (
                        <div key={index} className="relative group">
                          <img
                            src={photo}
                            alt={t('complaints.photoAlt', { index: index + 1 })}
                            className="w-full h-32 object-cover rounded border"
                          />
                          <a
                            href={photo}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded"
                          >
                            <ImageIcon className="w-6 h-6 text-white" />
                          </a>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
