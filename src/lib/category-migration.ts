// LEGACY ONE-TIME MIGRATION – safe to delete after June 2025
// Used only for the initial hybrid → normalized migration. Do NOT use in new code.
/**
 * Category Migration Utility
 * 
 * This module provides functions to migrate products from legacy text-based
 * categories (product.category) to normalized category_id foreign keys.
 * 
 * Run the audit first to understand your data state, then run the migration.
 */

import { supabase } from '@/lib/supabase/client'
import { slugify } from '@/lib/utils'

export interface MigrationAuditResult {
  totalProducts: number
  productsWithCategoryId: number
  productsWithTextOnly: number
  productsWithBoth: number
  productsWithNeither: number
  uniqueTextCategories: string[]
  categoriesInTable: Array<{ id: string; name: string; parent_id: string | null; slug: string }>
  orphanedProducts: Array<{ id: string; sku: string; category: string | null }>
  missingCategories: string[]
}

export interface MigrationResult {
  success: boolean
  productsUpdated: number
  categoriesCreated: number
  errors: string[]
  details: string[]
}

/**
 * Parse category text string into main and sub parts
 */
function parseCategory(categoryText: string): { mainCategory: string; subcategory: string | null } {
  const parts = categoryText.split('>').map(p => p.trim())
  if (parts.length > 1) {
    return {
      mainCategory: parts[0],
      subcategory: parts.slice(1).join(' > '),
    }
  }
  return { mainCategory: categoryText, subcategory: null }
}

/**
 * Audit the current state of category data
 * Call this before running migration to understand what needs to be done
 */
export async function auditCategoryData(): Promise<MigrationAuditResult> {
  console.log('[Category Migration] Starting audit...')

  // Fetch all products with their category info
  const { data: products, error: productsError } = await supabase
    .from('products')
    .select('id, sku, category, category_id')
    .range(0, 9999)

  if (productsError) {
    console.error('[Category Migration] Failed to fetch products:', productsError)
    throw productsError
  }

  // Fetch all categories
  const { data: categories, error: categoriesError } = await supabase
    .from('categories')
    .select('id, name, parent_id, slug')

  if (categoriesError) {
    console.error('[Category Migration] Failed to fetch categories:', categoriesError)
    throw categoriesError
  }

  // Analyze products
  let productsWithCategoryId = 0
  let productsWithTextOnly = 0
  let productsWithBoth = 0
  let productsWithNeither = 0
  const uniqueTextCategories = new Set<string>()
  const orphanedProducts: Array<{ id: string; sku: string; category: string | null }> = []

  products?.forEach((product) => {
    const hasText = product.category && product.category.trim().length > 0
    const hasId = product.category_id !== null

    if (hasText) {
      uniqueTextCategories.add(product.category)
    }

    if (hasId && hasText) {
      productsWithBoth++
    } else if (hasId && !hasText) {
      productsWithCategoryId++
    } else if (!hasId && hasText) {
      productsWithTextOnly++
    } else {
      productsWithNeither++
      orphanedProducts.push({
        id: product.id,
        sku: product.sku,
        category: product.category,
      })
    }
  })

  // Find which text categories don't have matching entries in categories table
  const categoryNames = new Set(categories?.map(c => c.name.toLowerCase()) || [])
  const missingCategories: string[] = []

  uniqueTextCategories.forEach((textCat) => {
    const { mainCategory, subcategory } = parseCategory(textCat)
    
    // Check main category
    if (!categoryNames.has(mainCategory.toLowerCase())) {
      if (!missingCategories.includes(mainCategory)) {
        missingCategories.push(mainCategory)
      }
    }

    // Check subcategory (as "Main > Sub" might not exist)
    if (subcategory) {
      // Subcategory is stored with just the sub name, not "Main > Sub"
      if (!categoryNames.has(subcategory.toLowerCase())) {
        const fullPath = `${mainCategory} > ${subcategory}`
        if (!missingCategories.includes(fullPath)) {
          missingCategories.push(fullPath)
        }
      }
    }
  })

  const result: MigrationAuditResult = {
    totalProducts: products?.length || 0,
    productsWithCategoryId,
    productsWithTextOnly,
    productsWithBoth,
    productsWithNeither,
    uniqueTextCategories: Array.from(uniqueTextCategories).sort(),
    categoriesInTable: (categories || []).map(c => ({
      id: c.id,
      name: c.name,
      parent_id: c.parent_id,
      slug: c.slug || '',
    })),
    orphanedProducts,
    missingCategories: missingCategories.sort(),
  }

  console.log('[Category Migration] Audit complete:', {
    totalProducts: result.totalProducts,
    productsWithCategoryId: result.productsWithCategoryId,
    productsWithTextOnly: result.productsWithTextOnly,
    productsWithBoth: result.productsWithBoth,
    productsWithNeither: result.productsWithNeither,
    uniqueTextCategories: result.uniqueTextCategories.length,
    categoriesInTable: result.categoriesInTable.length,
    missingCategories: result.missingCategories.length,
  })

  return result
}

