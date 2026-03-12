import { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { GlassCard } from '@/components/GlassCard'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { cn } from '@/lib/utils'
import { 
  Upload, 
  FileSpreadsheet, 
  CheckCircle2, 
  AlertCircle,
  Download,
  Building2,
  Columns,
  Package,
  Zap,
} from 'lucide-react'
import type { DistributorPreset } from '@/lib/csv/distributors'

interface UploadStepProps {
  selectedFile: File | null
  onFileSelect: (file: File) => void
  isProcessing: boolean
  detectedDistributor: DistributorPreset | null
  detectorConfidence: number
  totalProducts: number
  detectedColumns: number
  requiredColumnsFound: number
}

export function UploadStep({
  selectedFile,
  onFileSelect,
  isProcessing,
  detectedDistributor,
  detectorConfidence,
  totalProducts,
  detectedColumns,
  requiredColumnsFound,
}: UploadStepProps) {
  const { t } = useTranslation()
  const [dragActive, setDragActive] = useState(false)

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true)
    } else if (e.type === 'dragleave') {
      setDragActive(false)
    }
  }, [])

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      setDragActive(false)

      if (e.dataTransfer.files && e.dataTransfer.files[0]) {
        const file = e.dataTransfer.files[0]
        if (file.type === 'text/csv' || file.name.endsWith('.csv')) {
          onFileSelect(file)
        }
      }
    },
    [onFileSelect]
  )

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      e.preventDefault()
      if (e.target.files && e.target.files[0]) {
        onFileSelect(e.target.files[0])
      }
    },
    [onFileSelect]
  )

  const downloadTemplate = () => {
    const template = `sku;name;description;category;manufacturer;retail_price;wholesale_price;stock;main_image;image1;image2
CHAIR-001;Modern Dining Chair;Comfortable dining chair with wooden legs;Chairs;ACME;299.99;199.99;50;https://example.com/chair1.jpg;https://example.com/chair1-2.jpg;
SOFA-001;3-Seater Sofa;Luxurious fabric sofa;Sofas;HomeStyle;1299.99;899.99;20;https://example.com/sofa1.jpg;;
TABLE-001;Coffee Table;Solid wood coffee table;Tables;WoodWorks;499.99;349.99;30;https://example.com/table1.jpg;;`

    const blob = new Blob([template], { type: 'text/csv;charset=utf-8;' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'product-import-template.csv'
    a.click()
    window.URL.revokeObjectURL(url)
  }

  // Calculate confidence color
  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 90) return 'text-green-600 dark:text-green-400'
    if (confidence >= 70) return 'text-amber-600 dark:text-amber-400'
    return 'text-red-600 dark:text-red-400'
  }

  const getConfidenceBg = (confidence: number) => {
    if (confidence >= 90) return 'bg-green-100 dark:bg-green-900/20'
    if (confidence >= 70) return 'bg-amber-100 dark:bg-amber-900/20'
    return 'bg-red-100 dark:bg-red-900/20'
  }

  return (
    <div className="space-y-6">
      {/* Upload Zone */}
      <GlassCard className="relative overflow-hidden">
        <div
          className={cn(
            'relative border-2 border-dashed rounded-xl p-8 transition-all duration-300',
            dragActive
              ? 'border-slate-500 bg-slate-50 dark:bg-slate-950/20'
              : 'border-gray-300 dark:border-gray-600 hover:border-slate-400 dark:hover:border-slate-500',
            isProcessing && 'pointer-events-none opacity-50'
          )}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
        >
          <input
            type="file"
            id="csv-upload"
            accept=".csv"
            onChange={handleChange}
            className="hidden"
            disabled={isProcessing}
          />

          {!selectedFile ? (
            <label
              htmlFor="csv-upload"
              className="flex flex-col items-center justify-center cursor-pointer py-8"
            >
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-slate-600 to-slate-800 flex items-center justify-center mb-6 shadow-lg">
                <Upload className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-xl font-semibold mb-2">
                {t('csvImport.upload.dropCsvFile')}
              </h3>
              <p className="text-muted-foreground mb-6">
                {t('csvImport.upload.orClickToBrowse')}
              </p>
              <div className="flex items-center gap-4">
                <Button variant="outline" size="lg" asChild>
                  <span>
                    <FileSpreadsheet className="w-4 h-4 mr-2" />
                    {t('csvImport.upload.chooseFile')}
                  </span>
                </Button>
                <Button 
                  variant="ghost" 
                  size="lg"
                  onClick={(e) => {
                    e.preventDefault()
                    downloadTemplate()
                  }}
                >
                  <Download className="w-4 h-4 mr-2" />
                  {t('csvImport.upload.downloadTemplate')}
                </Button>
              </div>
            </label>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                    <FileSpreadsheet className="w-6 h-6 text-slate-600 dark:text-slate-400" />
                  </div>
                  <div>
                    <p className="font-semibold text-lg">{selectedFile.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {(selectedFile.size / 1024).toFixed(2)} KB
                    </p>
                  </div>
                </div>
              </div>

              {isProcessing && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <div className="animate-spin">
                      <Zap className="w-4 h-4 text-slate-500" />
                    </div>
                    <span className="text-sm font-medium">{t('csvImport.upload.analyzingCsv')}</span>
                  </div>
                  <Progress value={50} className="h-2" />
                </div>
              )}
            </div>
          )}
        </div>
      </GlassCard>

      {/* Detection Results */}
      {detectedDistributor && totalProducts > 0 && (
        <GlassCard className="border-2 border-slate-200 dark:border-slate-700">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center flex-shrink-0">
              <Zap className="w-6 h-6 text-slate-600 dark:text-slate-400" />
            </div>
            
            <div className="flex-1 space-y-4">
              <div>
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  {t('csvImport.upload.autoDetectionComplete')}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {t('csvImport.upload.weAnalyzed')}
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Distributor Card */}
                <div className={cn(
                  'rounded-xl p-4 flex items-center gap-3',
                  getConfidenceBg(detectorConfidence)
                )}>
                  <Building2 className={cn('w-8 h-8', getConfidenceColor(detectorConfidence))} />
                  <div>
                    <p className="text-sm text-muted-foreground">{t('csvImport.upload.distributor')}</p>
                    <p className="font-semibold">{detectedDistributor.displayName}</p>
                    <p className={cn('text-xs font-medium', getConfidenceColor(detectorConfidence))}>
                      {detectorConfidence}% {t('csvImport.upload.confidence')}
                    </p>
                  </div>
                </div>

                {/* Products Card */}
                <div className="rounded-xl p-4 bg-blue-100 dark:bg-blue-900/20 flex items-center gap-3">
                  <Package className="w-8 h-8 text-blue-600 dark:text-blue-400" />
                  <div>
                    <p className="text-sm text-muted-foreground">{t('csvImport.upload.productsFound')}</p>
                    <p className="font-semibold text-2xl">{totalProducts.toLocaleString()}</p>
                  </div>
                </div>

                {/* Columns Card */}
                <div className="rounded-xl p-4 bg-emerald-100 dark:bg-emerald-900/20 flex items-center gap-3">
                  <Columns className="w-8 h-8 text-emerald-600 dark:text-emerald-400" />
                  <div>
                    <p className="text-sm text-muted-foreground">{t('csvImport.upload.columnsDetected')}</p>
                    <p className="font-semibold">
                      {requiredColumnsFound}/3 {t('csvImport.upload.required')}
                    </p>
                    <p className="text-xs text-emerald-600 dark:text-emerald-400">
                      {detectedColumns} {t('csvImport.upload.totalColumns')}
                    </p>
                  </div>
                </div>
              </div>

              {/* Status badges */}
              <div className="flex flex-wrap gap-2">
                <Badge 
                  variant="secondary" 
                  className={cn(
                    'text-sm',
                    requiredColumnsFound === 3 ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                  )}
                >
                  {requiredColumnsFound === 3 ? (
                    <><CheckCircle2 className="w-3 h-3 mr-1" /> {t('csvImport.upload.allRequiredColumnsFound')}</>
                  ) : (
                    <><AlertCircle className="w-3 h-3 mr-1" /> {t('csvImport.upload.requiredColumnsMissing', { count: 3 - requiredColumnsFound })}</>
                  )}
                </Badge>
                
                {detectedDistributor.name !== 'generic' && (
                  <Badge variant="outline" className="text-sm">
                    <Zap className="w-3 h-3 mr-1" />
                    {t('csvImport.upload.preConfiguredMappingsAvailable')}
                  </Badge>
                )}
              </div>
            </div>
          </div>
        </GlassCard>
      )}

      {/* Supported Distributors Info */}
      {!detectedDistributor && (
        <GlassCard>
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            <Building2 className="w-5 h-5" />
            {t('csvImport.upload.supportedDistributors')}
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { name: 'Megapap', status: '100%', color: 'green' },
              { name: 'B2BMarkt', status: '95%', color: 'green' },
              { name: 'IKEA', status: '88%', color: 'amber' },
              { name: 'Generic', status: 'Auto', color: 'blue' },
            ].map((dist) => (
              <div 
                key={dist.name}
                className="rounded-lg border p-3 flex items-center justify-between"
              >
                <span className="font-medium">{dist.name}</span>
                <Badge 
                  variant="outline" 
                  className={cn(
                    'text-xs',
                    dist.color === 'green' && 'border-green-500 text-green-600',
                    dist.color === 'amber' && 'border-amber-500 text-amber-600',
                    dist.color === 'blue' && 'border-blue-500 text-blue-600',
                  )}
                >
                  {dist.status}
                </Badge>
              </div>
            ))}
          </div>
          <p className="text-sm text-muted-foreground mt-4">
            {t('csvImport.upload.dontSeeDistributor')}
          </p>
        </GlassCard>
      )}
    </div>
  )
}
