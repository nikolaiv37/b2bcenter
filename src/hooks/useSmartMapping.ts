import { useState, useCallback, useMemo } from 'react'
import {
  DistributorPreset,
  StandardField,
  detectDistributor,
  autoMapColumns,
  extractAndMatchCategories,
  validateColumnMappings,
  STANDARD_FIELDS,
  REQUIRED_FIELDS,
  UNIQUE_FIELDS,
  DISTRIBUTOR_PRESETS,
} from '@/lib/csv/distributors'

export interface ColumnMapping {
  sourceColumn: string
  targetField: StandardField | 'ignore' | null
  confidence: number
  autoMatched: boolean
  status: 'auto' | 'review' | 'manual' | 'unmapped'
}

export interface CategoryMapping {
  sourceCategory: string
  targetCategory: string
  productCount: number
  confidence: number
  status: 'exact' | 'auto' | 'review' | 'manual' | 'new'
  isNew?: boolean
  fieldType: 'category' | 'subcategory' // Track which field this mapping is for
}

export interface ImportValidation {
  totalProducts: number
  validProducts: number
  duplicateSKUs: number
  missingPrices: number
  newCategories: number
  issues: Array<{
    type: 'error' | 'warning' | 'info'
    field: string
    message: string
    count: number
    rows?: number[]
  }>
}

export interface SmartMappingState {
  // Step 1: Upload & Detection
  detectedDistributor: DistributorPreset | null
  detectorConfidence: number
  totalProducts: number
  detectedColumns: number
  requiredColumnsFound: number

  // Step 2: Column Mappings
  columnMappings: ColumnMapping[]
  columnValidation: {
    isValid: boolean
    missingRequired: StandardField[]
    missingRecommended: StandardField[]
    duplicateMappings: Array<{ field: StandardField; columns: string[] }>
    totalMapped: number
    totalColumns: number
  }

  // Step 3: Category Mappings
  categoryMappings: CategoryMapping[]
  categoryStats: {
    exactMatches: number
    autoMatches: number
    manualReview: number
    newCategories: number
  }

  // Step 4: Validation
  validation: ImportValidation | null

  // Processing state
  isProcessing: boolean
  currentStep: 1 | 2 | 3 | 4 | 5
  error: string | null
}

const initialState: SmartMappingState = {
  detectedDistributor: null,
  detectorConfidence: 0,
  totalProducts: 0,
  detectedColumns: 0,
  requiredColumnsFound: 0,
  columnMappings: [],
  columnValidation: {
    isValid: false,
    missingRequired: [...REQUIRED_FIELDS],
    missingRecommended: [],
    duplicateMappings: [],
    totalMapped: 0,
    totalColumns: 0,
  },
  categoryMappings: [],
  categoryStats: {
    exactMatches: 0,
    autoMatches: 0,
    manualReview: 0,
    newCategories: 0,
  },
  validation: null,
  isProcessing: false,
  currentStep: 1,
  error: null,
}