/**
 * Migrate products to use category_id
 * 
 * This function:
 * 1. Creates any missing categories in the categories table
 * 2. Sets category_id on products that only have text categories
 * 3. Keeps the text category field for backward compatibility
 */
export async function migrateProductCategories(companyId: string): Promise<MigrationResult> {
  console.log('[Category Migration] Starting migration for company:', companyId)

  const result: MigrationResult = {
    success: true,
    productsUpdated: 0,
    categoriesCreated: 0,
    errors: [],
    details: [],
  }

  try {
    // Step 1: Fetch all categories to build a lookup map
    const { data: existingCategories, error: catError } = await supabase
      .from('categories')
      .select('id, name, parent_id, slug')

    if (catError) throw catError

    // Build lookup maps: name -> category (case-insensitive)
    const mainCategoryByName = new Map<string, { id: string; name: string; slug: string }>()
    const subCategoryByName = new Map<string, { id: string; name: string; parent_id: string; slug: string }>()
    const categoryById = new Map<string, { id: string; name: string; parent_id: string | null }>()

    existingCategories?.forEach((cat) => {
      categoryById.set(cat.id, cat)
      
      if (!cat.parent_id) {
        mainCategoryByName.set(cat.name.toLowerCase(), { id: cat.id, name: cat.name, slug: cat.slug || '' })
      } else {
        // Store subcategory with parent name prefix for lookup
        const parent = existingCategories.find(c => c.id === cat.parent_id)
        if (parent) {
          const key = `${parent.name.toLowerCase()}>${cat.name.toLowerCase()}`
          subCategoryByName.set(key, { id: cat.id, name: cat.name, parent_id: cat.parent_id, slug: cat.slug || '' })
        }
      }
    })

    // Step 2: Fetch products that need migration (have text but no category_id)
    const { data: productsToMigrate, error: prodError } = await supabase
      .from('products')
      .select('id, sku, category, category_id')
      .is('category_id', null)
      .not('category', 'is', null)
      .range(0, 9999)

    if (prodError) throw prodError

    result.details.push(`Found ${productsToMigrate?.length || 0} products to migrate`)

    // Step 3: Process each product
    for (const product of (productsToMigrate || [])) {
      if (!product.category || product.category.trim() === '') continue

      const { mainCategory, subcategory } = parseCategory(product.category)
      let targetCategoryId: string | null = null

      // Find or create main category
      let mainCat = mainCategoryByName.get(mainCategory.toLowerCase())
      if (!mainCat) {
        // Create new main category
        const newSlug = slugify(mainCategory)
        const { data: newCat, error: insertError } = await supabase
          .from('categories')
          .insert({
            company_id: companyId,
            name: mainCategory,
            slug: newSlug,
            parent_id: null,
          })
          .select('id, name, slug')
          .single()

        if (insertError) {
          result.errors.push(`Failed to create category "${mainCategory}": ${insertError.message}`)
          continue
        }

        mainCat = { id: newCat.id, name: newCat.name, slug: newCat.slug || '' }
        mainCategoryByName.set(mainCategory.toLowerCase(), mainCat)
        result.categoriesCreated++
        result.details.push(`Created main category: ${mainCategory}`)
      }

      // If there's a subcategory, find or create it
      if (subcategory) {
        const subKey = `${mainCategory.toLowerCase()}>${subcategory.toLowerCase()}`
        let subCat = subCategoryByName.get(subKey)

        if (!subCat) {
          // Create new subcategory
          const newSlug = slugify(subcategory)
          const { data: newCat, error: insertError } = await supabase
            .from('categories')
            .insert({
              company_id: companyId,
              name: subcategory,
              slug: newSlug,
              parent_id: mainCat.id,
            })
            .select('id, name, slug')
            .single()

          if (insertError) {
            result.errors.push(`Failed to create subcategory "${subcategory}": ${insertError.message}`)
            continue
          }

          subCat = { id: newCat.id, name: newCat.name, parent_id: mainCat.id, slug: newCat.slug || '' }
          subCategoryByName.set(subKey, subCat)
          result.categoriesCreated++
          result.details.push(`Created subcategory: ${mainCategory} > ${subcategory}`)
        }

        targetCategoryId = subCat.id
      } else {
        targetCategoryId = mainCat.id
      }

      // Update product with category_id
      if (targetCategoryId) {
        const { error: updateError } = await supabase
          .from('products')
          .update({ category_id: targetCategoryId })
          .eq('id', product.id)

        if (updateError) {
          result.errors.push(`Failed to update product ${product.sku}: ${updateError.message}`)
        } else {
          result.productsUpdated++
        }
      }
    }

    result.details.push(`Migration complete: ${result.productsUpdated} products updated, ${result.categoriesCreated} categories created`)
    
    if (result.errors.length > 0) {
      result.success = false
    }

  } catch (error) {
    result.success = false
    result.errors.push(`Migration failed: ${error instanceof Error ? error.message : String(error)}`)
  }

  console.log('[Category Migration] Migration result:', result)
  return result
}

