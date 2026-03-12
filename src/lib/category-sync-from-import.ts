/**
 * Non-Destructive Category Sync for CSV Imports
 * 
 * This module provides functions to sync categories during CSV imports WITHOUT
 * destroying existing categories that may have been manually edited by admin.
 * 
 * Key principles:
 * - NEVER delete existing categories
 * - Find or create categories as needed
 * - Set category_id on products during import
 * - Preserve admin's manual category edits
 */

import { supabase } from '@/lib/supabase/client'
import { slugify } from '@/lib/utils'

export interface CategorySyncResult {
  success: boolean
  categoriesCreated: number
  categoriesReused: number
  productsLinked: number
  errors: string[]
  details: string[]
  categoryMap: Map<string, string> // fullPath -> categoryId
}

export interface ProductWithCategory {
  sku: string
  category?: string | null
  [key: string]: unknown
}

/**
 * Parse a category text string into main and sub parts
 * Format: "Main Category > Subcategory" or just "Category"
 */
function parseCategory(categoryText: string | null | undefined): {
  mainCategory: string
  subcategory: string | null
  fullPath: string
} {
  if (!categoryText || categoryText.trim() === '') {
    return { mainCategory: 'Uncategorized', subcategory: null, fullPath: 'Uncategorized' }
  }

  const parts = categoryText.split('>').map(p => p.trim())
  if (parts.length > 1) {
    return {
      mainCategory: parts[0],
      subcategory: parts.slice(1).join(' > '),
      fullPath: categoryText.trim(),
    }
  }

  return { mainCategory: categoryText.trim(), subcategory: null, fullPath: categoryText.trim() }
}

/**
 * Sync categories from imported products WITHOUT deleting existing ones.
 * 
 * This function:
 * 1. Extracts unique category paths from products
 * 2. For each category path, finds or creates the category
 * 3. Returns a map of fullPath -> categoryId for use in product upsert
 * 
 * @param products - Array of products with category text
 * @param companyId - The company ID to create categories under
 * @param tenantId - The tenant ID used for scoping categories
 * @returns CategorySyncResult with the mapping and stats
 */
