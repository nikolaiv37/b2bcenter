import Papa from 'papaparse'
import { Product } from '@/types'

export interface CSVRow {
  id?: string | number
  model?: string
  sku: string
  retail_price?: string | number
  weboffer_price: string | number
  name: string
  category?: string
  manufacturer?: string
  description?: string
  availability?: string
  quantity?: string | number
  weight?: string | number
  transportational_weight?: string | number
  date_expected?: string
  main_image?: string
  image1?: string
  image2?: string
  image3?: string
  image4?: string
  image5?: string
  image6?: string
  image7?: string
  image8?: string
  image9?: string
  image10?: string
  // Ignore all attribute columns (17 of them)
  [key: string]: string | number | undefined
}

export interface ParseResult {
  data: CSVRow[]
  errors: Papa.ParseError[]
  meta: Papa.ParseMeta
}

// Alternative SKU field names used by different distributors
const SKU_FIELD_NAMES = [
  'sku', 'SKU', 'Sku',
  'itemcode', 'ItemCode', 'item_code', 'ITEMCODE',
  'productcode', 'ProductCode', 'product_code', 'PRODUCTCODE',
  'artikelnummer', 'Artikelnummer', 'ARTIKELNUMMER',
  'artnr', 'ArtNr', 'art_nr',
  'code', 'Code', 'CODE',
  'barcode', 'Barcode', 'BARCODE',
  'barcodemain', 'BarcodeMain',
]

/**
 * Find the SKU value from a row by checking multiple possible field names
 */
function findSkuValue(row: Record<string, unknown>): string | null {
  for (const fieldName of SKU_FIELD_NAMES) {
    const value = row[fieldName] || row[fieldName.toLowerCase()]
    if (value && typeof value === 'string' && value.trim().length > 0) {
      return value.trim()
    }
  }
  return null
}

/**
 * Parse CSV file with proper UTF-8 handling for Greek/Bulgarian characters
 * Auto-detects delimiter (semicolon or comma) and uses quoteChar for proper escaping
 * Handles field mismatches gracefully (trailing empty fields are OK)
 */
export function parseCSV(file: File, preferredDelimiter: string = ';'): Promise<ParseResult> {
  return new Promise((resolve, reject) => {
    // Read the file first to detect delimiter
    const reader = new FileReader()
    reader.onload = (e) => {
      const text = e.target?.result as string
      const firstLine = text.split('\n')[0] || ''
      
      // Count occurrences of common delimiters
      const semicolonCount = (firstLine.match(/;/g) || []).length
      const commaCount = (firstLine.match(/,/g) || []).length
      
      // Use the delimiter with more occurrences, or preferred delimiter if equal
      let delimiter = preferredDelimiter
      if (commaCount > semicolonCount) {
        delimiter = ','
      } else if (semicolonCount > commaCount) {
        delimiter = ';'
      }
      
      console.log('CSV Delimiter detection:', {
        firstLine: firstLine.substring(0, 100),
        semicolonCount,
        commaCount,
        detectedDelimiter: delimiter,
        preferredDelimiter,
      })

      // Now parse the full text with the detected delimiter
      Papa.parse(text, {
        header: true,
        delimiter: delimiter,
        quoteChar: '"',
        escapeChar: '"',
        skipEmptyLines: 'greedy', // More aggressive empty line skipping
        encoding: 'UTF-8',
        // Don't throw errors on field mismatches (trailing empty fields are OK)
        transformHeader: (header: string) => {
          // Normalize header names: trim, lowercase, replace spaces with underscores
          return header.trim().toLowerCase().replace(/\s+/g, '_')
        },
        transform: (value: string) => {
          // Preserve UTF-8 encoding for Greek/Bulgarian characters
          return value
        },
        complete: (results) => {
          // Filter out field mismatch errors (they're just warnings about trailing empty fields)
          const nonFatalErrors = results.errors.filter(
            (error) => error.type !== 'FieldMismatch' || error.code !== 'TooFewFields'
          )

          // Log first row for debugging
          if (results.data.length > 0) {
            console.log('First parsed row (sample):', {
              keys: Object.keys(results.data[0] as object),
              sample: results.data[0],
            })
          }

          // Filter out completely empty rows and rows without any identifier
          // Support multiple SKU field names: sku, itemcode, productcode, artikelnummer, etc.
          const validData = (results.data as CSVRow[]).filter((row) => {
            if (!row) return false
            
            const rowObj = row as Record<string, unknown>
            
            // Check for any SKU-like field
            const skuValue = findSkuValue(rowObj)
            if (skuValue) return true
            
            // Also accept rows that have a name field (for very flexible parsing)
            const nameValue = rowObj['name'] || rowObj['Name'] || rowObj['NAME'] || 
                             rowObj['productname'] || rowObj['ProductName'] ||
                             rowObj['title'] || rowObj['Title']
            return nameValue && typeof nameValue === 'string' && nameValue.trim().length > 0
          })

          console.log('Parsed CSV:', {
            totalRows: results.data.length,
            validRows: validData.length,
            delimiter: delimiter,
            fieldMismatchWarnings: results.errors.filter(
              (e) => e.type === 'FieldMismatch'
            ).length,
            otherErrors: nonFatalErrors.length,
            firstRowKeys: results.data.length > 0 ? Object.keys(results.data[0] as object) : [],
          })

          if (validData.length === 0 && results.data.length > 0) {
            console.warn('No valid rows found. Sample row:', results.data[0])
            console.warn('Available fields in first row:', Object.keys(results.data[0] as object))
          }

          resolve({
            data: validData,
            errors: nonFatalErrors, // Only return non-field-mismatch errors
            meta: results.meta,
          })
        },
        error: (error: Error) => {
          reject(error)
        },
      })
    }
    
    reader.onerror = () => {
      reject(new Error('Failed to read CSV file'))
    }
    
    // Read the full file
    reader.readAsText(file, 'UTF-8')
  })
}