/**
 * Verify data integrity after migration
 */
export async function verifyDataIntegrity(): Promise<{
  valid: boolean
  issues: string[]
  stats: {
    totalProducts: number
    productsWithValidCategoryId: number
    productsWithInvalidCategoryId: number
    productsWithNoCategoryId: number
  }
}> {
  console.log('[Category Migration] Verifying data integrity...')

  const issues: string[] = []
  const stats = {
    totalProducts: 0,
    productsWithValidCategoryId: 0,
    productsWithInvalidCategoryId: 0,
    productsWithNoCategoryId: 0,
  }

  // Fetch all products with their category join
  const { data: products, error } = await supabase
    .from('products')
    .select(`
      id,
      sku,
      category,
      category_id,
      categories (
        id,
        name,
        parent_id
      )
    `)
    .eq('is_visible', true)
    .range(0, 9999)

  if (error) {
    issues.push(`Failed to fetch products: ${error.message}`)
    return { valid: false, issues, stats }
  }

  stats.totalProducts = products?.length || 0

  products?.forEach((product) => {
    const p = product as unknown as {
      id: string
      sku: string
      category: string | null
      category_id: string | null
      categories: { id: string; name: string; parent_id: string | null } | null
    }

    if (!p.category_id) {
      stats.productsWithNoCategoryId++
      issues.push(`Product ${p.sku} has no category_id`)
    } else if (!p.categories) {
      stats.productsWithInvalidCategoryId++
      issues.push(`Product ${p.sku} has category_id ${p.category_id} but category not found`)
    } else {
      stats.productsWithValidCategoryId++
    }
  })

  // Check for orphaned categories (categories with parent_id pointing to non-existent parent)
  const { data: categories } = await supabase
    .from('categories')
    .select('id, name, parent_id')

  const categoryIds = new Set(categories?.map(c => c.id) || [])
  categories?.forEach((cat) => {
    if (cat.parent_id && !categoryIds.has(cat.parent_id)) {
      issues.push(`Category "${cat.name}" has orphaned parent_id: ${cat.parent_id}`)
    }
  })

  console.log('[Category Migration] Verification complete:', stats)

  return {
    valid: issues.length === 0,
    issues,
    stats,
  }
}

