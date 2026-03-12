import { useState } from 'react'
import { useAppContext } from '@/lib/app/AppContext'
import { useTranslation } from 'react-i18next'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase/client'
import { parseCSV, csvRowToProduct, cleanProductForDatabase } from '@/lib/csv/parser'
import { validateTransformedProducts, TransformedProductData } from '@/lib/csv/validator'
import { trackEvent, AnalyticsEvents } from '@/lib/analytics'
import { useToast } from '@/components/ui/use-toast'

export function useCSVImport() {
  const { t } = useTranslation()
  const { toast } = useToast()
  const { workspaceId: tenantId } = useAppContext()
  const [progress, setProgress] = useState(0)
  const [statusText, setStatusText] = useState('')
  const [previewData, setPreviewData] = useState<TransformedProductData[]>([])
  const [validationResult, setValidationResult] = useState<ReturnType<typeof validateTransformedProducts> | null>(null)
  const queryClient = useQueryClient()

  const previewMutation = useMutation({
    mutationFn: async (file: File) => {
      setProgress(0)
      setPreviewData([])
      setValidationResult(null)

      try {
        // Step 1: Parse CSV (auto-detects delimiter: semicolon or comma)
        const parseResult = await parseCSV(file, ';')

        console.log('CSV Parse Result:', {
          totalRows: parseResult.data.length,
          errors: parseResult.errors,
          firstRow: parseResult.data[0],
        })

        if (parseResult.errors.length > 0) {
          console.error('CSV Parse Errors:', parseResult.errors)
          // Show warnings but don't fail if we have data
          if (parseResult.data.length === 0) {
            throw new Error(`CSV parsing failed: ${parseResult.errors[0].message}`)
          }
        }

        if (parseResult.data.length === 0) {
          throw new Error('No valid data found in CSV file. Please check the file format.')
        }

        // Step 2: Get supplier ID for transformation
        const { data: { user } } = await supabase.auth.getUser()
        const isDevMode = import.meta.env.VITE_DEV_MODE === 'true'
        const devUserId = isDevMode ? 'dev-user-123' : null
        const supplierId = user?.id || devUserId

        if (!supplierId) {
          throw new Error('User not authenticated')
        }

        // Step 3: Transform CSV rows to Product objects
        const transformedProducts: Record<string, unknown>[] = []
        const transformErrors: Array<{ row: number; error: string }> = []

        parseResult.data.forEach((row, index) => {
          try {
            const product = csvRowToProduct(row, supplierId)
            transformedProducts.push(product)
          } catch (error) {
            const rowNumber = index + 2
            const errorMessage = error instanceof Error ? error.message : 'Unknown error'
            transformErrors.push({
              row: rowNumber,
              error: errorMessage,
            })
            console.warn(`Transform error at row ${rowNumber}:`, errorMessage)
          }
        })

        if (transformedProducts.length === 0) {
          throw new Error('No valid products could be transformed from CSV. Please check your file format.')
        }

        // Step 4: Validate transformed products
        const validation = validateTransformedProducts(transformedProducts, 2)

        console.log('Validation Result:', {
          totalRows: validation.totalRows,
          validRows: validation.validRows,
          invalidRows: validation.invalidRows,
          errors: validation.errors.slice(0, 5), // Log first 5 errors
        })

        // Store validation result
        setValidationResult(validation)

        // Store preview data (first 10 rows of transformed products)
        setPreviewData(validation.validData.slice(0, 10) as TransformedProductData[])

        return {
          totalRows: parseResult.data.length,
          transformedRows: transformedProducts.length,
          validRows: validation.validRows,
          invalidRows: validation.invalidRows,
          data: transformedProducts, // Return transformed products for import
          validation,
        }
      } catch (error) {
        console.error('Preview error:', error)
        throw error
      }
    },
    onError: (error) => {
      console.error('Preview mutation error:', error)
      toast({
        title: 'Preview Failed',
        description: error instanceof Error ? error.message : 'Failed to preview CSV file',
        variant: 'destructive',
      })
    },
  })

  const importMutation = useMutation({
    mutationFn: async ({ file, data }: { file: File; data: Record<string, unknown>[] }) => {
      if (!tenantId) {
        throw new Error('Missing tenant context')
      }
      setProgress(0)
      setStatusText('Starting import...')

      trackEvent(AnalyticsEvents.CSV_IMPORT_STARTED, {
        fileName: file.name,
        fileSize: file.size,
        totalRows: data.length,
      })

      // Data is already transformed and validated, but we need to clean it for database
      // Remove compatibility fields (moq, wholesale_price, stock) that don't exist in DB
      const products = data.map(cleanProductForDatabase).map((product) => ({
        ...product,
        tenant_id: tenantId,
      }))

      if (products.length === 0) {
        throw new Error('No valid products to import. Please check your CSV file.')
      }

      // Bulk upsert products (in batches of 1000 for optimal speed)
      const batchSize = 1000
      const batches = []
      for (let i = 0; i < products.length; i += batchSize) {
        batches.push(products.slice(i, i + batchSize))
      }

      let importedCount = 0
      const failedRows: Array<{ row: number; error: string }> = []

      for (let i = 0; i < batches.length; i++) {
        const batch = batches[i]
        const startRow = i * batchSize + 1
        const endRow = Math.min(startRow + batch.length - 1, products.length)

        setStatusText(`Importing ${startRow}-${endRow} of ${products.length}...`)
        setProgress(Math.floor(((i + 1) / batches.length) * 100))

        try {
          // Upsert batch with onConflict: 'sku' and ignoreDuplicates: false (updates on duplicate)
          const { error } = await supabase
            .from('products')
            .upsert(batch, {
              onConflict: 'tenant_id,sku',
              ignoreDuplicates: false, // Update existing rows instead of skipping
            })

          if (error) {
            console.error(`Batch ${i + 1} error:`, error)
            // Log error but continue with remaining batches
            failedRows.push({
              row: startRow,
              error: error.message,
            })
            // Don't show toast for every batch error to avoid spam
            if (i === 0) {
              toast({
                title: 'Batch Error',
                description: `Error in rows ${startRow}-${endRow}: ${error.message}. Continuing with remaining batches...`,
                variant: 'destructive',
              })
            }
          } else {
            importedCount += batch.length
          }
        } catch (error) {
          console.error(`Batch ${i + 1} exception:`, error)
          failedRows.push({
            row: startRow,
            error: error instanceof Error ? error.message : 'Unknown error',
          })
        }
      }

      setProgress(100)
      setStatusText('Import complete!')

      trackEvent(AnalyticsEvents.CSV_IMPORT_COMPLETED, {
        productsImported: importedCount,
        totalRows: products.length,
        failedRows: failedRows.length,
        skippedRows: 0,
      })

      return {
        success: true,
        imported: importedCount,
        total: data.length, // Total transformed products
        valid: products.length, // Valid products processed
        failed: failedRows.length,
        skipped: 0, // No skipped rows since we already validated
        errors: failedRows,
      }
    },
    onSuccess: (result) => {
      // Invalidate products query to refresh the list
      queryClient.invalidateQueries({ queryKey: ['workspace', 'products'] })
      
      // Show success toast with detailed stats
      const messages = []
      if (result.failed > 0) {
        messages.push(t('csvImport.results.rowsFailed', { count: result.failed }))
      }
      const details = messages.length > 0 ? ` (${messages.join(', ')})` : ''
      
      toast({
        title: t('csvImport.results.importSuccessful'),
        description: t('csvImport.results.successfullyImported', { count: result.imported }) + details,
        variant: 'default',
        duration: 5000,
      })

      // Don't auto-redirect - let user click the button to view products
    },
    onError: (error) => {
      trackEvent(AnalyticsEvents.CSV_IMPORT_FAILED, {
        error: error instanceof Error ? error.message : t('general.unknownError'),
      })

      toast({
        title: t('csvImport.results.importFailed'),
        description: error instanceof Error ? error.message : t('general.unknownError'),
        variant: 'destructive',
      })
    },
  })

  return {
    previewCSV: previewMutation.mutate,
    isPreviewing: previewMutation.isPending,
    previewData,
    previewResult: previewMutation.data,
    previewError: previewMutation.error,
    validationResult,
    importCSV: importMutation.mutate,
    isImporting: importMutation.isPending,
    progress,
    statusText,
    result: importMutation.data,
    error: importMutation.error,
  }
}
