import { useTranslation } from 'react-i18next'
import { GlassCard } from '@/components/GlassCard'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { 
  CheckCircle2, 
  XCircle,
  Package,
  FolderTree,
  ImageIcon,
  Clock,
  Building2,
  ArrowRight,
  RefreshCw,
  FileSpreadsheet,
  Zap,
  Link2,
} from 'lucide-react'
import type { ImportResult } from '../CSVImportWizard'

interface ImportResultsStepProps {
  result: ImportResult
  onViewProducts: () => void
  onImportMore: () => void
}

export function ImportResultsStep({
  result,
  onViewProducts,
  onImportMore,
}: ImportResultsStepProps) {
  const { t } = useTranslation()
  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    if (mins > 0) {
      return `${mins}m ${secs}s`
    }
    return `${secs}s`
  }

  const successRate = result.total > 0 
    ? Math.round((result.imported / result.total) * 100) 
    : 0

  return (
    <div className="space-y-6">
      {/* Success Header */}
      <GlassCard className={cn(
        "border-2 overflow-hidden relative",
        result.success 
          ? "border-green-300 dark:border-green-700"
          : "border-amber-300 dark:border-amber-700"
      )}>
        {/* Background decoration */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-24 -right-24 w-48 h-48 bg-gradient-to-br from-green-200/50 to-emerald-200/50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-full blur-3xl" />
          <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-gradient-to-br from-slate-200/50 to-gray-200/50 dark:from-slate-900/20 dark:to-gray-900/20 rounded-full blur-3xl" />
        </div>

        <div className="relative z-10">
          <div className="text-center py-6">
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-green-400 to-emerald-500 flex items-center justify-center mx-auto mb-4 shadow-lg">
              <CheckCircle2 className="w-10 h-10 text-white" />
            </div>
            <h2 className="text-3xl font-bold mb-2">
              {t('csvImport.results.importComplete')}
            </h2>
            <p className="text-lg text-muted-foreground">
              {t('csvImport.results.successfullyImported', { count: result.imported })}
            </p>
          </div>
        </div>
      </GlassCard>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <GlassCard className="p-4 text-center">
          <div className="w-10 h-10 rounded-xl bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto mb-2">
            <Package className="w-5 h-5 text-green-600" />
          </div>
          <p className="text-3xl font-bold">{result.imported.toLocaleString()}</p>
          <p className="text-sm text-muted-foreground">{t('csvImport.results.productsAdded')}</p>
        </GlassCard>

        <GlassCard className="p-4 text-center">
          <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center mx-auto mb-2">
            <FolderTree className="w-5 h-5 text-blue-600" />
          </div>
          <p className="text-3xl font-bold">
            {result.categoriesCreated}
            <span className="text-lg text-muted-foreground font-normal">
              {result.categoriesReused ? ` +${result.categoriesReused}` : ''}
            </span>
          </p>
          <p className="text-sm text-muted-foreground">
            {result.categoriesCreated > 0 ? 'New' : ''} Categories
            {result.categoriesReused ? ' (reused)' : ''}
          </p>
        </GlassCard>

        <GlassCard className="p-4 text-center">
          <div className="w-10 h-10 rounded-xl bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center mx-auto mb-2">
            <Link2 className="w-5 h-5 text-purple-600" />
          </div>
          <p className="text-3xl font-bold">{(result.productsLinkedToCategories || 0).toLocaleString()}</p>
          <p className="text-sm text-muted-foreground">Products Linked</p>
        </GlassCard>

        <GlassCard className="p-4 text-center">
          <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto mb-2">
            <ImageIcon className="w-5 h-5 text-slate-600" />
          </div>
          <p className="text-3xl font-bold">{result.imagesProcessed.toLocaleString()}</p>
          <p className="text-sm text-muted-foreground">{t('csvImport.results.imagesProcessed')}</p>
        </GlassCard>

        <GlassCard className="p-4 text-center">
          <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto mb-2">
            <Building2 className="w-5 h-5 text-slate-600" />
          </div>
          <p className="text-xl font-bold truncate">{result.distributor}</p>
          <p className="text-sm text-muted-foreground">{t('csvImport.results.distributor')}</p>
        </GlassCard>
      </div>

      {/* Import Details */}
      <GlassCard>
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <FileSpreadsheet className="w-5 h-5" />
          {t('csvImport.results.importSummary')}
        </h3>

        <div className="space-y-3">
          <div className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-800">
            <span className="text-muted-foreground">{t('csvImport.results.totalProducts')}</span>
            <span className="font-mono font-semibold">{result.total.toLocaleString()}</span>
          </div>
          <div className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-800">
            <span className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-green-500" />
              <span className="text-green-700 dark:text-green-400">{t('csvImport.results.imported')}</span>
            </span>
            <span className="font-mono font-semibold text-green-700 dark:text-green-400">{result.imported.toLocaleString()}</span>
          </div>
          {result.updated > 0 && (
            <div className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-800">
              <span className="flex items-center gap-2">
                <RefreshCw className="w-4 h-4 text-blue-500" />
                <span className="text-blue-700 dark:text-blue-400">{t('csvImport.results.updated')}</span>
              </span>
              <span className="font-mono font-semibold text-blue-700 dark:text-blue-400">{result.updated.toLocaleString()}</span>
            </div>
          )}
          {result.skipped > 0 && (
            <div className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-800">
              <span className="flex items-center gap-2">
                <span className="w-4 h-4 text-amber-500">⏭️</span>
                <span className="text-amber-700 dark:text-amber-400">{t('csvImport.results.skipped')}</span>
              </span>
              <span className="font-mono font-semibold text-amber-700 dark:text-amber-400">{result.skipped.toLocaleString()}</span>
            </div>
          )}
          {result.failed > 0 && (
            <div className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-800">
              <span className="flex items-center gap-2">
                <XCircle className="w-4 h-4 text-red-500" />
                <span className="text-red-700 dark:text-red-400">{t('csvImport.results.failed')}</span>
              </span>
              <span className="font-mono font-semibold text-red-700 dark:text-red-400">{result.failed.toLocaleString()}</span>
            </div>
          )}
          <div className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-800">
            <span className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-gray-500" />
              <span className="text-muted-foreground">{t('csvImport.results.duration')}</span>
            </span>
            <span className="font-mono font-semibold">{formatDuration(result.duration)}</span>
          </div>
          <div className="flex items-center justify-between py-2">
            <span className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-slate-500" />
              <span className="text-muted-foreground">{t('csvImport.results.successRate')}</span>
            </span>
            <Badge className={cn(
              "text-lg px-3 py-1",
              successRate >= 95 && "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
              successRate >= 80 && successRate < 95 && "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
              successRate < 80 && "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
            )}>
              {successRate}%
            </Badge>
          </div>
        </div>
      </GlassCard>

      {/* Error Details (if any) */}
      {result.errors.length > 0 && (
        <GlassCard className="border-red-200 dark:border-red-800 bg-red-50/30 dark:bg-red-950/10">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2 text-red-700 dark:text-red-400">
            <XCircle className="w-5 h-5" />
            {t('csvImport.results.importErrors')}
            <Badge variant="destructive">{result.errors.length}</Badge>
          </h3>

          <div className="space-y-2 max-h-48 overflow-y-auto">
            {result.errors.slice(0, 10).map((error, index) => (
              <div key={index} className="flex items-start gap-2 text-sm">
                <Badge variant="outline" className="font-mono shrink-0">
                  {t('csvImport.validation.row', { row: error.row })}
                </Badge>
                <span className="text-red-600 dark:text-red-400">{error.error}</span>
              </div>
            ))}
            {result.errors.length > 10 && (
              <p className="text-sm text-muted-foreground">
                {t('csvImport.results.andMoreErrors', { count: result.errors.length - 10 })}
              </p>
            )}
          </div>
        </GlassCard>
      )}

      {/* Category Sync Status */}
      <GlassCard className="bg-gradient-to-br from-purple-50 to-blue-50 dark:from-purple-950/20 dark:to-blue-950/20 border-purple-200 dark:border-purple-800">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-purple-100 dark:bg-purple-900/40 flex items-center justify-center shrink-0">
            <FolderTree className="w-6 h-6 text-purple-600 dark:text-purple-400" />
          </div>
          <div className="flex-1">
            <h4 className="font-semibold text-purple-700 dark:text-purple-300 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-green-500" />
              Categories Synchronized
            </h4>
            <p className="text-sm text-muted-foreground mt-1">
              All products are now linked to categories via <code className="text-xs bg-slate-200 dark:bg-slate-800 px-1.5 py-0.5 rounded">category_id</code>.
              {result.categoriesCreated > 0 && (
                <span className="block mt-1">
                  <strong>{result.categoriesCreated}</strong> new {result.categoriesCreated === 1 ? 'category' : 'categories'} created.
                </span>
              )}
              {(result.categoriesReused || 0) > 0 && (
                <span className="block">
                  <strong>{result.categoriesReused}</strong> existing {result.categoriesReused === 1 ? 'category' : 'categories'} reused.
                </span>
              )}
            </p>
            {result.categorySyncDetails && result.categorySyncDetails.length > 0 && (
              <details className="mt-2">
                <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground">
                  Show sync details
                </summary>
                <ul className="text-xs text-muted-foreground mt-1 space-y-0.5 ml-4 list-disc">
                  {result.categorySyncDetails.slice(0, 5).map((detail, i) => (
                    <li key={i}>{detail}</li>
                  ))}
                  {result.categorySyncDetails.length > 5 && (
                    <li>...and {result.categorySyncDetails.length - 5} more</li>
                  )}
                </ul>
              </details>
            )}
          </div>
        </div>
      </GlassCard>

      {/* Mapping Saved Info */}
      <GlassCard className="bg-gradient-to-br from-slate-50 to-gray-50 dark:from-slate-950/30 dark:to-gray-950/30">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-slate-200 dark:bg-slate-800 flex items-center justify-center">
            <Zap className="w-6 h-6 text-slate-600 dark:text-slate-400" />
          </div>
          <div>
            <h4 className="font-semibold">
              {t('csvImport.results.mappingsSaved')}
            </h4>
            <p className="text-sm text-muted-foreground">
              {t('csvImport.results.mappingsSavedDescription', { distributor: result.distributor })}
            </p>
          </div>
        </div>
      </GlassCard>

      {/* Action Buttons */}
      <div className="flex flex-col sm:flex-row gap-4">
        <Button
          onClick={onViewProducts}
          size="lg"
          className="flex-1 bg-gradient-to-r from-slate-700 to-slate-900 hover:from-slate-800 hover:to-slate-950 text-white text-lg py-6"
        >
          <Package className="w-5 h-5 mr-2" />
          {t('csvImport.results.viewProducts')}
          <ArrowRight className="w-5 h-5 ml-2" />
        </Button>

        <Button
          onClick={onImportMore}
          variant="outline"
          size="lg"
          className="flex-1 text-lg py-6"
        >
          <RefreshCw className="w-5 h-5 mr-2" />
          {t('csvImport.results.importMore')}
        </Button>
      </div>
    </div>
  )
}