/**
 * Flexible CSV parser for the Import Wizard
 * Accepts ANY CSV structure without requiring specific fields
 * Returns all non-empty rows for the wizard to process
 */
export function parseCSVFlexible(file: File): Promise<{
  data: Record<string, unknown>[]
  headers: string[]
  errors: Papa.ParseError[]
  meta: Papa.ParseMeta
}> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const text = e.target?.result as string
      const firstLine = text.split('\n')[0] || ''
      
      // Count occurrences of common delimiters
      const semicolonCount = (firstLine.match(/;/g) || []).length
      const commaCount = (firstLine.match(/,/g) || []).length
      
      // Use the delimiter with more occurrences
      let delimiter = ','
      if (semicolonCount > commaCount) {
        delimiter = ';'
      }
      
      console.log('CSV Flexible Parser - Delimiter detection:', {
        semicolonCount,
        commaCount,
        detectedDelimiter: delimiter,
      })

      Papa.parse(text, {
        header: true,
        delimiter: delimiter,
        quoteChar: '"',
        escapeChar: '"',
        skipEmptyLines: 'greedy',
        encoding: 'UTF-8',
        transformHeader: (header: string) => {
          // Normalize header names: trim, lowercase, replace spaces with underscores
          return header.trim().toLowerCase().replace(/\s+/g, '_')
        },
        complete: (results) => {
          const nonFatalErrors = results.errors.filter(
            (error) => error.type !== 'FieldMismatch' || error.code !== 'TooFewFields'
          )

          // Get headers from first row
          const headers = results.data.length > 0 
            ? Object.keys(results.data[0] as object)
            : []

          // Filter out completely empty rows (all values are empty/undefined)
          const validData = (results.data as Record<string, unknown>[]).filter((row) => {
            if (!row) return false
            // Check if at least one field has a non-empty value
            return Object.values(row).some(
              value => value !== undefined && value !== null && value !== ''
            )
          })

          console.log('CSV Flexible Parser result:', {
            totalRows: results.data.length,
            validRows: validData.length,
            headers: headers.slice(0, 10), // Log first 10 headers
            delimiter,
          })

          resolve({
            data: validData,
            headers,
            errors: nonFatalErrors,
            meta: results.meta,
          })
        },
        error: (error: Error) => {
          reject(error)
        },
      })
    }
    
    reader.onerror = () => {
      reject(new Error('Failed to read CSV file'))
    }
    
    reader.readAsText(file, 'UTF-8')
  })
}

/**
 * Safely parse number with European decimal comma support
 * Handles both "9.50" and "9,50" formats
 */
function parseNumber(value: string | number | undefined | null): number | null {
  if (value === null || value === undefined || value === '') {
    return null
  }
  
  const str = value.toString().trim()
  if (!str) return null
  
  // Replace comma with dot for European format, but preserve if it's a thousands separator
  // If comma is followed by exactly 2 digits, it's likely a decimal separator
  let normalized = str.replace(/,(\d{2})$/, '.$1')
  // If no dot exists, replace comma with dot
  if (!normalized.includes('.')) {
    normalized = normalized.replace(',', '.')
  }
  
  const num = parseFloat(normalized)
  return isNaN(num) ? null : num
}

