import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { useAllCompanyUnpaidBalances } from '@/hooks/useCompanyUnpaidBalances'
import { useTenantPath } from '@/lib/tenant/TenantProvider'
import { GlassCard } from '@/components/GlassCard'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { formatCurrency } from '@/lib/utils'
import {
  AlertTriangle,
  CreditCard,
  ArrowLeft,
  Search,
  SortAsc,
  SortDesc,
} from 'lucide-react'
import { useState, useMemo } from 'react'
import { Input } from '@/components/ui/input'

type SortField = 'unpaidAmount' | 'orderCount' | 'lastOrderDate' | 'companyName'
type SortDirection = 'asc' | 'desc'

export function UnpaidBalancesPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { withBase } = useTenantPath()
  const { isAdmin } = useAuth()
  const { data, isLoading, error } = useAllCompanyUnpaidBalances()
  
  const [searchQuery, setSearchQuery] = useState('')
  const [sortField, setSortField] = useState<SortField>('unpaidAmount')
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc')

  // Filter and sort companies
  const filteredAndSortedCompanies = useMemo(() => {
    if (!data?.companies) return []
    
    const filtered = data.companies.filter((company) => {
      const searchLower = searchQuery.toLowerCase()
      return (
        company.companyName.toLowerCase().includes(searchLower) ||
        company.email.toLowerCase().includes(searchLower)
      )
    })
    
    // Sort
    const sorted = [...filtered].sort((a, b) => {
      let comparison = 0
      
      switch (sortField) {
        case 'unpaidAmount':
          comparison = a.unpaidAmount - b.unpaidAmount
          break
        case 'orderCount':
          comparison = a.orderCount - b.orderCount
          break
        case 'lastOrderDate':
          comparison = new Date(a.lastOrderDate).getTime() - new Date(b.lastOrderDate).getTime()
          break
        case 'companyName':
          comparison = (a.companyName || a.email).localeCompare(b.companyName || b.email)
          break
      }
      
      return sortDirection === 'desc' ? -comparison : comparison
    })
    
    return sorted
  }, [data?.companies, searchQuery, sortField, sortDirection])

  // Redirect non-admins
  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-muted-foreground">
        <AlertTriangle className="w-12 h-12 mb-4 text-amber-500" />
        <h2 className="text-xl font-semibold mb-2">{t('unpaidBalances.accessDenied')}</h2>
        <p className="text-sm mb-4">{t('unpaidBalances.adminOnly')}</p>
        <Button onClick={() => navigate(withBase('/dashboard'))}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          {t('unpaidBalances.backToDashboard')}
        </Button>
      </div>
    )
  }

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'desc' ? 'asc' : 'desc')
    } else {
      setSortField(field)
      setSortDirection('desc')
    }
  }

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return null
    return sortDirection === 'desc' ? (
      <SortDesc className="w-3.5 h-3.5 ml-1" />
    ) : (
      <SortAsc className="w-3.5 h-3.5 ml-1" />
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-muted-foreground">
        <AlertTriangle className="w-12 h-12 mb-4 text-red-500" />
        <h2 className="text-xl font-semibold mb-2">{t('unpaidBalances.errorLoadingData')}</h2>
        <p className="text-sm mb-4">{t('unpaidBalances.failedToLoad')}</p>
        <Button onClick={() => window.location.reload()}>{t('unpaidBalances.retry')}</Button>
      </div>
    )
  }

  return (
    <div className="space-y-6 pb-24 md:pb-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate(withBase('/dashboard'))}
              className="gap-1.5"
            >
              <ArrowLeft className="w-4 h-4" />
              {t('general.back')}
            </Button>
          </div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
            {t('unpaidBalances.title')}
          </h1>
          <p className="text-muted-foreground mt-1">
            {t('unpaidBalances.subtitle')}
          </p>
        </div>
        
        {/* Summary Stats */}
        {data && !isLoading && (
          <div className="flex items-center gap-4">
            <GlassCard className="px-4 py-3">
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">{t('unpaidBalances.totalUnpaid')}</p>
              <p className="text-2xl font-bold text-amber-500">
                {formatCurrency(data.totalUnpaidAmount, 'EUR')}
              </p>
            </GlassCard>
            <GlassCard className="px-4 py-3">
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">{t('unpaidBalances.companies')}</p>
              <p className="text-2xl font-bold">{data.companies.length}</p>
            </GlassCard>
            <GlassCard className="px-4 py-3">
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">{t('unpaidBalances.orders')}</p>
              <p className="text-2xl font-bold">{data.totalOrdersCount}</p>
            </GlassCard>
          </div>
        )}
      </div>

      {/* Main Content */}
      <GlassCard className="border border-white/10 dark:border-white/5">
        {/* Search and Filters */}
        <div className="flex flex-col md:flex-row md:items-center gap-4 mb-6 pb-4 border-b border-white/10 dark:border-white/5">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder={t('unpaidBalances.searchPlaceholder')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 bg-white/5 dark:bg-black/5 border-white/10 dark:border-white/5"
            />
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>{t('unpaidBalances.showing')} {filteredAndSortedCompanies.length} {t('unpaidBalances.of')} {data?.companies.length || 0} {t('unpaidBalances.companies')}</span>
          </div>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 10 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full rounded-lg" />
            ))}
          </div>
        ) : filteredAndSortedCompanies.length > 0 ? (
          <>
            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="text-left text-xs text-muted-foreground uppercase tracking-wider border-b border-white/10 dark:border-white/5">
                    <th 
                      className="pb-3 font-medium cursor-pointer hover:text-foreground transition-colors"
                      onClick={() => handleSort('companyName')}
                    >
                      <div className="flex items-center">
                        {t('unpaidBalances.company')}
                        <SortIcon field="companyName" />
                      </div>
                    </th>
                    <th 
                      className="pb-3 font-medium text-right cursor-pointer hover:text-foreground transition-colors"
                      onClick={() => handleSort('unpaidAmount')}
                    >
                      <div className="flex items-center justify-end">
                        {t('unpaidBalances.unpaidAmount')}
                        <SortIcon field="unpaidAmount" />
                      </div>
                    </th>
                    <th 
                      className="pb-3 font-medium text-center cursor-pointer hover:text-foreground transition-colors"
                      onClick={() => handleSort('orderCount')}
                    >
                      <div className="flex items-center justify-center">
                        {t('unpaidBalances.orders')}
                        <SortIcon field="orderCount" />
                      </div>
                    </th>
                    <th 
                      className="pb-3 font-medium text-right cursor-pointer hover:text-foreground transition-colors"
                      onClick={() => handleSort('lastOrderDate')}
                    >
                      <div className="flex items-center justify-end">
                        {t('unpaidBalances.lastOrder')}
                        <SortIcon field="lastOrderDate" />
                      </div>
                    </th>
                    <th className="pb-3 font-medium text-right">{t('unpaidBalances.actions')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 dark:divide-white/5">
                  {filteredAndSortedCompanies.map((company, index) => {
                    const isHighAmount = company.unpaidAmount >= 5000
                    const isMediumAmount = company.unpaidAmount >= 1000 && company.unpaidAmount < 5000
                    
                    return (
                      <tr
                        key={company.email || company.companyName || index}
                        className="hover:bg-white/5 dark:hover:bg-black/5 transition-colors"
                      >
                        <td className="py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center text-sm font-semibold text-primary">
                              {(company.companyName || company.email || 'U').charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <p className="font-medium">{company.companyName || t('unpaidBalances.unknownCompany')}</p>
                              {company.email && (
                                <p className="text-xs text-muted-foreground">{company.email}</p>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="py-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            {isHighAmount && <AlertTriangle className="w-4 h-4 text-red-500" />}
                            <span className={`font-semibold text-lg ${isHighAmount ? 'text-red-500' : isMediumAmount ? 'text-amber-500' : 'text-foreground'}`}>
                              {formatCurrency(company.unpaidAmount, 'EUR')}
                            </span>
                          </div>
                        </td>
                        <td className="py-4 text-center">
                          <Badge variant="outline" className="bg-white/5 dark:bg-black/5 text-sm">
                            {company.orderCount} {company.orderCount === 1 ? t('unpaidBalances.order') : t('unpaidBalances.orders')}
                          </Badge>
                        </td>
                        <td className="py-4 text-right text-sm text-muted-foreground">
                          {new Date(company.lastOrderDate).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })}
                        </td>
                        <td className="py-4 text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              navigate(
                                `${withBase('/dashboard/orders')}?company=${encodeURIComponent(company.companyName || company.email)}&filter=pending`
                              )
                            }
                            className="text-xs"
                          >
                            {t('unpaidBalances.viewOrders')}
                          </Button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            
            {/* Mobile Card View */}
            <div className="md:hidden space-y-3">
              {filteredAndSortedCompanies.map((company, index) => {
                const isHighAmount = company.unpaidAmount >= 5000
                const isMediumAmount = company.unpaidAmount >= 1000 && company.unpaidAmount < 5000
                
                return (
                  <div
                    key={company.email || company.companyName || index}
                    onClick={() =>
                      navigate(
                        `${withBase('/dashboard/orders')}?company=${encodeURIComponent(company.companyName || company.email)}&filter=pending`
                      )
                    }
                    className="p-4 rounded-lg bg-white/5 dark:bg-black/5 hover:bg-white/10 dark:hover:bg-black/10 transition-all duration-200 border border-white/10 dark:border-white/5 cursor-pointer"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="w-11 h-11 rounded-lg bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center text-base font-semibold text-primary">
                          {(company.companyName || company.email || 'U').charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-medium">{company.companyName || t('unpaidBalances.unknownCompany')}</p>
                          {company.email && (
                            <p className="text-xs text-muted-foreground truncate max-w-[200px]">{company.email}</p>
                          )}
                        </div>
                      </div>
                      {isHighAmount && <AlertTriangle className="w-5 h-5 text-red-500" />}
                    </div>
                    <div className="flex items-center justify-between text-sm pt-3 border-t border-white/10 dark:border-white/5">
                      <div className="flex items-center gap-6">
                        <div>
                          <span className="text-muted-foreground text-xs block">{t('unpaidBalances.unpaid')}</span>
                          <p className={`font-semibold text-lg ${isHighAmount ? 'text-red-500' : isMediumAmount ? 'text-amber-500' : 'text-foreground'}`}>
                            {formatCurrency(company.unpaidAmount, 'EUR')}
                          </p>
                        </div>
                        <div>
                          <span className="text-muted-foreground text-xs block">{t('unpaidBalances.orders')}</span>
                          <p className="font-medium text-lg">{company.orderCount}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="text-muted-foreground text-xs block">{t('unpaidBalances.lastOrder')}</span>
                        <p className="text-sm">
                          {new Date(company.lastOrderDate).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })}
                        </p>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            {searchQuery ? (
              <>
                <Search className="w-12 h-12 mb-4 text-muted-foreground/50" />
                <h3 className="text-lg font-medium mb-1">{t('unpaidBalances.noResultsFound')}</h3>
                <p className="text-sm">{t('unpaidBalances.tryAdjustingSearch')}</p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSearchQuery('')}
                  className="mt-4"
                >
                  {t('unpaidBalances.clearSearch')}
                </Button>
              </>
            ) : (
              <>
                <CreditCard className="w-12 h-12 mb-4 text-green-500" />
                <h3 className="text-lg font-medium mb-1">{t('unpaidBalances.noUnpaidOrders')}</h3>
                <p className="text-sm">{t('unpaidBalances.allCompaniesUpToDate')}</p>
              </>
            )}
          </div>
        )}
      </GlassCard>
    </div>
  )
}

export default UnpaidBalancesPage
