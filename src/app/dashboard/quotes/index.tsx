import { useState } from 'react'
import { useAppContext } from '@/lib/app/AppContext'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase/client'
import { GlassCard } from '@/components/GlassCard'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { OrderStatusBadge } from '@/components/OrderStatusBadge'
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
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { useAuth } from '@/hooks/useAuth'
import { useMutationUpdateQuoteStatus } from '@/hooks/useMutationQuote'
import { formatCurrency, formatDate } from '@/lib/utils'
import { Quote } from '@/types'
import { Search, CheckCircle2, XCircle, Eye } from 'lucide-react'
import { useToast } from '@/components/ui/use-toast'
import { useTranslation } from 'react-i18next'

export function QuotesPage() {
  const { t } = useTranslation()
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedQuote, setSelectedQuote] = useState<Quote | null>(null)
  const [detailsOpen, setDetailsOpen] = useState(false)
  const { user, isAdmin } = useAuth()
  const { toast } = useToast()
  const { workspaceId: tenantId } = useAppContext()
  const updateStatusMutation = useMutationUpdateQuoteStatus()

  const { data: quotes, isLoading } = useQuery({
    queryKey: ['workspace', 'quotes', user?.id, isAdmin],
    queryFn: async () => {
      if (!tenantId) return []

      let query = supabase
        .from('quotes')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false })

      if (!isAdmin && user?.id) {
        query = query.eq('user_id', user.id)
      }

      const { data, error } = await query

      if (error) throw error
      return data as Quote[]
    },
    enabled: !!tenantId && (isAdmin || !!user?.id),
  })

  const filteredQuotes = quotes?.filter(
    (quote) =>
      quote.customer_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      quote.customer_email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      quote.id.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const handleApprove = async (quoteId: string) => {
    try {
      await updateStatusMutation.mutateAsync({ quoteId, status: 'approved' })
      toast({
        title: t('quotes.approved'),
        description: t('quotes.customerNotified'),
      })
      setDetailsOpen(false)
    } catch (error) {
      toast({
        title: t('general.error'),
        description: t('quotes.approveFailed'),
        variant: 'destructive',
      })
    }
  }

  const handleReject = async (quoteId: string) => {
    try {
      await updateStatusMutation.mutateAsync({
        quoteId,
        status: 'rejected',
        reason: t('quotes.rejectionReason'),
      })
      toast({
        title: t('quotes.rejected'),
        description: t('quotes.customerNotified'),
      })
      setDetailsOpen(false)
    } catch (error) {
      toast({
        title: t('general.error'),
        description: t('quotes.rejectFailed'),
        variant: 'destructive',
      })
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-2">{t('quotes.title')}</h1>
          <p className="text-muted-foreground">
            {t('quotes.subtitle')}
          </p>
        </div>
      </div>

      <GlassCard>
        <div className="mb-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <Input
              placeholder={t('quotes.searchPlaceholder')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : filteredQuotes && filteredQuotes.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('quotes.quoteId')}</TableHead>
                <TableHead>{t('quotes.customer')}</TableHead>
                <TableHead>{t('quotes.items')}</TableHead>
                <TableHead>{t('general.total')}</TableHead>
                <TableHead>{t('general.status')}</TableHead>
                <TableHead>{t('general.date')}</TableHead>
                <TableHead className="text-right">{t('general.actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredQuotes.map((quote) => (
                <TableRow key={quote.id}>
                  <TableCell>
                    <code className="text-sm">{quote.id.slice(0, 8)}</code>
                  </TableCell>
                  <TableCell>
                    <div>
                      <p className="font-semibold">
                        {quote.customer_name || t('general.notAvailable')}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {quote.customer_email}
                      </p>
                    </div>
                  </TableCell>
                  <TableCell>{t('quotes.itemsCount', { count: quote.items?.length || 0 })}</TableCell>
                  <TableCell className="font-semibold">
                    {formatCurrency(quote.total)}
                  </TableCell>
                  <TableCell>
                    <OrderStatusBadge status={quote.status} />
                  </TableCell>
                  <TableCell>{formatDate(quote.created_at)}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          setSelectedQuote(quote)
                          setDetailsOpen(true)
                        }}
                      >
                        <Eye className="w-4 h-4" />
                      </Button>
                      {quote.status === 'awaiting_payment' && (
                        <>
                          <Button
                            size="sm"
                            variant="default"
                            onClick={() => handleApprove(quote.id)}
                            disabled={updateStatusMutation.isPending}
                          >
                            <CheckCircle2 className="w-4 h-4 mr-1" />
                            {t('quotes.approve')}
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => handleReject(quote.id)}
                            disabled={updateStatusMutation.isPending}
                          >
                            <XCircle className="w-4 h-4 mr-1" />
                            {t('quotes.reject')}
                          </Button>
                        </>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <div className="text-center py-12">
            <Search className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-semibold mb-2">{t('quotes.noneFound')}</h3>
            <p className="text-muted-foreground">
              {searchQuery
                ? t('quotes.adjustSearch')
                : t('quotes.emptyState')}
            </p>
          </div>
        )}
      </GlassCard>

      {/* Quote Details Dialog */}
      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent className="sm:max-w-[600px] glass">
          <DialogHeader>
            <DialogTitle>{t('quotes.detailsTitle')}</DialogTitle>
            <DialogDescription>
              {t('quotes.quoteId')}: {selectedQuote?.id.slice(0, 8)}
            </DialogDescription>
          </DialogHeader>

          {selectedQuote && (
            <div className="space-y-4">
              <div className="glass-card p-4 space-y-3">
                <div>
                  <p className="text-sm text-muted-foreground">{t('quotes.customer')}</p>
                  <p className="font-semibold">{selectedQuote.customer_name}</p>
                  <p className="text-sm">{selectedQuote.customer_email}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">{t('general.status')}</p>
                  <OrderStatusBadge status={selectedQuote.status} />
                </div>
              </div>

              <div className="glass-card p-4">
                <h4 className="font-semibold mb-3">{t('quotes.items')}</h4>
                <div className="space-y-2">
                  {selectedQuote.items.map((item, index) => (
                    <div
                      key={index}
                      className="flex justify-between items-center"
                    >
                      <div>
                        <p className="font-medium">{item.product_name}</p>
                        <p className="text-sm text-muted-foreground">
                          {t('quotes.quantityLine', { count: item.quantity, price: formatCurrency(item.unit_price) })}
                        </p>
                      </div>
                      <p className="font-semibold">
                        {formatCurrency(item.total)}
                      </p>
                    </div>
                  ))}
                </div>
                <div className="border-t mt-3 pt-3 flex justify-between">
                  <span className="font-bold">{t('general.total')}</span>
                  <span className="font-bold text-lg">
                    {formatCurrency(selectedQuote.total)}
                  </span>
                </div>
              </div>

              {selectedQuote.notes && (
                <div className="glass-card p-4">
                  <p className="text-sm text-muted-foreground mb-1">{t('general.notes')}</p>
                  <p className="text-sm">{selectedQuote.notes}</p>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setDetailsOpen(false)}>
              {t('general.close')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
