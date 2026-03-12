import { useQuery } from '@tanstack/react-query'
import { useAppContext } from '@/lib/app/AppContext'
import { supabase } from '@/lib/supabase/client'

export interface CategoryInfo {
  id: string // Category UUID from categories table
  mainCategory: string
  subcategory: string
  fullCategory: string
  slug: string
  imageUrl: string | null
  productCount: number
}

export interface MainCategoryData {
  id: string // Category UUID
  name: string
  slug: string
  imageUrl: string | null
  subcategories: Map<string, CategoryInfo>
  productCount: number
}

export interface CategoryHierarchy {
  mainCategories: Map<string, MainCategoryData>
}

/**
 * Hook to fetch and organize category hierarchy from the normalized categories table.
 * 
 * NEW ARCHITECTURE:
 * - Queries the `categories` table directly (single source of truth)
 * - Products are counted via category_id foreign key relationship
 * - No more parsing "Main > Sub" text strings
 * - Main categories: parent_id IS NULL
 * - Subcategories: parent_id points to parent category
 */
export function useCategoryHierarchy(companyId?: string) {
  const { workspaceId: tenantId } = useAppContext()
  return useQuery({
    queryKey: ['workspace', 'category-hierarchy', companyId],
    queryFn: async (): Promise<CategoryHierarchy> => {
      if (!tenantId) {
        return { mainCategories: new Map() }
      }
      console.log('[useCategoryHierarchy] Fetching category hierarchy from categories table', {
        companyId,
        at: new Date().toISOString(),
      })

      // Fetch all categories with their products (via category_id foreign key)
      const { data: categoriesData, error: categoriesError } = await supabase
        .from('categories')
        .select(`
          id,
          name,
          slug,
          parent_id,
          image_url,
          products!category_id (
            id,
            main_image,
            images,
            quantity,
            is_visible
          )
        `)
        .eq('tenant_id', tenantId)
        .order('name')

      if (categoriesError) {
        console.error('[useCategoryHierarchy] Categories query error:', categoriesError)
        throw categoriesError
      }

      // Type the response
      type CategoryWithProducts = {
        id: string
        name: string
        slug: string | null
        parent_id: string | null
        image_url: string | null
        products: Array<{
          id: string
          main_image: string | null
          images: string[] | null
          quantity: number
          is_visible: boolean
        }>
      }

      const categories = (categoriesData || []) as CategoryWithProducts[]

      // Build a lookup map by ID for parent resolution
      const categoryById = new Map<string, CategoryWithProducts>()
      categories.forEach((cat) => {
        categoryById.set(cat.id, cat)
      })

      // Helper function to score image quality (prefer white/transparent backgrounds)
      const scoreImage = (imageUrl: string | null, isMainImage: boolean, imageCount: number): number => {
        if (!imageUrl) return 0
        
        let score = 0
        
        // Prefer main_image (usually product photos on white background)
        if (isMainImage) score += 10
        
        // Prefer products with more images (often means professional product photos)
        score += Math.min(imageCount, 5)
        
        // Prefer image URLs that might indicate product photos (common patterns)
        const urlLower = imageUrl.toLowerCase()
        if (urlLower.includes('product') || urlLower.includes('catalog') || urlLower.includes('wp/lj')) {
          score += 3
        }
        
        // Prefer .webp or .jpg (often better quality product photos)
        if (urlLower.includes('.webp') || urlLower.includes('.jpg') || urlLower.includes('.jpeg')) {
          score += 2
        }
        
        return score
      }

      // Get the best image from a category's products
      const getBestProductImage = (products: CategoryWithProducts['products']): string | null => {
        const visibleProducts = products.filter(p => p.is_visible)
        if (visibleProducts.length === 0) return null

        let bestImage: string | null = null
        let bestScore = 0

        for (const product of visibleProducts) {
          const mainImageUrl = product.main_image || null
          const firstImageUrl = product.images?.[0] || null
          const imageUrl = mainImageUrl || firstImageUrl
          const imageCount = product.images?.length || 0
          const isMainImage = !!mainImageUrl

          const score = scoreImage(imageUrl, isMainImage, imageCount)
          if (score > bestScore) {
            bestScore = score
            bestImage = imageUrl
          }
        }

        return bestImage
      }

      // Build main categories map
      const mainCategories = new Map<string, MainCategoryData>()

      // First pass: Create main categories (parent_id IS NULL)
      categories
        .filter((cat) => !cat.parent_id)
        .forEach((mainCat) => {
          const visibleProducts = mainCat.products.filter(p => p.is_visible)
          
          mainCategories.set(mainCat.name, {
            id: mainCat.id,
            name: mainCat.name,
            slug: mainCat.slug || mainCat.name.toLowerCase().replace(/\s+/g, '-'),
            imageUrl: mainCat.image_url || getBestProductImage(mainCat.products),
            subcategories: new Map(),
            productCount: visibleProducts.length,
          })
        })

      // Second pass: Add subcategories to their parents
      categories
        .filter((cat) => cat.parent_id)
        .forEach((subCat) => {
          const parent = categoryById.get(subCat.parent_id!)
          if (!parent) {
            console.warn(`[useCategoryHierarchy] Orphaned subcategory: ${subCat.name} (parent_id: ${subCat.parent_id})`)
            return
          }

          const mainCatData = mainCategories.get(parent.name)
          if (!mainCatData) {
            console.warn(`[useCategoryHierarchy] Main category not found for subcategory: ${subCat.name}`)
            return
          }

          const visibleProducts = subCat.products.filter(p => p.is_visible)
          const fullCategory = `${parent.name} > ${subCat.name}`

          mainCatData.subcategories.set(subCat.name, {
            id: subCat.id,
            mainCategory: parent.name,
            subcategory: subCat.name,
            fullCategory,
            slug: subCat.slug || subCat.name.toLowerCase().replace(/\s+/g, '-'),
            imageUrl: subCat.image_url || getBestProductImage(subCat.products),
            productCount: visibleProducts.length,
          })

          // Add subcategory products to main category total
          mainCatData.productCount += visibleProducts.length

          // Update main category image if it doesn't have one yet
          if (!mainCatData.imageUrl) {
            const subImage = subCat.image_url || getBestProductImage(subCat.products)
            if (subImage) {
              mainCatData.imageUrl = subImage
            }
          }
        })

      // For main categories without explicit subcategories, create an "All" subcategory
      mainCategories.forEach((mainCat) => {
        // Only add "All" if main category has products directly assigned to it
        const mainCategoryRecord = categories.find(c => c.id === mainCat.id)
        const directProducts = mainCategoryRecord?.products.filter(p => p.is_visible) || []
        
        if (directProducts.length > 0 && mainCat.subcategories.size > 0) {
          // Main category has both direct products AND subcategories
          // Add an "All" entry for direct products
          mainCat.subcategories.set('All', {
            id: mainCat.id, // Use main category ID for "All"
            mainCategory: mainCat.name,
            subcategory: 'All',
            fullCategory: mainCat.name,
            slug: 'all',
            imageUrl: mainCat.imageUrl,
            productCount: directProducts.length,
          })
        } else if (mainCat.subcategories.size === 0 && directProducts.length > 0) {
          // Main category only has direct products, no subcategories
          mainCat.subcategories.set('All', {
            id: mainCat.id,
            mainCategory: mainCat.name,
            subcategory: 'All',
            fullCategory: mainCat.name,
            slug: 'all',
            imageUrl: mainCat.imageUrl,
            productCount: directProducts.length,
          })
        }
      })

      // Sort main categories by product count (descending)
      const sortedMainCategories = new Map(
        Array.from(mainCategories.entries())
          .filter(([, data]) => data.productCount > 0) // Only show categories with products
          .sort((a, b) => b[1].productCount - a[1].productCount)
      )

      // Sort subcategories within each main category
      sortedMainCategories.forEach((mainCat) => {
        const sortedSubs = new Map(
          Array.from(mainCat.subcategories.entries())
            .filter(([, data]) => data.productCount > 0) // Only show subcategories with products
            .sort((a, b) => b[1].productCount - a[1].productCount)
        )
        mainCat.subcategories = sortedSubs
      })

      console.log('[useCategoryHierarchy] Built hierarchy:', {
        mainCategoriesCount: sortedMainCategories.size,
        totalProducts: Array.from(sortedMainCategories.values()).reduce((sum, c) => sum + c.productCount, 0),
      })

      return { mainCategories: sortedMainCategories }
    },
    staleTime: 0, // Always refetch on mount to ensure real-time sync with category renames
    enabled: !!tenantId,
  })
}