export function useSmartMapping() {
  const [state, setState] = useState<SmartMappingState>(initialState)
  const [rawData, setRawData] = useState<Record<string, unknown>[]>([])
  const [headers, setHeaders] = useState<string[]>([])

  /**
   * Reset the entire state
   */
  const reset = useCallback(() => {
    setState(initialState)
    setRawData([])
    setHeaders([])
  }, [])

  /**
   * Step 1: Analyze uploaded CSV and auto-detect distributor
   */
  const analyzeCSV = useCallback((
    csvHeaders: string[],
    csvData: Record<string, unknown>[]
  ) => {
    setState(prev => ({ ...prev, isProcessing: true, error: null }))
    setHeaders(csvHeaders)
    setRawData(csvData)

    try {
      // Detect distributor
      const detection = detectDistributor(csvHeaders)
      
      // Auto-map columns
      const columnMap = autoMapColumns(csvHeaders, detection.distributor)
      
      // Convert to ColumnMapping array
      const mappings: ColumnMapping[] = csvHeaders.map(header => {
        const mapping = columnMap[header]
        let status: ColumnMapping['status'] = 'unmapped'
        
        if (mapping.autoMatched && mapping.confidence >= 90) {
          status = 'auto'
        } else if (mapping.autoMatched && mapping.confidence >= 70) {
          status = 'review'
        } else if (mapping.field) {
          status = 'manual'
        }

        return {
          sourceColumn: header,
          targetField: mapping.field,
          confidence: mapping.confidence,
          autoMatched: mapping.autoMatched,
          status,
        }
      })

      // Validate column mappings
      const validation = validateColumnMappings(columnMap)

      // Count required columns found
      const requiredFound = REQUIRED_FIELDS.filter(f => 
        mappings.some(m => m.targetField === f)
      ).length

      setState(prev => ({
        ...prev,
        detectedDistributor: detection.distributor,
        detectorConfidence: detection.confidence,
        totalProducts: csvData.length,
        detectedColumns: csvHeaders.length,
        requiredColumnsFound: requiredFound,
        columnMappings: mappings,
        columnValidation: validation,
        isProcessing: false,
        currentStep: 1,
      }))
    } catch (error) {
      setState(prev => ({
        ...prev,
        isProcessing: false,
        error: error instanceof Error ? error.message : 'Failed to analyze CSV',
      }))
    }
  }, [])

  /**
   * Step 2: Update column mapping
   * Automatically unmaps previous columns if mapping a unique/required field
   */
  const updateColumnMapping = useCallback((
    sourceColumn: string,
    targetField: StandardField | 'ignore' | null
  ) => {
    setState(prev => {
      let newMappings = prev.columnMappings.map(m => {
        if (m.sourceColumn === sourceColumn) {
          return {
            ...m,
            targetField,
            autoMatched: false,
            status: targetField ? 'manual' as const : 'unmapped' as const,
            confidence: targetField ? 100 : 0,
          }
        }
        return m
      })

      // If mapping a unique/required field, unmap it from other columns
      if (targetField && targetField !== 'ignore' && UNIQUE_FIELDS.includes(targetField)) {
        newMappings = newMappings.map(m => {
          // Keep the current mapping, but unmap other columns that were mapped to this field
          if (m.sourceColumn !== sourceColumn && m.targetField === targetField) {
            return {
              ...m,
              targetField: null,
              autoMatched: false,
              status: 'unmapped' as const,
              confidence: 0,
            }
          }
          return m
        })
      }

      // Re-validate
      const columnMap: Record<string, { field: StandardField | 'ignore' | null; confidence: number; autoMatched: boolean }> = {}
      for (const m of newMappings) {
        columnMap[m.sourceColumn] = {
          field: m.targetField,
          confidence: m.confidence,
          autoMatched: m.autoMatched,
        }
      }
      const validation = validateColumnMappings(columnMap)

      return {
        ...prev,
        columnMappings: newMappings,
        columnValidation: validation,
      }
    })
  }, [])

  /**
   * Move to category mapping step and analyze categories
   */
  const analyzeCategoriesStep = useCallback(() => {
    setState(prev => ({ ...prev, isProcessing: true }))

    try {
      // Find both category and subcategory columns
      const categoryMapping = state.columnMappings.find(m => m.targetField === 'category')
      const subCategoryMapping = state.columnMappings.find(m => m.targetField === 'subcategory')
      
      if (!categoryMapping && !subCategoryMapping) {
        // No category columns mapped, skip category matching
        setState(prev => ({
          ...prev,
          isProcessing: false,
          currentStep: 3,
          categoryMappings: [],
          categoryStats: {
            exactMatches: 0,
            autoMatches: 0,
            manualReview: 0,
            newCategories: 0,
          },
        }))
        return
      }

      const distributorMappings = state.detectedDistributor?.categoryMappings || {}
      const allMappings: CategoryMapping[] = []

      // Helper function to process category results
      const processCategoryResults = (
        results: ReturnType<typeof extractAndMatchCategories>,
        fieldType: 'category' | 'subcategory'
      ): CategoryMapping[] => {
        return results.map(result => {
          let status: CategoryMapping['status'] = 'manual'
          // isNew should only be true when user EXPLICITLY creates a new category
          // Initially set to false - it will be set true when user creates new in UI
          const isNew = false
          
          if (result.method === 'exact') {
            status = 'exact'
          } else if (result.method === 'saved') {
            status = 'auto'
          } else if (result.method === 'synonym' && result.confidence >= 90) {
            status = 'auto'
          } else if (result.method === 'fuzzy' && result.confidence >= 80) {
            status = 'review'
          } else if (result.standardCategory === 'Uncategorized') {
            // Mark as review - user needs to select or create category
            status = 'review'
          } else {
            status = 'review'
          }

          return {
            sourceCategory: result.sourceCategory,
            targetCategory: result.standardCategory,
            productCount: result.productCount,
            confidence: result.confidence,
            status,
            isNew,
            fieldType,
          }
        })
      }

      // Process category column
      if (categoryMapping) {
        const categoryResults = extractAndMatchCategories(
          rawData,
          categoryMapping.sourceColumn,
          distributorMappings
        )
        allMappings.push(...processCategoryResults(categoryResults, 'category'))
      }

      // Process subcategory column
      if (subCategoryMapping) {
        const subCategoryResults = extractAndMatchCategories(
          rawData,
          subCategoryMapping.sourceColumn,
          distributorMappings
        )
        allMappings.push(...processCategoryResults(subCategoryResults, 'subcategory'))
      }

      // Calculate stats (across both category types)
      const stats = {
        exactMatches: allMappings.filter(m => m.status === 'exact').length,
        autoMatches: allMappings.filter(m => m.status === 'auto').length,
        manualReview: allMappings.filter(m => m.status === 'review').length,
        newCategories: allMappings.filter(m => m.status === 'new').length,
      }

      setState(prev => ({
        ...prev,
        isProcessing: false,
        currentStep: 3,
        categoryMappings: allMappings,
        categoryStats: stats,
      }))
    } catch (error) {
      setState(prev => ({
        ...prev,
        isProcessing: false,
        error: error instanceof Error ? error.message : 'Failed to analyze categories',
      }))
    }
  }, [state.columnMappings, state.detectedDistributor, rawData])

  /**
   * Step 3: Update category mapping
   */
  const updateCategoryMapping = useCallback((
    sourceCategory: string,
    targetCategory: string,
    isNew = false,
    fieldType?: 'category' | 'subcategory'
  ) => {
    setState(prev => {
      const newMappings = prev.categoryMappings.map(m => {
        // Match by sourceCategory and optionally by fieldType
        if (m.sourceCategory === sourceCategory && (!fieldType || m.fieldType === fieldType)) {
          return {
            ...m,
            targetCategory,
            status: isNew ? 'new' as const : 'manual' as const,
            confidence: 100,
            isNew,
          }
        }
        return m
      })

      // Recalculate stats
      const stats = {
        exactMatches: newMappings.filter(m => m.status === 'exact').length,
        autoMatches: newMappings.filter(m => m.status === 'auto').length,
        manualReview: newMappings.filter(m => m.status === 'review').length,
        newCategories: newMappings.filter(m => m.status === 'new' || m.isNew).length,
      }

      return {
        ...prev,
        categoryMappings: newMappings,
        categoryStats: stats,
      }
    })
  }, [])

  /**
   * Step 4: Validate data before import
   */
  const validateData = useCallback(() => {
    setState(prev => ({ ...prev, isProcessing: true }))

    try {
      // Build field mapping lookup
      const fieldMap: Record<string, string> = {}
      for (const mapping of state.columnMappings) {
        if (mapping.targetField && mapping.targetField !== 'ignore') {
          fieldMap[mapping.sourceColumn] = mapping.targetField
        }
      }

      // Build category mapping lookup
      const categoryMap: Record<string, string> = {}
      for (const mapping of state.categoryMappings) {
        categoryMap[mapping.sourceCategory] = mapping.targetCategory
      }

      // Validate each row
      const skuCounts: Record<string, number[]> = {}
      const issues: ImportValidation['issues'] = []
      let validProducts = 0
      let missingPrices = 0
      let duplicateSKUs = 0

      const skuColumn = state.columnMappings.find(m => m.targetField === 'sku')?.sourceColumn
      const priceColumn = state.columnMappings.find(m => m.targetField === 'wholesale_price')?.sourceColumn

      for (let i = 0; i < rawData.length; i++) {
        const row = rawData[i]
        const rowNum = i + 2 // Account for header row

        // Check SKU
        if (skuColumn) {
          const sku = row[skuColumn] as string
          if (sku && typeof sku === 'string' && sku.trim()) {
            if (!skuCounts[sku]) {
              skuCounts[sku] = []
            }
            skuCounts[sku].push(rowNum)
          }
        }

        // Check price
        if (priceColumn) {
          const price = row[priceColumn]
          if (!price || (typeof price === 'number' && price <= 0) ||
              (typeof price === 'string' && (isNaN(parseFloat(price)) || parseFloat(price) <= 0))) {
            missingPrices++
          }
        }

        validProducts++
      }

      // Count duplicates
      for (const [sku, rows] of Object.entries(skuCounts)) {
        if (rows.length > 1) {
          duplicateSKUs++
          issues.push({
            type: 'warning',
            field: 'sku',
            message: `Duplicate SKU: ${sku}`,
            count: rows.length,
            rows,
          })
        }
      }

      // Add price issues
      if (missingPrices > 0) {
        issues.push({
          type: 'error',
          field: 'wholesale_price',
          message: 'Missing or invalid price',
          count: missingPrices,
        })
      }

      // Count new categories
      const newCategories = state.categoryMappings.filter(m => m.isNew || m.status === 'new').length

      if (newCategories > 0) {
        issues.push({
          type: 'info',
          field: 'category',
          message: 'New categories will be created',
          count: newCategories,
        })
      }

      const validation: ImportValidation = {
        totalProducts: rawData.length,
        validProducts: validProducts - missingPrices,
        duplicateSKUs,
        missingPrices,
        newCategories,
        issues,
      }

      setState(prev => ({
        ...prev,
        isProcessing: false,
        currentStep: 4,
        validation,
      }))
    } catch (error) {
      setState(prev => ({
        ...prev,
        isProcessing: false,
        error: error instanceof Error ? error.message : 'Failed to validate data',
      }))
    }
  }, [rawData, state.columnMappings, state.categoryMappings])

  /**
   * Transform data for import based on mappings
   */
  const getTransformedData = useCallback((): Record<string, unknown>[] => {
    // Build field mapping lookup
    const fieldMap: Record<string, string> = {}
    const imageColumns: string[] = []
    
    for (const mapping of state.columnMappings) {
      if (mapping.targetField === 'images') {
        imageColumns.push(mapping.sourceColumn)
      } else if (mapping.targetField && mapping.targetField !== 'ignore') {
        fieldMap[mapping.sourceColumn] = mapping.targetField
      }
    }

    // Build category mapping lookup
    const categoryMap: Record<string, string> = {}
    for (const mapping of state.categoryMappings) {
      categoryMap[mapping.sourceCategory] = mapping.targetCategory
    }

    // Transform each row
    return rawData.map(row => {
      const transformed: Record<string, unknown> = {}
      const collectedImages = new Set<string>()

      const addImage = (value: unknown) => {
        if (typeof value !== 'string') return
        const trimmed = value.trim()
        if (!trimmed) return
        if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) return
        collectedImages.add(trimmed)
      }
      
      // Map standard fields
      for (const [sourceCol, targetField] of Object.entries(fieldMap)) {
        let value = row[sourceCol]
        
        // Transform category
        if (targetField === 'category' && typeof value === 'string') {
          value = categoryMap[value.trim()] || value
        }
        
        // Parse numeric fields
        if (targetField === 'wholesale_price' || targetField === 'retail_price' ||
            targetField === 'stock' || targetField === 'moq' ||
            targetField === 'weight' || targetField === 'transportational_weight') {
          if (typeof value === 'string') {
            // Handle European number format (comma as decimal)
            value = parseFloat(value.replace(',', '.')) || 0
          }
        }
        
        transformed[targetField] = value
      }

      addImage(transformed.main_image)
      
      // Collect images
      for (const imgCol of imageColumns) {
        addImage(row[imgCol])
      }

      if (Array.isArray(row.__merged_image_urls)) {
        for (const imgUrl of row.__merged_image_urls) {
          addImage(imgUrl)
        }
      }

      const images = Array.from(collectedImages)
      if (images.length > 0) {
        transformed.images = images
      }
      
      // Set main_image from first image if not set
      if (!transformed.main_image && images.length > 0) {
        transformed.main_image = images[0]
      }
      
      return transformed
    })
  }, [rawData, state.columnMappings, state.categoryMappings])

  /**
   * Go to a specific step
   */
  const goToStep = useCallback((step: 1 | 2 | 3 | 4 | 5) => {
    setState(prev => ({ ...prev, currentStep: step }))
  }, [])

  /**
   * Available standard fields for dropdown
   */
  const availableFields = useMemo(() => {
    return Object.keys(STANDARD_FIELDS).map(field => ({
      value: field,
      label: field.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
    }))
  }, [])

  /**
   * Get unique categories from current data
   */
  const existingCategories = useMemo(() => {
    const categories = new Set<string>()
    for (const mapping of state.categoryMappings) {
      if (mapping.status !== 'new' && mapping.targetCategory !== 'Uncategorized') {
        categories.add(mapping.targetCategory)
      }
    }
    return Array.from(categories).sort()
  }, [state.categoryMappings])

  return {
    // State
    ...state,
    rawData,
    headers,
    availableFields,
    existingCategories,
    distributorPresets: DISTRIBUTOR_PRESETS,

    // Actions
    reset,
    analyzeCSV,
    updateColumnMapping,
    analyzeCategoriesStep,
    updateCategoryMapping,
    validateData,
    getTransformedData,
    goToStep,
  }
}