export async function syncCategoriesFromImport(
  products: ProductWithCategory[],
  companyId: string,
  tenantId: string
): Promise<CategorySyncResult> {
  console.log('[CategorySync] Starting non-destructive category sync', {
    productCount: products.length,
    companyId,
    tenantId,
  })

  const result: CategorySyncResult = {
    success: true,
    categoriesCreated: 0,
    categoriesReused: 0,
    productsLinked: 0,
    errors: [],
    details: [],
    categoryMap: new Map(),
  }

  try {
    // Step 1: Extract all unique category paths from products
    const categoryPaths = new Set<string>()
    for (const product of products) {
      if (product.category && product.category.trim()) {
        categoryPaths.add(product.category.trim())
      }
    }

    result.details.push(`Found ${categoryPaths.size} unique category paths in import`)

    if (categoryPaths.size === 0) {
      result.details.push('No categories to sync')
      return result
    }

    // Step 2: Fetch existing categories for this company
    const { data: existingCategories, error: fetchError } = await supabase
      .from('categories')
      .select('id, name, slug, parent_id')
      .eq('tenant_id', tenantId)

    if (fetchError) {
      result.errors.push(`Failed to fetch existing categories: ${fetchError.message}`)
      result.success = false
      return result
    }

    // Build lookup maps for existing categories
    const mainCategoryByName = new Map<string, { id: string; name: string; slug: string }>()
    const subCategoryByKey = new Map<string, { id: string; name: string; parent_id: string; slug: string }>()
    const categoryById = new Map<string, { id: string; name: string; parent_id: string | null }>()

    for (const cat of (existingCategories || [])) {
      categoryById.set(cat.id, cat)

      if (!cat.parent_id) {
        // Main category - use lowercase name as key
        mainCategoryByName.set(cat.name.toLowerCase(), {
          id: cat.id,
          name: cat.name,
          slug: cat.slug || '',
        })
      } else {
        // Subcategory - need parent name for lookup
        const parent = existingCategories?.find(c => c.id === cat.parent_id)
        if (parent) {
          const key = `${parent.name.toLowerCase()}>${cat.name.toLowerCase()}`
          subCategoryByKey.set(key, {
            id: cat.id,
            name: cat.name,
            parent_id: cat.parent_id,
            slug: cat.slug || '',
          })
        }
      }
    }

    result.details.push(`Found ${mainCategoryByName.size} existing main categories, ${subCategoryByKey.size} subcategories`)

    // Step 3: Process each unique category path
    for (const fullPath of categoryPaths) {
      const { mainCategory, subcategory } = parseCategory(fullPath)

      // Find or create main category
      let mainCat = mainCategoryByName.get(mainCategory.toLowerCase())

      if (!mainCat) {
        // Create new main category
        const newSlug = slugify(mainCategory)
        const { data: newCat, error: insertError } = await supabase
          .from('categories')
          .insert({
            company_id: companyId,
            tenant_id: tenantId,
            name: mainCategory,
            slug: newSlug,
            parent_id: null,
          })
          .select('id, name, slug')
          .single()

        if (insertError) {
          // Check if it's a duplicate error (race condition)
          if (insertError.code === '23505') {
            // Try to fetch it again
            const { data: existingCat } = await supabase
              .from('categories')
              .select('id, name, slug')
              .eq('name', mainCategory)
              .is('parent_id', null)
              .eq('tenant_id', tenantId)
              .single()

            if (existingCat) {
              mainCat = { id: existingCat.id, name: existingCat.name, slug: existingCat.slug || '' }
              mainCategoryByName.set(mainCategory.toLowerCase(), mainCat)
              result.categoriesReused++
            } else {
              result.errors.push(`Failed to create main category "${mainCategory}": ${insertError.message}`)
              continue
            }
          } else {
            result.errors.push(`Failed to create main category "${mainCategory}": ${insertError.message}`)
            continue
          }
        } else if (newCat) {
          mainCat = { id: newCat.id, name: newCat.name, slug: newCat.slug || '' }
          mainCategoryByName.set(mainCategory.toLowerCase(), mainCat)
          result.categoriesCreated++
          result.details.push(`Created main category: ${mainCategory}`)
        }
      } else {
        result.categoriesReused++
      }

      if (!mainCat) {
        continue // Skip if main category creation failed
      }

      // If there's a subcategory, find or create it
      let targetCategoryId = mainCat.id

      if (subcategory) {
        const subKey = `${mainCategory.toLowerCase()}>${subcategory.toLowerCase()}`
        let subCat = subCategoryByKey.get(subKey)

        if (!subCat) {
          // Create new subcategory
          const newSlug = slugify(subcategory)
          const { data: newCat, error: insertError } = await supabase
            .from('categories')
            .insert({
              company_id: companyId,
              tenant_id: tenantId,
              name: subcategory,
              slug: newSlug,
              parent_id: mainCat.id,
            })
            .select('id, name, slug')
            .single()

          if (insertError) {
            // Check if it's a duplicate error
            if (insertError.code === '23505') {
              const { data: existingCat } = await supabase
                .from('categories')
                .select('id, name, slug')
                .eq('name', subcategory)
                .eq('parent_id', mainCat.id)
                .eq('tenant_id', tenantId)
                .single()

              if (existingCat) {
                subCat = { id: existingCat.id, name: existingCat.name, parent_id: mainCat.id, slug: existingCat.slug || '' }
                subCategoryByKey.set(subKey, subCat)
                result.categoriesReused++
              } else {
                result.errors.push(`Failed to create subcategory "${subcategory}": ${insertError.message}`)
              }
            } else {
              result.errors.push(`Failed to create subcategory "${subcategory}": ${insertError.message}`)
            }
          } else if (newCat) {
            subCat = { id: newCat.id, name: newCat.name, parent_id: mainCat.id, slug: newCat.slug || '' }
            subCategoryByKey.set(subKey, subCat)
            result.categoriesCreated++
            result.details.push(`Created subcategory: ${mainCategory} > ${subcategory}`)
          }
        } else {
          result.categoriesReused++
        }

        if (subCat) {
          targetCategoryId = subCat.id
        }
      }

      // Map the full path to the category ID
      result.categoryMap.set(fullPath, targetCategoryId)
    }

    result.details.push(
      `Category sync complete: ${result.categoriesCreated} created, ${result.categoriesReused} reused`
    )

    console.log('[CategorySync] Sync complete', {
      categoriesCreated: result.categoriesCreated,
      categoriesReused: result.categoriesReused,
      categoryMapSize: result.categoryMap.size,
    })

  } catch (error) {
    result.success = false
    result.errors.push(`Category sync failed: ${error instanceof Error ? error.message : String(error)}`)
  }

  return result
}

