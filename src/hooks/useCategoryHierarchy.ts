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
  /**
   * Visible products assigned directly to the main category (excludes products
   * that live in subcategories). Useful for deciding whether to render the
   * "Всички продукти" / "All products" entry-point card on a main category page.
   */
  directProductCount: number
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

      // Fetch categories (just metadata) and visible-product summaries in parallel.
      // Previous implementation used a nested PostgREST join that pulled every product
      // row in the tenant (including the `images` array) into the categories payload.
      // For a catalog of any meaningful size this was the dominant cost of loading
      // /dashboard/categories. We now fetch the bare minimum needed for counts +
      // fallback image selection.
      type CategoryRow = {
        id: string
        name: string
        slug: string | null
        parent_id: string | null
        image_url: string | null
      }
      type ProductRow = {
        category_id: string | null
        main_image: string | null
      }

      // PostgREST applies a hard server-side row cap (default 1000) on un-ranged
      // queries. For tenants with thousands of products that silently truncates
      // the result and we end up under-counting categories. Page through the
      // products table in 1000-row chunks until we've seen everything.
      const PAGE_SIZE = 1000

      const fetchAllVisibleProducts = async (): Promise<ProductRow[]> => {
        const all: ProductRow[] = []
        let from = 0
        // Hard upper bound to avoid an accidental infinite loop if something
        // upstream goes wrong (e.g. RLS returns no rows). 200k products is well
        // above any realistic single-tenant catalog size.
        const HARD_CAP = 200_000
        // eslint-disable-next-line no-constant-condition
        while (true) {
          const to = from + PAGE_SIZE - 1
          const { data, error } = await supabase
            .from('products')
            .select('category_id, main_image')
            .eq('tenant_id', tenantId)
            .eq('is_visible', true)
            .range(from, to)
          if (error) throw error
          const page = (data || []) as ProductRow[]
          all.push(...page)
          if (page.length < PAGE_SIZE) break
          from += PAGE_SIZE
          if (all.length >= HARD_CAP) {
            console.warn('[useCategoryHierarchy] Hit HARD_CAP while paginating products')
            break
          }
        }
        return all
      }

      const [categoriesRes, productRows] = await Promise.all([
        supabase
          .from('categories')
          .select('id, name, slug, parent_id, image_url')
          .eq('tenant_id', tenantId)
          .order('name'),
        fetchAllVisibleProducts(),
      ])

      if (categoriesRes.error) {
        console.error('[useCategoryHierarchy] Categories query error:', categoriesRes.error)
        throw categoriesRes.error
      }

      const categoryRows = (categoriesRes.data || []) as CategoryRow[]

      // Bucket visible products by category_id once
      const productsByCategory = new Map<string, ProductRow[]>()
      for (const p of productRows) {
        if (!p.category_id) continue
        const bucket = productsByCategory.get(p.category_id)
        if (bucket) bucket.push(p)
        else productsByCategory.set(p.category_id, [p])
      }

      // Adapt to the old shape downstream code expects, with empty product arrays —
      // we now derive counts and fallback images from `productsByCategory` instead.
      type CategoryWithProducts = CategoryRow & {
        products: Array<{
          id: string
          main_image: string | null
          images: string[] | null
          quantity: number
          is_visible: boolean
        }>
      }
      const categories: CategoryWithProducts[] = categoryRows.map((c) => ({
        ...c,
        products: [],
      }))

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

      // Get the best fallback image from a category's visible products.
      // We now only have `main_image` per product (no `images[]` array fetched), so
      // scoring is simplified: first non-empty main_image wins, with optional URL
      // pattern preference if multiple candidates exist.
      const getBestProductImage = (categoryId: string): string | null => {
        const bucket = productsByCategory.get(categoryId)
        if (!bucket || bucket.length === 0) return null

        let bestImage: string | null = null
        let bestScore = 0
        for (const product of bucket) {
          const imageUrl = product.main_image || null
          if (!imageUrl) continue
          const score = scoreImage(imageUrl, true, 1)
          if (score > bestScore) {
            bestScore = score
            bestImage = imageUrl
          }
        }
        return bestImage
      }

      const getVisibleCount = (categoryId: string): number =>
        productsByCategory.get(categoryId)?.length ?? 0

      // Build main categories map
      const mainCategories = new Map<string, MainCategoryData>()

      // First pass: Create main categories (parent_id IS NULL)
      categories
        .filter((cat) => !cat.parent_id)
        .forEach((mainCat) => {
          const direct = getVisibleCount(mainCat.id)
          mainCategories.set(mainCat.name, {
            id: mainCat.id,
            name: mainCat.name,
            slug: mainCat.slug || mainCat.name.toLowerCase().replace(/\s+/g, '-'),
            imageUrl: mainCat.image_url || getBestProductImage(mainCat.id),
            subcategories: new Map(),
            productCount: direct,
            directProductCount: direct,
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

          const subCount = getVisibleCount(subCat.id)
          const fullCategory = `${parent.name} > ${subCat.name}`

          mainCatData.subcategories.set(subCat.name, {
            id: subCat.id,
            mainCategory: parent.name,
            subcategory: subCat.name,
            fullCategory,
            slug: subCat.slug || subCat.name.toLowerCase().replace(/\s+/g, '-'),
            imageUrl: subCat.image_url || getBestProductImage(subCat.id),
            productCount: subCount,
          })

          // Add subcategory products to main category total
          mainCatData.productCount += subCount

          // Update main category image if it doesn't have one yet
          if (!mainCatData.imageUrl) {
            const subImage = subCat.image_url || getBestProductImage(subCat.id)
            if (subImage) {
              mainCatData.imageUrl = subImage
            }
          }
        })

      // Note: We deliberately no longer inject a synthetic "All" subcategory.
      // - For main categories with no real subs, the browsing page renders products
      //   directly at /dashboard/categories/:mainCategory.
      // - For main categories with real subs AND direct products, the "Всички продукти"
      //   entry point is rendered at the component level and routed to the main
      //   category URL with a `?view=all` query param — not as a fake hierarchy entry.

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
    // Keep hierarchy hot for 30s after fetch so navigating between
    // /dashboard/categories and a category page does not re-issue the heavy query
    // on every entry. Category edits/merges/deletes invalidate this key explicitly
    // (see manage.tsx), so 30s is safe.
    staleTime: 30_000,
    enabled: !!tenantId,
  })
}
