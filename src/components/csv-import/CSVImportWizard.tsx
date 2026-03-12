import { useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useSmartMapping } from '@/hooks/useSmartMapping'
import { useAuth } from '@/hooks/useAuth'
import { useTenant, useTenantPath } from '@/lib/tenant/TenantProvider'
import { parseCSVFlexible } from '@/lib/csv/parser'
import { supabase } from '@/lib/supabase/client'
import { sendNotification } from '@/lib/notifications'
import { useToast } from '@/components/ui/use-toast'
import { trackEvent, AnalyticsEvents } from '@/lib/analytics'
import { prepareProductsWithCategoryId, type CategorySyncResult } from '@/lib/category-sync-from-import'

// Step Components
import { UploadStep } from './steps/UploadStep'
import { ColumnMappingStep } from './steps/ColumnMappingStep'
import { CategoryMappingStep } from './steps/CategoryMappingStep'
import { ValidationStep } from './steps/ValidationStep'
import { ImportResultsStep } from './steps/ImportResultsStep'

// UI Components
import { GlassCard } from '@/components/GlassCard'
import { Progress } from '@/components/ui/progress'
import { cn } from '@/lib/utils'
import { 
  Upload, 
  Columns, 
  FolderTree, 
  CheckCircle2, 
  Zap,
  ArrowLeft,
  ArrowRight,
  X,
  Trash2,
  AlertTriangle,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

export interface ImportResult {
  success: boolean
  imported: number
  updated: number
  skipped: number
  failed: number
  total: number
  categoriesCreated: number
  categoriesReused: number
  categoriesMapped: number
  productsLinkedToCategories: number
  imagesProcessed: number
  distributor: string
  duration: number
  errors: Array<{ row: number; error: string }>
  categorySyncDetails?: string[]
}

export function CSVImportWizard() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const { company } = useAuth()
  const { tenant } = useTenant()
  const tenantId = tenant?.id
  const { withBase } = useTenantPath()

  const WIZARD_STEPS = [
    { id: 1, name: t('csvImport.wizard.upload'), icon: Upload, description: t('csvImport.wizard.uploadDetect') },
    { id: 2, name: t('csvImport.wizard.columns'), icon: Columns, description: t('csvImport.wizard.mapColumns') },
    { id: 3, name: t('csvImport.wizard.categories'), icon: FolderTree, description: t('csvImport.wizard.mapCategories') },
    { id: 4, name: t('csvImport.wizard.validate'), icon: CheckCircle2, description: t('csvImport.wizard.previewFix') },
    { id: 5, name: t('csvImport.wizard.complete'), icon: Zap, description: t('csvImport.wizard.importResults') },
  ]
  
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [importResult, setImportResult] = useState<ImportResult | null>(null)
  const [importProgress, setImportProgress] = useState(0)
  const [importStatus, setImportStatus] = useState('')
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [preserveCategoriesOnDelete, setPreserveCategoriesOnDelete] = useState(true)

  const smartMapping = useSmartMapping()

  // Category sync result stored for use in import results
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [_categorySyncResult, setCategorySyncResult] = useState<CategorySyncResult | null>(null)

  /**
   * Handle file upload and trigger analysis
   */
  const handleFileSelect = useCallback(async (file: File) => {
    setSelectedFile(file)
    
    try {
      // Parse CSV using flexible parser (accepts any CSV structure)
      const result = await parseCSVFlexible(file)
      
      if (result.data.length === 0) {
        toast({
          title: 'Empty CSV',
          description: 'The uploaded file contains no valid data rows.',
          variant: 'destructive',
        })
        return
      }

      console.log('CSV parsed successfully:', {
        rows: result.data.length,
        headers: result.headers.length,
        sampleHeaders: result.headers.slice(0, 10),
      })

      // Trigger smart analysis with headers and data
      smartMapping.analyzeCSV(result.headers, result.data)
      
    } catch (error) {
      console.error('CSV parse error:', error)
      toast({
        title: 'Parse Error',
        description: error instanceof Error ? error.message : 'Failed to parse CSV file',
        variant: 'destructive',
      })
    }
  }, [smartMapping, toast])

  /**
   * Import mutation
   */
  const importMutation = useMutation({
    mutationFn: async () => {
      if (!tenantId) {
        throw new Error('Missing tenant context')
      }
      const startTime = Date.now()
      setImportProgress(0)
      setImportStatus('Preparing import...')

      trackEvent(AnalyticsEvents.CSV_IMPORT_STARTED, {
        fileName: selectedFile?.name,
        distributor: smartMapping.detectedDistributor?.name,
        totalRows: smartMapping.totalProducts,
      })

      // Get supplier ID
      const { data: { user } } = await supabase.auth.getUser()
      const isDevMode = import.meta.env.VITE_DEV_MODE === 'true'
      const devUserId = isDevMode ? 'dev-user-123' : null
      const supplierId = user?.id || devUserId

      if (!supplierId) {
        throw new Error('User not authenticated')
      }

      // Get transformed data
      const transformedData = smartMapping.getTransformedData()
      
      // Define valid database columns (based on actual schema)
      // Only include columns that actually exist in the products table
      const validDbColumns = new Set([
        'id', 'supplier_id', 'model', 'sku', 'retail_price', 'weboffer_price',
        'name', 'name_bg', 'category', 'category_id', 'manufacturer', 'description', 'description_bg',
        'availability', 'quantity', 'weight', 'transportational_weight',
        'date_expected', 'main_image', 'images', 'is_visible', 'created_at', 'updated_at'
        // Note: moq, stock, wholesale_price, subcategory are NOT in the actual schema
        // They are filtered out or mapped to valid columns
      ])
      
      // Clean and prepare products for database insertion
      const productsWithoutCategoryId = transformedData
        .map(row => {
          // Ensure required fields exist
          const sku = row.sku ? String(row.sku).trim() : ''
          const name = row.name ? String(row.name).trim() : ''
          
          if (!sku || !name) {
            // Skip rows without required fields
            return null
          }
          
          const cleaned: Record<string, unknown> = {
            supplier_id: supplierId,
            is_visible: true,
            sku,
            name,
          }
          
          // Only include fields that exist in the database schema
          for (const [key, value] of Object.entries(row)) {
            // Handle virtual/compatibility fields that don't exist in the DB schema
            // but should be mapped to real DB columns.
            if (key === 'stock') {
              // Map logical "stock" field to actual DB quantity column
              // value is already parsed to a number in useSmartMapping.getTransformedData
              cleaned.quantity = (value as number) || 0
              continue
            }

            // Skip fields that don't exist in DB
            if (!validDbColumns.has(key)) {
              continue
            }
            
            // Map fields to correct DB column names
            if (key === 'wholesale_price') {
              cleaned.weboffer_price = value
            } else if (key === 'subcategory') {
              // Handle subcategory - combine with category if both exist
              const subcategory = typeof value === 'string' ? value.trim() : ''
              if (subcategory && cleaned.category) {
                // Combine: "Category > Subcategory"
                cleaned.category = `${cleaned.category} > ${subcategory}`
              } else if (subcategory) {
                // Only subcategory, use it as category
                cleaned.category = subcategory
              }
              // Don't include subcategory as separate field
              continue
            } else {
              cleaned[key] = value
            }
          }
          
          // Handle subcategory from transformed data if it exists separately
          if (row.subcategory && typeof row.subcategory === 'string') {
            const subcategory = row.subcategory.trim()
            if (subcategory && cleaned.category) {
              cleaned.category = `${cleaned.category} > ${subcategory}`
            } else if (subcategory) {
              cleaned.category = subcategory
            }
          }
          
          // Ensure required fields have defaults
          if (!cleaned.quantity) cleaned.quantity = 0
          
          // weboffer_price is REQUIRED (NOT NULL) - must always have a value
          let webofferPrice = cleaned.weboffer_price
          
          // If not set, try to get from wholesale_price
          if (!webofferPrice || webofferPrice === null || webofferPrice === undefined) {
            if (row.wholesale_price !== undefined && row.wholesale_price !== null && row.wholesale_price !== '') {
              webofferPrice = typeof row.wholesale_price === 'number' 
                ? row.wholesale_price 
                : parseFloat(String(row.wholesale_price).replace(',', '.').replace(/\s/g, '')) || 0
            } 
            // Fallback to retail_price if available
            else if (row.retail_price !== undefined && row.retail_price !== null && row.retail_price !== '') {
              webofferPrice = typeof row.retail_price === 'number'
                ? row.retail_price
                : parseFloat(String(row.retail_price).replace(',', '.').replace(/\s/g, '')) || 0
            }
            // Default to 0 if nothing is available
            else {
              webofferPrice = 0
            }
          }
          
          // Ensure weboffer_price is a valid number
          if (typeof webofferPrice === 'string') {
            webofferPrice = parseFloat(String(webofferPrice).replace(',', '.').replace(/\s/g, '')) || 0
          }
          
          // Final check - must be a number
          if (typeof webofferPrice !== 'number' || isNaN(webofferPrice)) {
            webofferPrice = 0
          }
          
          cleaned.weboffer_price = webofferPrice
          
          // Remove any undefined or null values (except required fields)
          Object.keys(cleaned).forEach(key => {
            // Don't delete required fields
            if (key === 'weboffer_price' || key === 'supplier_id' || key === 'sku' || key === 'name') {
              return
            }
            if (cleaned[key] === undefined || cleaned[key] === null) {
              delete cleaned[key]
            }
          })
          
          return cleaned
        })
        .filter((product): product is Record<string, unknown> => product !== null)

      // NORMALIZED CATEGORIES: Sync categories and add category_id BEFORE upsert
      setImportStatus('Syncing categories...')
      setImportProgress(5)

      let products = productsWithoutCategoryId
      let syncResult: CategorySyncResult | null = null

      if (company?.id && tenantId) {
        try {
          const prepResult = await prepareProductsWithCategoryId(
            productsWithoutCategoryId as Array<{ sku: string; category?: string }>,
            company.id,
            tenantId
          )
          products = prepResult.products as Record<string, unknown>[]
          syncResult = prepResult.syncResult
          setCategorySyncResult(syncResult)

          console.log('[CSVImportWizard] Category sync complete:', {
            categoriesCreated: syncResult.categoriesCreated,
            categoriesReused: syncResult.categoriesReused,
            productsWithCategoryId: products.filter(p => p.category_id).length,
          })
        } catch (syncError) {
          console.error('[CSVImportWizard] Category sync error:', syncError)
          // Continue with import even if category sync fails
        }
      }

      if (products.length === 0) {
        throw new Error(
          `No valid products to import. All ${transformedData.length} products are missing required fields (sku, name). ` +
          `Please check your column mappings in Step 2.`
        )
      }

      products = products.map((product) => ({
        ...product,
        tenant_id: tenantId,
      }))
      
      // Log summary
      if (products.length < transformedData.length) {
        console.warn(`Filtered out ${transformedData.length - products.length} invalid products, importing ${products.length} valid products`)
      }

      // Deduplicate products by SKU (keep last occurrence to handle updates)
      // This prevents "ON CONFLICT DO UPDATE command cannot affect row a second time" errors
      const productMap = new Map<string, typeof products[0]>()
      const duplicateCount = { count: 0 }
      
      products.forEach((product) => {
        const sku = String(product.sku || '').trim()
        if (sku) {
          if (productMap.has(sku)) {
            duplicateCount.count++
            // Keep the last occurrence (will overwrite previous)
          }
          productMap.set(sku, product)
        }
      })

      const deduplicatedProducts = Array.from(productMap.values())
      
      if (duplicateCount.count > 0) {
        console.warn(`Found ${duplicateCount.count} duplicate SKUs, deduplicated to ${deduplicatedProducts.length} unique products`)
      }

      setImportStatus('Importing products...')

      // Batch upsert (1000 at a time)
      const batchSize = 1000
      const batches: typeof deduplicatedProducts[] = []
      for (let i = 0; i < deduplicatedProducts.length; i += batchSize) {
        batches.push(deduplicatedProducts.slice(i, i + batchSize))
      }

      let importedCount = 0
      let failedCount = 0
      const errors: Array<{ row: number; error: string }> = []

      for (let i = 0; i < batches.length; i++) {
        const batch = batches[i]
        const startRow = i * batchSize + 1
        const endRow = Math.min(startRow + batch.length - 1, deduplicatedProducts.length)

        setImportStatus(`Importing products ${startRow}-${endRow} of ${deduplicatedProducts.length}...`)
        setImportProgress(Math.floor(((i + 0.5) / batches.length) * 100))

        try {
          const { error } = await supabase
            .from('products')
            .upsert(batch, {
              onConflict: 'tenant_id,sku',
              ignoreDuplicates: false,
            })

          if (error) {
            console.error(`Batch ${i + 1} error:`, error)
            
            // If batch fails due to duplicates, try inserting one by one as fallback
            if (error.message.includes('cannot affect row a second time')) {
              console.warn(`Batch ${i + 1}: Retrying with individual inserts due to duplicate conflict`)
              
              let batchImported = 0
              let batchFailed = 0
              
              // Insert products one by one to handle any remaining conflicts
              for (let j = 0; j < batch.length; j++) {
                try {
                  const { error: singleError } = await supabase
                    .from('products')
                    .upsert([batch[j]], {
                      onConflict: 'tenant_id,sku',
                      ignoreDuplicates: false,
                    })
                  
                  if (singleError) {
                    errors.push({ 
                      row: startRow + j, 
                      error: singleError.message 
                    })
                    batchFailed++
                  } else {
                    batchImported++
                  }
                } catch (singleErr) {
                  errors.push({ 
                    row: startRow + j, 
                    error: singleErr instanceof Error ? singleErr.message : 'Unknown error' 
                  })
                  batchFailed++
                }
              }
              
              importedCount += batchImported
              failedCount += batchFailed
            } else {
              errors.push({ row: startRow, error: error.message })
              failedCount += batch.length
            }
          } else {
            importedCount += batch.length
          }
        } catch (err) {
          console.error(`Batch ${i + 1} exception:`, err)
          errors.push({ 
            row: startRow, 
            error: err instanceof Error ? err.message : 'Unknown error' 
          })
          failedCount += batch.length
        }

        setImportProgress(Math.floor(((i + 1) / batches.length) * 100))
      }

      const duration = Math.round((Date.now() - startTime) / 1000)

      // Count images processed
      let imagesProcessed = 0
      for (const product of transformedData) {
        if (product.main_image) imagesProcessed++
        if (Array.isArray(product.images)) {
          imagesProcessed += (product.images as string[]).length
        }
      }

      const result: ImportResult = {
        success: failedCount === 0,
        imported: importedCount,
        updated: 0, // We can't easily distinguish new vs updated with upsert
        skipped: duplicateCount.count,
        failed: failedCount,
        total: products.length,
        // Use syncResult for accurate category counts (normalized architecture)
        categoriesCreated: syncResult?.categoriesCreated ?? smartMapping.categoryStats.newCategories,
        categoriesReused: syncResult?.categoriesReused ?? 0,
        categoriesMapped: syncResult?.categoryMap.size ?? smartMapping.categoryMappings.length,
        productsLinkedToCategories: products.filter(p => p.category_id).length,
        imagesProcessed,
        distributor: smartMapping.detectedDistributor?.displayName || 'Unknown',
        duration,
        errors,
        categorySyncDetails: syncResult?.details,
      }

      setImportProgress(100)
      setImportStatus('Import complete!')

      return result
    },
    onSuccess: async (result) => {
      setImportResult(result)
      smartMapping.goToStep(5)

      // Categories are already synced during import (non-destructive sync)
      // Just invalidate caches to refresh UI
      queryClient.invalidateQueries({ queryKey: ['tenant', tenantId, 'categories'] })
      queryClient.invalidateQueries({ queryKey: ['tenant', tenantId, 'category-hierarchy'] })
      queryClient.invalidateQueries({ queryKey: ['tenant', tenantId, 'products'] })
      queryClient.invalidateQueries({ queryKey: ['tenant', tenantId, 'products', 'categories-for-filter'] })

      // Notify all company users about the catalog update (only if meaningful changes)
      if ((result.imported || 0) > 0 || (result.updated || 0) > 0) {
        sendNotification({
          type: 'catalog_updated',
          metadata: {
            imported_count: result.imported || 0,
            updated_count: result.updated || 0,
          },
          targetAudience: 'all_companies',
        })
      }

      trackEvent(AnalyticsEvents.CSV_IMPORT_COMPLETED, {
        productsImported: result.imported,
        totalRows: result.total,
        distributor: result.distributor,
        duration: result.duration,
        categoriesCreated: result.categoriesCreated,
        productsLinkedToCategories: result.productsLinkedToCategories,
      })

      toast({
        title: 'Import Complete! 🎉',
        description: `Successfully imported ${result.imported} products with ${result.categoriesCreated} new categories.`,
      })
    },
    onError: (error) => {
      trackEvent(AnalyticsEvents.CSV_IMPORT_FAILED, {
        error: error instanceof Error ? error.message : 'Unknown error',
      })

      toast({
        title: 'Import Failed',
        description: error instanceof Error ? error.message : 'An error occurred',
        variant: 'destructive',
      })
    },
  })

  /**
   * Delete all products mutation
   * With option to preserve categories (default: true)
   */
  const deleteAllMutation = useMutation({
    mutationFn: async () => {
      if (!tenantId) {
        throw new Error('Missing tenant context')
      }
      // First, unlink all products from categories (set category_id to null)
      // This ensures foreign key constraints don't block deletion
      const { error: unlinkError } = await supabase
        .from('products')
        .update({ category_id: null })
        .not('category_id', 'is', null)
        .eq('tenant_id', tenantId)

      if (unlinkError) {
        console.error('Error unlinking products from categories', unlinkError)
      }

      // Delete all products from the database
      // Using neq with empty string to match all rows with non-null id
      const { error, count } = await supabase
        .from('products')
        .delete()
        .not('id', 'is', null)
        .eq('tenant_id', tenantId)

      if (error) {
        throw new Error(error.message)
      }

      let categoriesDeleted = 0

      // Only delete categories if preserveCategoriesOnDelete is false
      if (!preserveCategoriesOnDelete && tenantId) {
        const { error: catError, count: catCount } = await supabase
          .from('categories')
          .delete()
          .eq('tenant_id', tenantId)

        if (catError) {
          console.error('Error deleting categories with products', catError)
        } else {
          categoriesDeleted = catCount || 0
        }
      }

      return { deleted: count || 0, categoriesDeleted, categoriesPreserved: preserveCategoriesOnDelete }
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['tenant', tenantId, 'products'] })
      queryClient.invalidateQueries({ queryKey: ['tenant', tenantId, 'category-hierarchy'] })
      queryClient.invalidateQueries({ queryKey: ['tenant', tenantId, 'products', 'categories-for-filter'] })
      
      if (!result.categoriesPreserved) {
        queryClient.invalidateQueries({ queryKey: ['tenant', tenantId, 'categories'] })
      }
      
      setDeleteDialogOpen(false)
      
      const categoryMsg = result.categoriesPreserved 
        ? 'Categories were preserved.' 
        : `${result.categoriesDeleted} categories deleted.`
      
      toast({
        title: 'All Products Deleted',
        description: `Successfully deleted ${result.deleted || 'all'} products. ${categoryMsg}`,
      })
    },
    onError: (error) => {
      toast({
        title: 'Delete Failed',
        description: error instanceof Error ? error.message : 'Failed to delete products',
        variant: 'destructive',
      })
    },
  })

  /**
   * Navigation helpers
   */
  const canGoNext = useCallback(() => {
    switch (smartMapping.currentStep) {
      case 1:
        return smartMapping.detectedDistributor !== null && smartMapping.totalProducts > 0
      case 2:
        return smartMapping.columnValidation.isValid
      case 3:
        return true // Can always proceed from category mapping
      case 4:
        return smartMapping.validation !== null && 
               (smartMapping.validation.validProducts > 0 || smartMapping.validation.totalProducts > 0)
      default:
        return false
    }
  }, [smartMapping])

  const handleNext = useCallback(() => {
    const step = smartMapping.currentStep
    
    if (step === 1) {
      smartMapping.goToStep(2)
    } else if (step === 2) {
      smartMapping.analyzeCategoriesStep()
    } else if (step === 3) {
      smartMapping.validateData()
    } else if (step === 4) {
      importMutation.mutate()
    }
  }, [smartMapping, importMutation])

  const handleBack = useCallback(() => {
    const step = smartMapping.currentStep
    if (step > 1 && step < 5) {
      smartMapping.goToStep((step - 1) as 1 | 2 | 3 | 4 | 5)
    }
  }, [smartMapping])

  const handleReset = useCallback(() => {
    smartMapping.reset()
    setSelectedFile(null)
    setImportResult(null)
    setImportProgress(0)
    setImportStatus('')
  }, [smartMapping])

  const handleViewProducts = useCallback(() => {
    navigate(withBase('/dashboard/products'))
  }, [navigate, withBase])

  // Calculate overall progress
  const overallProgress = ((smartMapping.currentStep - 1) / (WIZARD_STEPS.length - 1)) * 100

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-2 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-slate-600 to-slate-800 flex items-center justify-center shadow-lg">
              <Upload className="w-5 h-5 text-white" />
            </div>
            CSV Import Wizard
          </h1>
          <p className="text-muted-foreground">
            Import products from any distributor with intelligent auto-detection
          </p>
        </div>
        
        {/* Delete All Products Button */}
        <Button
          variant="destructive"
          size="sm"
          onClick={() => setDeleteDialogOpen(true)}
          className="bg-red-600 hover:bg-red-700 text-white"
        >
          <Trash2 className="w-4 h-4 mr-2" />
          Delete All Products
        </Button>
      </div>

      {/* Step Progress Bar - Glassmorphism */}
      <GlassCard className="p-6">
        <div className="flex justify-between items-center">
          {WIZARD_STEPS.map((step, index) => {
            const isActive = smartMapping.currentStep === step.id
            const isComplete = smartMapping.currentStep > step.id
            const StepIcon = step.icon

            return (
              <div key={step.id} className="flex flex-col items-center flex-1">
                <div className="flex items-center w-full">
                  {/* Connector line before */}
                  {index > 0 && (
                    <div 
                      className={cn(
                        "h-0.5 flex-1 transition-colors duration-300",
                        isComplete || isActive 
                          ? "bg-gradient-to-r from-slate-500 to-slate-600" 
                          : "bg-gray-200 dark:bg-gray-700"
                      )}
                    />
                  )}
                  
                  {/* Step circle */}
                  <div
                    className={cn(
                      "relative flex items-center justify-center w-10 h-10 rounded-full border-2 transition-all duration-300",
                      isActive && "border-slate-500 bg-slate-600 text-white scale-110 shadow-lg",
                      isComplete && "border-slate-500 bg-slate-600 text-white",
                      !isActive && !isComplete && "border-gray-300 dark:border-gray-600 text-gray-400 dark:text-gray-500 bg-white dark:bg-gray-900"
                    )}
                  >
                    {isComplete ? (
                      <CheckCircle2 className="w-5 h-5" />
                    ) : (
                      <StepIcon className="w-4 h-4" />
                    )}
                    {isActive && (
                      <div className="absolute -inset-1 rounded-full bg-slate-500/20 animate-pulse" />
                    )}
                  </div>
                  
                  {/* Connector line after */}
                  {index < WIZARD_STEPS.length - 1 && (
                    <div 
                      className={cn(
                        "h-0.5 flex-1 transition-colors duration-300",
                        isComplete 
                          ? "bg-gradient-to-r from-slate-500 to-slate-600" 
                          : "bg-gray-200 dark:bg-gray-700"
                      )}
                    />
                  )}
                </div>
                
                {/* Step labels */}
                <div className="mt-2 text-center">
                  <p className={cn(
                    "text-sm font-medium",
                    isActive && "text-slate-700 dark:text-slate-300",
                    isComplete && "text-slate-600 dark:text-slate-400",
                    !isActive && !isComplete && "text-gray-400 dark:text-gray-500"
                  )}>
                    {step.name}
                  </p>
                  <p className="text-xs text-muted-foreground hidden sm:block">
                    {step.description}
                  </p>
                </div>
              </div>
            )
          })}
        </div>

        <Progress value={overallProgress} className="h-1 mt-4" />
      </GlassCard>

      {/* Step Content */}
      <div className="min-h-[400px]">
        {smartMapping.currentStep === 1 && (
          <UploadStep
            selectedFile={selectedFile}
            onFileSelect={handleFileSelect}
            isProcessing={smartMapping.isProcessing}
            detectedDistributor={smartMapping.detectedDistributor}
            detectorConfidence={smartMapping.detectorConfidence}
            totalProducts={smartMapping.totalProducts}
            detectedColumns={smartMapping.detectedColumns}
            requiredColumnsFound={smartMapping.requiredColumnsFound}
          />
        )}

        {smartMapping.currentStep === 2 && (
          <ColumnMappingStep
            columnMappings={smartMapping.columnMappings}
            columnValidation={smartMapping.columnValidation}
            availableFields={smartMapping.availableFields}
            distributorName={smartMapping.detectedDistributor?.displayName || 'Unknown'}
            onUpdateMapping={smartMapping.updateColumnMapping}
          />
        )}

        {smartMapping.currentStep === 3 && (
          <CategoryMappingStep
            categoryMappings={smartMapping.categoryMappings}
            categoryStats={smartMapping.categoryStats}
            existingCategories={smartMapping.existingCategories}
            onUpdateMapping={smartMapping.updateCategoryMapping}
          />
        )}

        {smartMapping.currentStep === 4 && (
          <ValidationStep
            validation={smartMapping.validation}
            totalProducts={smartMapping.totalProducts}
            distributorName={smartMapping.detectedDistributor?.displayName || 'Unknown'}
            isImporting={importMutation.isPending}
            importProgress={importProgress}
            importStatus={importStatus}
            newCategories={smartMapping.categoryMappings
              .filter(m => m.status === 'new' || m.isNew)
              .map(m => ({ name: m.targetCategory, productCount: m.productCount }))
            }
          />
        )}

        {smartMapping.currentStep === 5 && importResult && (
          <ImportResultsStep
            result={importResult}
            onViewProducts={handleViewProducts}
            onImportMore={handleReset}
          />
        )}
      </div>

      {/* Navigation Buttons */}
      {smartMapping.currentStep < 5 && (
        <div className="flex justify-between items-center pt-4 border-t border-gray-200 dark:border-gray-800">
          {/* Left side buttons */}
          <div className="flex items-center gap-3">
            {/* Back button on steps > 1 */}
            {smartMapping.currentStep > 1 && (
              <Button
                variant="outline"
                onClick={handleBack}
                disabled={importMutation.isPending}
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                {t('general.back')}
              </Button>
            )}
            
            {/* Cancel/Reset button - always visible once file is selected */}
            {selectedFile && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleReset}
                disabled={importMutation.isPending}
                className="text-muted-foreground hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20 border border-transparent hover:border-red-200 dark:hover:border-red-800 transition-all"
              >
                <X className="w-4 h-4 mr-1.5" />
                {t('csvImport.wizard.startOver')}
              </Button>
            )}
          </div>

          {/* Right side - Continue/Import button */}
          <div className="flex items-center gap-2">
            {smartMapping.currentStep === 4 ? (
              <Button
                onClick={handleNext}
                disabled={!canGoNext() || importMutation.isPending}
                className="bg-gradient-to-r from-slate-700 to-slate-900 hover:from-slate-800 hover:to-slate-950 text-white"
              >
                {importMutation.isPending ? (
                  <>
                    <span className="animate-spin mr-2">⏳</span>
                    {t('csvImport.validation.importingProducts')}... {importProgress}%
                  </>
                ) : (
                  <>
                    <Zap className="w-4 h-4 mr-2" />
                    {t('csvImport.wizard.startImport')}
                  </>
                )}
              </Button>
            ) : (
              <Button
                onClick={handleNext}
                disabled={!canGoNext() || smartMapping.isProcessing}
                className="bg-slate-800 hover:bg-slate-900 text-white"
              >
                {smartMapping.isProcessing ? (
                  <>
                    <span className="animate-spin mr-2">⏳</span>
                    {t('general.loading')}...
                  </>
                ) : (
                  <>
                    {t('general.continue')}
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Delete All Products Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600 dark:text-red-400">
              <AlertTriangle className="w-5 h-5" />
              Delete All Products
            </DialogTitle>
            <DialogDescription className="pt-2">
              This action will permanently delete <strong>ALL products</strong> from the database.
              <br /><br />
              <span className="font-semibold text-amber-600 dark:text-amber-400">
                This action cannot be undone!
              </span>
            </DialogDescription>
          </DialogHeader>
          
          {/* Preserve Categories Checkbox */}
          <div className="flex items-start gap-3 py-3 px-4 bg-slate-50 dark:bg-slate-900/50 rounded-lg border border-slate-200 dark:border-slate-700">
            <input
              type="checkbox"
              id="preserveCategories"
              checked={preserveCategoriesOnDelete}
              onChange={(e) => setPreserveCategoriesOnDelete(e.target.checked)}
              className="mt-1 h-4 w-4 rounded border-gray-300 text-slate-600 focus:ring-slate-500"
            />
            <label htmlFor="preserveCategories" className="text-sm">
              <span className="font-medium text-slate-700 dark:text-slate-300">
                Preserve categories
              </span>
              <p className="text-muted-foreground mt-0.5">
                Keep your category hierarchy intact. Useful when re-importing products with the same categories.
              </p>
            </label>
          </div>
          
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setDeleteDialogOpen(false)}
              disabled={deleteAllMutation.isPending}
            >
              {t('general.cancel')}
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteAllMutation.mutate()}
              disabled={deleteAllMutation.isPending}
              className="bg-red-600 hover:bg-red-700"
            >
              {deleteAllMutation.isPending ? (
                <>
                  <span className="animate-spin mr-2">⏳</span>
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete All Products
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
