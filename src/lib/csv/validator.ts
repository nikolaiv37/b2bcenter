import { z } from 'zod'

/**
 * Schema for validating transformed Product objects (after csvRowToProduct)
 * This validates the output of the transformation, not raw CSV rows
 */
export const transformedProductSchema = z.object({
  supplier_id: z.string().min(1, 'Supplier ID is required'),
  sku: z.string().min(1, 'SKU is required'),
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional().nullable(),
  category: z.string().optional().nullable(), // Category is optional
  moq: z.number().int().positive().default(1),
  retail_price: z.number().positive().optional().nullable(),
  wholesale_price: z.number().nonnegative('Wholesale price must be non-negative'), // Can be 0
  stock: z.number().int().nonnegative().default(0),
  images: z.array(z.string()).default([]),
  main_image: z.string().optional().nullable(),
  // Allow other fields that may exist
}).passthrough()

export type TransformedProductData = z.infer<typeof transformedProductSchema>

export interface ValidationResult {
  valid: boolean
  errors: Array<{
    row: number
    field?: string
    message: string
  }>
  validData: TransformedProductData[]
  totalRows: number
  validRows: number
  invalidRows: number
}

/**
 * Validate transformed Product objects (output of csvRowToProduct)
 * This runs AFTER transformation, so it validates the normalized data structure
 */
export function validateTransformedProducts(products: Array<Record<string, unknown>>, startRowNumber: number = 2): ValidationResult {
  const errors: ValidationResult['errors'] = []
  const validData: TransformedProductData[] = []
  const skuSet = new Set<string>()

  products.forEach((product, index) => {
    const rowNumber = startRowNumber + index

    try {
      const validated = transformedProductSchema.parse(product)

      // Check for duplicate SKUs
      if (skuSet.has(validated.sku)) {
        errors.push({
          row: rowNumber,
          field: 'sku',
          message: `Duplicate SKU: ${validated.sku}`,
        })
        return
      }

      // Validate wholesale price is less than or equal to retail price (if retail_price exists)
      if (validated.retail_price && validated.wholesale_price > validated.retail_price) {
        errors.push({
          row: rowNumber,
          field: 'wholesale_price',
          message: 'Wholesale price must be less than or equal to retail price',
        })
        return
      }

      // Validate that we have at least name and sku
      if (!validated.name || validated.name.trim().length === 0) {
        errors.push({
          row: rowNumber,
          field: 'name',
          message: 'Name is required and cannot be empty',
        })
        return
      }

      if (!validated.sku || validated.sku.trim().length === 0) {
        errors.push({
          row: rowNumber,
          field: 'sku',
          message: 'SKU is required and cannot be empty',
        })
        return
      }

      skuSet.add(validated.sku)
      validData.push(validated)
    } catch (error) {
      if (error instanceof z.ZodError) {
        error.errors.forEach((err) => {
          errors.push({
            row: rowNumber,
            field: err.path[0]?.toString(),
            message: err.message,
          })
        })
      } else {
        errors.push({
          row: rowNumber,
          message: error instanceof Error ? error.message : 'Unknown validation error',
        })
      }
    }
  })

  return {
    valid: errors.length === 0,
    errors,
    validData,
    totalRows: products.length,
    validRows: validData.length,
    invalidRows: errors.length,
  }
}

