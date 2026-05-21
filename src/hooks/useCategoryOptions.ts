import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useAppContext } from '@/lib/app/AppContext'
import { supabase } from '@/lib/supabase/client'

interface CategoryRow {
  id: string
  name: string
  parent_id: string | null
}

export interface CategoryOption {
  id: string
  label: string
}

function buildCategoryOptions(categories: CategoryRow[]): CategoryOption[] {
  const mainCategories = categories
    .filter((category) => !category.parent_id)
    .sort((a, b) => a.name.localeCompare(b.name))
  const subcategoriesByParent = new Map<string, CategoryRow[]>()

  for (const category of categories) {
    if (!category.parent_id) continue
    const bucket = subcategoriesByParent.get(category.parent_id) ?? []
    bucket.push(category)
    subcategoriesByParent.set(category.parent_id, bucket)
  }

  const options: CategoryOption[] = []
  for (const mainCategory of mainCategories) {
    options.push({
      id: mainCategory.id,
      label: mainCategory.name,
    })

    const subcategories = (subcategoriesByParent.get(mainCategory.id) ?? [])
      .sort((a, b) => a.name.localeCompare(b.name))

    for (const subcategory of subcategories) {
      options.push({
        id: subcategory.id,
        label: `${mainCategory.name} - ${subcategory.name}`,
      })
    }
  }

  return options
}

export function useCategoryOptions(enabled = true) {
  const { workspaceId: tenantId } = useAppContext()

  const query = useQuery({
    queryKey: ['workspace', 'categories', 'options', tenantId],
    queryFn: async () => {
      if (!tenantId) return [] as CategoryRow[]

      const { data, error } = await supabase
        .from('categories')
        .select('id, name, parent_id')
        .eq('tenant_id', tenantId)
        .order('name')

      if (error) throw error
      return (data ?? []) as CategoryRow[]
    },
    enabled: enabled && !!tenantId,
    staleTime: 5 * 60 * 1000,
  })

  const options = useMemo(() => buildCategoryOptions(query.data ?? []), [query.data])

  return {
    ...query,
    options,
  }
}
