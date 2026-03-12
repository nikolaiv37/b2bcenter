import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { GlassCard } from '@/components/GlassCard'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { 
  CheckCircle2, 
  AlertCircle, 
  XCircle,
  Info,
  Package,
  AlertTriangle,
  FileSpreadsheet,
  RefreshCw,
  Eye,
  Search,
  DollarSign,
  Layers,
  SkipForward,
  ArrowRightLeft,
  FolderPlus,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'
import type { ImportValidation } from '@/hooks/useSmartMapping'

interface ValidationStepProps {
  validation: ImportValidation | null
  totalProducts: number
  distributorName: string
  isImporting: boolean
  importProgress: number
  importStatus: string
  newCategories?: Array<{ name: string; productCount: number }>
}

// Modal for reviewing duplicate SKUs
function DuplicateSKUModal({
  open,
  onOpenChange,
  duplicates,
  onAction,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  duplicates: Array<{ sku: string; rows: number[]; currentPrice?: number; newPrice?: number }>
  onAction: (action: 'update' | 'merge' | 'skip', skus?: string[]) => void
}) {
  const { t } = useTranslation()
  const [selectedSkus, setSelectedSkus] = useState<Set<string>>(new Set())

  const toggleSku = (sku: string) => {
    const newSet = new Set(selectedSkus)
    if (newSet.has(sku)) {
      newSet.delete(sku)
    } else {
      newSet.add(sku)
    }
    setSelectedSkus(newSet)
  }

  const selectAll = () => {
    setSelectedSkus(new Set(duplicates.map(d => d.sku)))
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-500" />
            {t('csvImport.validation.duplicateSKUsFound')}
          </DialogTitle>
          <DialogDescription>
            {t('csvImport.validation.productsAlreadyExist', { count: duplicates.length })}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto">
          <div className="space-y-2">
            {duplicates.slice(0, 20).map((dup) => (
              <div
                key={dup.sku}
                className={cn(
                  'p-3 rounded-lg border transition-colors cursor-pointer',
                  selectedSkus.has(dup.sku)
                    ? 'bg-amber-50 dark:bg-amber-950/20 border-amber-300 dark:border-amber-700'
                    : 'bg-gray-50 dark:bg-gray-900/50 border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800'
                )}
                onClick={() => toggleSku(dup.sku)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={selectedSkus.has(dup.sku)}
                      onChange={() => toggleSku(dup.sku)}
                      className="rounded"
                    />
                    <code className="font-mono text-sm bg-white dark:bg-gray-800 px-2 py-0.5 rounded">
                      {dup.sku}
                    </code>
                  </div>
                  <Badge variant="outline" className="text-xs">
                    {dup.rows.length} {t('csvImport.validation.occurrencesInCsv')}
                  </Badge>
                </div>
              </div>
            ))}
            {duplicates.length > 20 && (
              <p className="text-sm text-muted-foreground text-center py-2">
                ... and {duplicates.length - 20} more duplicates
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between pt-4 border-t">
          <Button variant="ghost" size="sm" onClick={selectAll}>
            {t('csvImport.validation.selectAll', { count: duplicates.length })}
          </Button>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                onAction('skip', Array.from(selectedSkus))
                onOpenChange(false)
              }}
              disabled={selectedSkus.size === 0}
            >
              <SkipForward className="w-4 h-4 mr-1" />
              {t('csvImport.validation.skipSelected')}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                onAction('merge', Array.from(selectedSkus))
                onOpenChange(false)
              }}
              disabled={selectedSkus.size === 0}
            >
              <Layers className="w-4 h-4 mr-1" />
              {t('csvImport.validation.mergeStock')}
            </Button>
            <Button
              size="sm"
              onClick={() => {
                onAction('update', Array.from(selectedSkus))
                onOpenChange(false)
              }}
            >
              <ArrowRightLeft className="w-4 h-4 mr-1" />
              {t('csvImport.validation.updateAll')}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// Modal for reviewing missing prices
function MissingPriceModal({
  open,
  onOpenChange,
  items,
  onAction,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  items: Array<{ row: number; sku?: string; name?: string }>
  onAction: (action: 'set' | 'skip', rows?: number[]) => void
}) {
  const { t } = useTranslation()
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <XCircle className="w-5 h-5 text-red-500" />
            {t('csvImport.validation.missingPricesTitle')}
          </DialogTitle>
          <DialogDescription>
            {t('csvImport.validation.productsHaveNoPrice', { count: items.length })}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto">
          <div className="space-y-2">
            {items.slice(0, 20).map((item) => (
              <div
                key={item.row}
                className="p-3 rounded-lg bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Badge variant="outline" className="font-mono text-xs">
                      {t('csvImport.validation.row', { row: item.row })}
                    </Badge>
                    {item.sku && (
                      <code className="font-mono text-sm bg-white dark:bg-gray-800 px-2 py-0.5 rounded">
                        {item.sku}
                      </code>
                    )}
                    {item.name && (
                      <span className="text-sm truncate max-w-[200px]">{item.name}</span>
                    )}
                  </div>
                  <Badge variant="destructive" className="text-xs">
                    <DollarSign className="w-3 h-3 mr-1" />
                    {t('csvImport.validation.noPrice')}
                  </Badge>
                </div>
              </div>
            ))}
            {items.length > 20 && (
              <p className="text-sm text-muted-foreground text-center py-2">
                ... and {items.length - 20} more items without prices
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('csvImport.validation.close')}
          </Button>
          <Button
            variant="destructive"
            onClick={() => {
              onAction('skip', items.map(i => i.row))
              onOpenChange(false)
            }}
          >
            <SkipForward className="w-4 h-4 mr-1" />
            {t('csvImport.validation.skipAll', { count: items.length })}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export function ValidationStep({
  validation,
  totalProducts,
  distributorName,
  isImporting,
  importProgress,
  importStatus,
  newCategories = [],
}: ValidationStepProps) {
  const { t } = useTranslation()
  const [showDuplicatesModal, setShowDuplicatesModal] = useState(false)
  const [showMissingPriceModal, setShowMissingPriceModal] = useState(false)
  const [showNewCategoriesExpanded, setShowNewCategoriesExpanded] = useState(false)

  if (!validation) {
    return (
      <GlassCard className="text-center py-12">
        <RefreshCw className="w-12 h-12 text-gray-400 mx-auto mb-4 animate-spin" />
        <h3 className="text-lg font-semibold mb-2">{t('csvImport.validation.validatingData')}</h3>
        <p className="text-muted-foreground">
          {t('csvImport.validation.pleaseWait')}
        </p>
      </GlassCard>
    )
  }

  // Extract duplicate SKUs info from issues
  const duplicateIssues = validation.issues
    .filter(i => i.field === 'sku' && i.message.includes('Duplicate'))
    .map(i => ({
      sku: i.message.replace('Duplicate SKU: ', ''),
      rows: i.rows || [],
    }))

  // Extract missing price items
  const missingPriceItems = validation.issues
    .filter(i => i.field === 'wholesale_price' || i.message.includes('price'))
    .flatMap(i => (i.rows || []).map(row => ({ row })))

  const hasErrors = validation.issues.some(i => i.type === 'error')

  const handleDuplicateAction = (action: 'update' | 'merge' | 'skip', skus?: string[]) => {
    console.log('Duplicate action:', action, skus)
    // This would typically update the validation state
    // For now, just log the action
  }

  const handleMissingPriceAction = (action: 'set' | 'skip', rows?: number[]) => {
    console.log('Missing price action:', action, rows)
  }

  return (
    <div className="space-y-6">
      {/* Duplicate SKU Modal */}
      <DuplicateSKUModal
        open={showDuplicatesModal}
        onOpenChange={setShowDuplicatesModal}
        duplicates={duplicateIssues}
        onAction={handleDuplicateAction}
      />

      {/* Missing Price Modal */}
      <MissingPriceModal
        open={showMissingPriceModal}
        onOpenChange={setShowMissingPriceModal}
        items={missingPriceItems}
        onAction={handleMissingPriceAction}
      />

      {/* Import Progress (when importing) */}
      {isImporting && (
        <GlassCard className="border-2 border-slate-300 dark:border-slate-700">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center animate-pulse">
                <Package className="w-5 h-5 text-slate-600 dark:text-slate-400" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold">{t('csvImport.validation.importingProducts')}</h3>
                <p className="text-sm text-muted-foreground">{importStatus}</p>
              </div>
              <span className="text-2xl font-bold">
                {importProgress}%
              </span>
            </div>
            <Progress value={importProgress} className="h-3" />
          </div>
        </GlassCard>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <GlassCard className="p-4">
          <div className="flex items-center gap-3">
            <div className={cn(
              "w-10 h-10 rounded-xl flex items-center justify-center",
              validation.validProducts > 0 
                ? "bg-green-100 dark:bg-green-900/30"
                : "bg-red-100 dark:bg-red-900/30"
            )}>
              <CheckCircle2 className={cn(
                "w-5 h-5",
                validation.validProducts > 0 ? "text-green-600" : "text-red-600"
              )} />
            </div>
            <div>
              <p className="text-2xl font-bold">{validation.validProducts.toLocaleString()}</p>
              <p className="text-sm text-muted-foreground">{t('csvImport.validation.validProducts')}</p>
            </div>
          </div>
        </GlassCard>

        <GlassCard className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
              <AlertCircle className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{validation.duplicateSKUs}</p>
              <p className="text-sm text-muted-foreground">{t('csvImport.validation.duplicateSKUs')}</p>
            </div>
          </div>
        </GlassCard>

        <GlassCard className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
              <XCircle className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{validation.missingPrices}</p>
              <p className="text-sm text-muted-foreground">{t('csvImport.validation.missingPrices')}</p>
            </div>
          </div>
        </GlassCard>

        <GlassCard className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
              <FileSpreadsheet className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{validation.newCategories}</p>
              <p className="text-sm text-muted-foreground">{t('csvImport.validation.newCategories')}</p>
            </div>
          </div>
        </GlassCard>
      </div>

      {/* Preview Table Header */}
      <GlassCard>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Eye className="w-5 h-5" />
            {t('csvImport.validation.importPreview')}
            <Badge variant="secondary">
              {totalProducts.toLocaleString()} {t('csvImport.validation.products')}
            </Badge>
          </h3>
          <Badge variant="outline">
            {distributorName}
          </Badge>
        </div>

        {/* Validation Summary Table */}
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b-2 border-gray-200 dark:border-gray-700">
                <th className="text-left px-4 py-3 font-semibold text-sm">{t('csvImport.validation.status')}</th>
                <th className="text-right px-4 py-3 font-semibold text-sm">{t('csvImport.validation.count')}</th>
                <th className="text-center px-4 py-3 font-semibold text-sm">{t('csvImport.validation.action')}</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50/50 dark:hover:bg-gray-900/30">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-green-500" />
                    <span className="font-medium">{t('csvImport.validation.valid')}</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-right font-mono">{validation.validProducts.toLocaleString()}</td>
                <td className="px-4 py-3 text-center text-muted-foreground">—</td>
              </tr>

              {validation.duplicateSKUs > 0 && (
                <tr className="border-b border-gray-100 dark:border-gray-800 bg-amber-50/30 dark:bg-amber-950/10 hover:bg-amber-50/50 dark:hover:bg-amber-950/20">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-amber-500" />
                      <span className="font-medium">{t('csvImport.validation.duplicateSKU')}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right font-mono">{validation.duplicateSKUs}</td>
                  <td className="px-4 py-3 text-center">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs"
                      onClick={() => setShowDuplicatesModal(true)}
                    >
                      <Search className="w-3 h-3 mr-1" />
                      {t('csvImport.validation.review')}
                    </Button>
                  </td>
                </tr>
              )}

              {validation.missingPrices > 0 && (
                <tr className="border-b border-gray-100 dark:border-gray-800 bg-red-50/30 dark:bg-red-950/10 hover:bg-red-50/50 dark:hover:bg-red-950/20">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <XCircle className="w-4 h-4 text-red-500" />
                      <span className="font-medium">{t('csvImport.validation.missingPrice')}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right font-mono">{validation.missingPrices}</td>
                  <td className="px-4 py-3 text-center">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs text-red-600 border-red-200 hover:bg-red-50"
                      onClick={() => setShowMissingPriceModal(true)}
                    >
                      <Search className="w-3 h-3 mr-1" />
                      {t('csvImport.validation.review')}
                    </Button>
                  </td>
                </tr>
              )}

              {validation.newCategories > 0 && (
                <tr className="border-b border-gray-100 dark:border-gray-800 bg-emerald-50/30 dark:bg-emerald-950/10 hover:bg-emerald-50/50 dark:hover:bg-emerald-950/20">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <FolderPlus className="w-4 h-4 text-emerald-500" />
                      <span className="font-medium">{t('csvImport.validation.newCategoriesLabel')}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right font-mono">{validation.newCategories}</td>
                  <td className="px-4 py-3 text-center">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs text-emerald-600 border-emerald-200 hover:bg-emerald-50"
                      onClick={() => setShowNewCategoriesExpanded(!showNewCategoriesExpanded)}
                    >
                      {showNewCategoriesExpanded ? (
                        <><ChevronUp className="w-3 h-3 mr-1" /> {t('csvImport.validation.hide')}</>
                      ) : (
                        <><ChevronDown className="w-3 h-3 mr-1" /> {t('csvImport.validation.preview')}</>
                      )}
                    </Button>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </GlassCard>

      {/* New Categories Preview Section */}
      {validation.newCategories > 0 && showNewCategoriesExpanded && (
        <GlassCard className="bg-emerald-50/30 dark:bg-emerald-950/10 border-emerald-200 dark:border-emerald-800">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
              <FolderPlus className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <h3 className="font-semibold text-emerald-700 dark:text-emerald-400">
                {t('csvImport.validation.newCategoriesToCreate')}
              </h3>
              <p className="text-sm text-emerald-600 dark:text-emerald-500">
                {t('csvImport.validation.willBeAutomaticallyCreated')}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {newCategories.length > 0 ? (
              newCategories.map((cat, index) => (
                <div 
                  key={index}
                  className="flex items-center justify-between p-3 rounded-lg bg-white dark:bg-gray-900 border border-emerald-200 dark:border-emerald-800"
                >
                  <div className="flex items-center gap-2">
                    <FolderPlus className="w-4 h-4 text-emerald-500" />
                    <span className="font-medium text-sm">{cat.name}</span>
                  </div>
                  <Badge variant="secondary" className="font-mono text-xs">
                    <Package className="w-3 h-3 mr-1" />
                    {cat.productCount}
                  </Badge>
                </div>
              ))
            ) : (
              <div className="col-span-full text-center py-4 text-muted-foreground">
                <p className="text-sm">
                  {validation.newCategories} {validation.newCategories === 1 ? t('csvImport.validation.newCategory') : t('csvImport.validation.newCategoriesPlural')} {t('csvImport.validation.willBeCreated')}
                </p>
              </div>
            )}
          </div>
        </GlassCard>
      )}

      {/* Issues List with Review Buttons */}
      {validation.issues.length > 0 && (
        <GlassCard>
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <AlertCircle className="w-5 h-5" />
            {t('csvImport.validation.issuesWarnings')}
            <Badge variant="outline">{validation.issues.length}</Badge>
          </h3>

          <div className="space-y-3">
            {validation.issues.map((issue, index) => (
              <div
                key={index}
                className={cn(
                  'p-4 rounded-lg border flex items-start gap-3',
                  issue.type === 'error' && 'bg-red-50/50 dark:bg-red-950/10 border-red-200 dark:border-red-800',
                  issue.type === 'warning' && 'bg-amber-50/50 dark:bg-amber-950/10 border-amber-200 dark:border-amber-800',
                  issue.type === 'info' && 'bg-blue-50/50 dark:bg-blue-950/10 border-blue-200 dark:border-blue-800'
                )}
              >
                {issue.type === 'error' && <XCircle className="w-4 h-4 text-red-500 mt-0.5" />}
                {issue.type === 'warning' && <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5" />}
                {issue.type === 'info' && <Info className="w-4 h-4 text-blue-500 mt-0.5" />}
                <div className="flex-1">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <p className="font-medium">{issue.message}</p>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="font-mono text-xs">
                        {issue.count} {issue.count === 1 ? t('csvImport.validation.item') : t('csvImport.validation.items')}
                      </Badge>
                      {issue.field === 'sku' && issue.message.includes('Duplicate') && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-6 text-xs"
                          onClick={() => setShowDuplicatesModal(true)}
                        >
                          <Search className="w-3 h-3 mr-1" />
                          {t('csvImport.validation.review')}
                        </Button>
                      )}
                    </div>
                  </div>
                  {issue.rows && issue.rows.length > 0 && (
                    <p className="text-sm text-muted-foreground mt-1">
                      {t('csvImport.validation.rows')} {issue.rows.slice(0, 5).join(', ')}
                      {issue.rows.length > 5 && ` ${t('csvImport.validation.andMore', { count: issue.rows.length - 5 })}`}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </GlassCard>
      )}

      {/* Ready to Import Message */}
      {!isImporting && validation.validProducts > 0 && (
        <GlassCard className={cn(
          "border-2",
          hasErrors 
            ? "border-amber-300 dark:border-amber-700 bg-amber-50/30 dark:bg-amber-950/10"
            : "border-green-300 dark:border-green-700 bg-green-50/30 dark:bg-green-950/10"
        )}>
          <div className="flex items-center gap-4">
            {hasErrors ? (
              <div className="w-12 h-12 rounded-xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                <AlertCircle className="w-6 h-6 text-amber-600" />
              </div>
            ) : (
              <div className="w-12 h-12 rounded-xl bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                <CheckCircle2 className="w-6 h-6 text-green-600" />
              </div>
            )}
            <div>
              <h3 className="text-lg font-semibold">
                {hasErrors 
                  ? t('csvImport.validation.readyToImportSkipped', { skipped: validation.missingPrices })
                  : t('csvImport.validation.readyToImport')
                }
              </h3>
              <p className="text-sm text-muted-foreground">
                {t('csvImport.validation.productsWillBeImported', { count: validation.validProducts })}
                {validation.duplicateSKUs > 0 && ` ${t('csvImport.validation.existingProductsWillBeUpdated', { count: validation.duplicateSKUs })}`}
              </p>
            </div>
          </div>
        </GlassCard>
      )}
    </div>
  )
}