/**
 * Update products with their category_id based on the category map.
 * Call this after upserting products to ensure they're properly linked.
 * 
 * @param products - Array of products with SKU and category
 * @param categoryMap - Map of fullPath -> categoryId from syncCategoriesFromImport
 * @returns Number of products updated
 */
export async function linkProductsToCategories(
  products: ProductWithCategory[],
  categoryMap: Map<string, string>,
  tenantId: string
): Promise<{ updated: number; errors: string[] }> {
  console.log('[CategorySync] Linking products to categories', {
    productCount: products.length,
    categoryMapSize: categoryMap.size,
  })

  let updated = 0
  const errors: string[] = []

  // Group products by category_id for batch updates
  const productsByCategoryId = new Map<string, string[]>() // categoryId -> skus[]

  for (const product of products) {
    if (!product.category || !product.sku) continue

    const categoryPath = product.category.trim()
    const categoryId = categoryMap.get(categoryPath)

    if (categoryId) {
      const skus = productsByCategoryId.get(categoryId) || []
      skus.push(String(product.sku).trim())
      productsByCategoryId.set(categoryId, skus)
    }
  }

  // Update products in batches by category_id
  for (const [categoryId, skus] of productsByCategoryId.entries()) {
    // Process in chunks of 500 SKUs
    const chunkSize = 500
    for (let i = 0; i < skus.length; i += chunkSize) {
      const chunk = skus.slice(i, i + chunkSize)

      const { error } = await supabase
        .from('products')
        .update({ category_id: categoryId })
        .in('sku', chunk)
        .eq('tenant_id', tenantId)

      if (error) {
        errors.push(`Failed to link ${chunk.length} products to category ${categoryId}: ${error.message}`)
      } else {
        updated += chunk.length
      }
    }
  }

  console.log('[CategorySync] Products linked', { updated, errors: errors.length })

  return { updated, errors }
}

/**
 * Combined function: sync categories and link products in one call.
 * Use this from the CSV Import Wizard for a complete sync.
 */
export async function syncAndLinkCategories(
  products: ProductWithCategory[],
  companyId: string,
  tenantId: string
): Promise<CategorySyncResult & { productsLinked: number }> {
  // Step 1: Sync categories
  const syncResult = await syncCategoriesFromImport(products, companyId, tenantId)

  if (!syncResult.success || syncResult.categoryMap.size === 0) {
    return { ...syncResult, productsLinked: 0 }
  }

  // Step 2: Link products to categories
  const linkResult = await linkProductsToCategories(products, syncResult.categoryMap, tenantId)

  syncResult.productsLinked = linkResult.updated
  syncResult.errors.push(...linkResult.errors)

  if (linkResult.errors.length > 0) {
    syncResult.success = false
  }

  return syncResult
}

/**
 * Prepare products with category_id BEFORE upsert.
 * Returns products array with category_id set based on category text.
 * 
 * Use this to add category_id to products during the import mutation
 * so they're created with the correct link from the start.
 */
export async function prepareProductsWithCategoryId(
  products: ProductWithCategory[],
  companyId: string,
  tenantId: string
): Promise<{
  products: Array<ProductWithCategory & { category_id?: string }>
  syncResult: CategorySyncResult
}> {
  // First sync categories to get the mapping
  const syncResult = await syncCategoriesFromImport(products, companyId, tenantId)

  // Add category_id to each product based on its category text
  const productsWithCategoryId = products.map(product => {
    const result = { ...product } as ProductWithCategory & { category_id?: string }

    if (product.category && product.category.trim()) {
      const categoryId = syncResult.categoryMap.get(product.category.trim())
      if (categoryId) {
        result.category_id = categoryId
      }
    }

    return result
  })

  return {
    products: productsWithCategoryId,
    syncResult,
  }
}