/**
 * Safely parse integer
 */
function parseInteger(value: string | number | undefined | null): number {
  if (value === null || value === undefined || value === '') {
    return 0
  }
  
  const str = value.toString().trim()
  if (!str) return 0
  
  // Remove any non-digit characters except minus sign
  const cleaned = str.replace(/[^\d-]/g, '')
  const num = Number.parseInt(cleaned, 10)
  return isNaN(num) ? 0 : num
}

/**
 * Check if a string is a valid HTTP(S) URL
 */
function isValidImageUrl(value: string | number | undefined | null): boolean {
  if (!value || typeof value !== 'string') return false
  const trimmed = value.trim()
  return trimmed.length > 0 && (trimmed.startsWith('http://') || trimmed.startsWith('https://'))
}

/**
 * Convert CSV row to Product object matching exact Megapap format
 * Handles all 10 image columns and ignores 17 trailing attribute columns
 */
export function csvRowToProduct(row: CSVRow, supplierId: string): Record<string, unknown> {
  // Validate required SKU
  if (!row.sku || typeof row.sku !== 'string') {
    throw new Error(`Invalid row: missing or invalid SKU`)
  }

  const sku = row.sku.toString().trim()
  if (!sku) {
    throw new Error(`Invalid row: empty SKU`)
  }

  // Extract all valid image URLs from image1-image10 columns
  const imageUrls: string[] = []
  for (let i = 1; i <= 10; i++) {
    const imageKey = `image${i}` as keyof CSVRow
    const imageValue = row[imageKey]
    if (imageValue && isValidImageUrl(imageValue)) {
      imageUrls.push(imageValue.toString().trim())
    }
  }

  // Determine main_image: use main_image if valid, otherwise first image, otherwise null
  let mainImage: string | null = null
  if (row.main_image && isValidImageUrl(row.main_image)) {
    mainImage = row.main_image.toString().trim()
  } else if (imageUrls.length > 0) {
    mainImage = imageUrls[0]
  }

  // Parse all fields according to exact requirements
  const webofferPrice = parseNumber(row.weboffer_price) ?? 0
  const quantity = parseInteger(row.quantity)
  
  return {
    supplier_id: supplierId,
    model: row.model ? row.model.toString().trim() : null,
    sku: sku,
    retail_price: parseNumber(row.retail_price),
    weboffer_price: webofferPrice,
    // Compatibility fields for validator and legacy code
    wholesale_price: webofferPrice, // Map weboffer_price → wholesale_price
    stock: quantity, // Map quantity → stock
    moq: 1, // Default MOQ to 1 if missing
    name: row.name ? row.name.toString().trim() : '',
    category: row.category ? row.category.toString().trim() : null,
    manufacturer: row.manufacturer ? row.manufacturer.toString().trim() : null,
    description: row.description ? row.description.toString().trim() : null,
    availability: row.availability ? row.availability.toString().trim() : 'In Stock',
    quantity: quantity,
    weight: parseNumber(row.weight),
    transportational_weight: parseNumber(row.transportational_weight),
    date_expected: row.date_expected ? row.date_expected.toString().trim() : null,
    main_image: mainImage,
    images: imageUrls, // Already filtered to valid URLs only
    is_visible: true,
  }
}

/**
 * Clean product object for database insertion
 * Removes compatibility fields that don't exist in the database schema
 * (moq, wholesale_price, stock are only for validation, not in DB)
 */
export function cleanProductForDatabase(product: Record<string, unknown>): Record<string, unknown> {
  const cleanedProduct: Record<string, unknown> = {}
  
  // Only include fields that exist in the database schema
  const dbFields = [
    'supplier_id',
    'model',
    'sku',
    'retail_price',
    'weboffer_price',
    'name',
    'category',
    'manufacturer',
    'description',
    'availability',
    'quantity',
    'weight',
    'transportational_weight',
    'date_expected',
    'main_image',
    'images',
    'is_visible',
  ]
  
  for (const field of dbFields) {
    if (field in product) {
      cleanedProduct[field] = product[field]
    }
  }
  
  return cleanedProduct
}

export function exportToCSV(products: Product[]): string {
  const csvData = products.map((product) => ({
    sku: product.sku,
    name: product.name,
    description: product.description || '',
    category: product.category,
    moq: product.moq,
    retail_price: product.retail_price,
    wholesale_price: product.wholesale_price,
    stock: product.stock,
    images: product.images.join(','),
  }))

  return Papa.unparse(csvData)
}

