import { useState, useMemo, useCallback, memo } from 'react'
import { useAppContext } from '@/lib/app/AppContext'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { GlassCard } from '@/components/GlassCard'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { supabase } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import { 
  CheckCircle2, 
  AlertCircle, 
  Plus,
  FolderTree,
  ArrowRight,
  Package,
  RefreshCw,
  X,
  Sparkles,
  Layers,
  Check,
  Wand2,
} from 'lucide-react'
import type { CategoryMapping } from '@/hooks/useSmartMapping'

interface CategoryMappingStepProps {
  categoryMappings: CategoryMapping[]
  categoryStats: {
    exactMatches: number
    autoMatches: number
    manualReview: number
    newCategories: number
  }
  existingCategories: string[]
  onUpdateMapping: (sourceCategory: string, targetCategory: string, isNew?: boolean, fieldType?: 'category' | 'subcategory') => void
}

// Memoized card component to prevent unnecessary re-renders
const CategoryCard = memo(function CategoryCard({
  mapping,
  isSelected,
  onToggleSelect,
  onSelectChange,
  allCategories,
}: {
  mapping: CategoryMapping
  isSelected: boolean
  onToggleSelect: () => void
  onSelectChange: (value: string) => void
  allCategories: string[]
}) {
  const getStatusConfig = (m: CategoryMapping) => {
    if (m.status === 'exact') {
      return {
        icon: <CheckCircle2 className="w-4 h-4" />,
        bgColor: 'bg-green-50 dark:bg-green-950/20',
        borderColor: 'border-green-200 dark:border-green-800',
        textColor: 'text-green-600 dark:text-green-400',
      }
    }
    if (m.status === 'auto') {
      return {
        icon: <RefreshCw className="w-4 h-4" />,
        bgColor: 'bg-blue-50 dark:bg-blue-950/20',
        borderColor: 'border-blue-200 dark:border-blue-800',
        textColor: 'text-blue-600 dark:text-blue-400',
      }
    }
    if (m.status === 'new' || m.isNew) {
      return {
        icon: <Plus className="w-4 h-4" />,
        bgColor: 'bg-emerald-50 dark:bg-emerald-950/20',
        borderColor: 'border-emerald-200 dark:border-emerald-800',
        textColor: 'text-emerald-600 dark:text-emerald-400',
      }
    }
    if (m.status === 'review') {
      return {
        icon: <AlertCircle className="w-4 h-4" />,
        bgColor: 'bg-amber-50 dark:bg-amber-950/20',
        borderColor: 'border-amber-200 dark:border-amber-800',
        textColor: 'text-amber-600 dark:text-amber-400',
      }
    }
    return {
      icon: <FolderTree className="w-4 h-4" />,
      bgColor: 'bg-gray-50 dark:bg-gray-900/20',
      borderColor: 'border-gray-200 dark:border-gray-700',
      textColor: 'text-gray-600 dark:text-gray-400',
    }
  }

  const statusConfig = getStatusConfig(mapping)
  const displayValue = mapping.targetCategory && mapping.targetCategory !== 'Uncategorized' 
    ? mapping.targetCategory 
    : undefined

  return (
    <div 
      className={cn(
        'p-3 rounded-xl transition-all border flex items-center gap-3',
        statusConfig.bgColor,
        statusConfig.borderColor,
        isSelected && 'border-blue-500 border-2 shadow-md shadow-blue-200/50 dark:shadow-blue-900/30'
      )}
    >
      {/* Checkbox */}
      <div 
        onClick={onToggleSelect}
        className={cn(
          'w-5 h-5 rounded border-2 flex items-center justify-center cursor-pointer transition-colors shrink-0',
          isSelected 
            ? 'bg-blue-500 border-blue-500 text-white' 
            : 'border-gray-300 dark:border-gray-600 hover:border-blue-400'
        )}
      >
        {isSelected && <Check className="w-3 h-3" />}
      </div>

      {/* Source Category */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className={statusConfig.textColor}>
            {statusConfig.icon}
          </span>
          <span className="font-medium text-sm truncate" title={mapping.sourceCategory}>
            {mapping.sourceCategory}
          </span>
          <Badge variant="secondary" className="font-mono text-xs shrink-0">
            {mapping.productCount}
          </Badge>
        </div>
      </div>

      {/* Arrow */}
      <ArrowRight className="w-4 h-4 text-gray-400 shrink-0" />

      {/* Target Category */}
      <div className="w-[180px] shrink-0">
        <Select
          value={displayValue || '__placeholder__'}
          onValueChange={(value) => {
            if (value !== '__placeholder__') {
              onSelectChange(value)
            }
          }}
        >
          <SelectTrigger className={cn(
            "h-8 text-xs",
            mapping.isNew && "border-emerald-400 bg-emerald-50 dark:bg-emerald-950/30"
          )}>
            <SelectValue placeholder="Select...">
              {displayValue ? (
                <span className="truncate">{displayValue}</span>
              ) : (
                "Select..."
              )}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {allCategories.map(cat => (
              <SelectItem key={cat} value={cat} className="text-xs">
                {cat}
              </SelectItem>
            ))}
            <SelectItem 
              value="__create_new__" 
              className="text-emerald-600 dark:text-emerald-400 font-medium border-t mt-1 pt-2 text-xs"
            >
              <Plus className="w-3 h-3 inline mr-1" />
              Create New...
            </SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  )
})

export function CategoryMappingStep({
  categoryMappings,
  categoryStats,
  existingCategories,
  onUpdateMapping,
}: CategoryMappingStepProps) {
  const { t } = useTranslation()
  const { workspaceId: tenantId } = useAppContext()
  // State
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set())
  const [bulkAssignOpen, setBulkAssignOpen] = useState(false)
  const [bulkTargetCategory, setBulkTargetCategory] = useState('')
  const [newCategoryDialog, setNewCategoryDialog] = useState<{ open: boolean; mapping: CategoryMapping | null; mode: 'single' | 'bulk' }>({ 
    open: false, 
    mapping: null,
    mode: 'single'
  })
  const [newCategoryType, setNewCategoryType] = useState<'main' | 'sub'>('main')
  const [newCategoryParent, setNewCategoryParent] = useState('')
  const [newCategoryName, setNewCategoryName] = useState('')
  const [newParentName, setNewParentName] = useState('')
  
  // Bulk subcategory creation dialog
  const [bulkSubcategoryDialog, setBulkSubcategoryDialog] = useState<{
    open: boolean
    subcategories: Array<{ sourceName: string; key: string; fieldType: 'category' | 'subcategory' }>
    defaultParent: string
  }>({
    open: false,
    subcategories: [],
    defaultParent: ''
  })
  const [bulkSubcategoryParent, setBulkSubcategoryParent] = useState('')
  const [bulkNewParentName, setBulkNewParentName] = useState('')

  // Track newly created categories
  const [createdCategories, setCreatedCategories] = useState<string[]>([])

  // Group mappings by fieldType
  const { categoryMappingsGroup, subCategoryMappingsGroup } = useMemo(() => ({
    categoryMappingsGroup: categoryMappings.filter(m => m.fieldType === 'category'),
    subCategoryMappingsGroup: categoryMappings.filter(m => m.fieldType === 'subcategory'),
  }), [categoryMappings])

  // Fetch real categories from the database
  const { data: dbCategories = [], isLoading: isLoadingCategories } = useQuery({
    queryKey: ['workspace', 'categories-for-import'],
    queryFn: async () => {
      if (!tenantId) return []
      const { data, error } = await supabase
        .from('products')
        .select('category')
        .not('category', 'is', null)
        .not('category', 'eq', '')
        .eq('tenant_id', tenantId)

      if (error) {
        console.error('Error fetching categories:', error)
        return []
      }

      return [...new Set(
        data.map(p => p.category).filter((c): c is string => !!c && c.trim() !== '')
      )].sort()
    },
    staleTime: 30000,
    enabled: !!tenantId,
  })

  // All categories including newly created
  const allCategories = useMemo(() => {
    return [...new Set([
      ...dbCategories,
      ...existingCategories,
      ...createdCategories,
      ...categoryMappings
        .filter(m => m.isNew && m.targetCategory && m.targetCategory !== 'Uncategorized')
        .map(m => m.targetCategory),
    ])].filter(c => c && c.trim() !== '').sort()
  }, [dbCategories, existingCategories, createdCategories, categoryMappings])

  // Main categories only (no ">" in name) for parent selection
  // Also filter out any that look like sub-categories (contain " > " or start with a parent)
  const mainCategoriesOnly = useMemo(() => {
    return allCategories.filter(c => {
      // Exclude if it contains " > " (sub-category format)
      if (c.includes(' > ')) return false
      // Exclude if it's empty or just whitespace
      if (!c || !c.trim()) return false
      return true
    })
  }, [allCategories])

  const getUniqueKey = useCallback((mapping: CategoryMapping) => 
    `${mapping.fieldType}-${mapping.sourceCategory}`, [])

  // Handle select change
  const handleSelectChange = useCallback((mapping: CategoryMapping, value: string) => {
    if (value === '__create_new__') {
      setNewCategoryDialog({ open: true, mapping, mode: 'single' })
      setNewCategoryType('main')
      setNewCategoryParent('')
      setNewCategoryName('')
      setNewParentName('')
    } else {
      onUpdateMapping(mapping.sourceCategory, value, false, mapping.fieldType)
    }
  }, [onUpdateMapping])

  // Create new category
  const handleCreateNewCategory = useCallback(() => {
    const name = newCategoryName.trim()
    if (!name) return

    let fullCategoryName = name
    if (newCategoryType === 'sub') {
      const parent = newCategoryParent === '__new_parent__' ? newParentName.trim() : newCategoryParent
      if (parent) {
        fullCategoryName = `${parent} > ${name}`
        // Also add parent to created categories if it's new
        if (newCategoryParent === '__new_parent__' && newParentName.trim()) {
          setCreatedCategories(prev => {
            if (!prev.includes(newParentName.trim())) {
              return [...prev, newParentName.trim()]
            }
            return prev
          })
        }
      }
    }

    setCreatedCategories(prev => [...prev, fullCategoryName])

    if (newCategoryDialog.mode === 'single' && newCategoryDialog.mapping) {
      onUpdateMapping(
        newCategoryDialog.mapping.sourceCategory, 
        fullCategoryName, 
        true, 
        newCategoryDialog.mapping.fieldType
      )
    } else if (newCategoryDialog.mode === 'bulk') {
      selectedItems.forEach(key => {
        const mapping = categoryMappings.find(m => getUniqueKey(m) === key)
        if (mapping) {
          onUpdateMapping(mapping.sourceCategory, fullCategoryName, true, mapping.fieldType)
        }
      })
      setSelectedItems(new Set())
    }

    setNewCategoryDialog({ open: false, mapping: null, mode: 'single' })
    setNewCategoryType('main')
    setNewCategoryParent('')
    setNewCategoryName('')
    setNewParentName('')
  }, [newCategoryName, newCategoryType, newCategoryParent, newParentName, newCategoryDialog, onUpdateMapping, selectedItems, categoryMappings, getUniqueKey])

  // Bulk create with source names
  const handleBulkCreateAsSourceNames = useCallback(() => {
    // Separate main categories and subcategories
    const mainCategories: Array<{ sourceName: string; key: string }> = []
    const subcategories: Array<{ sourceName: string; key: string; fieldType: 'category' | 'subcategory' }> = []
    
    selectedItems.forEach(key => {
      const mapping = categoryMappings.find(m => getUniqueKey(m) === key)
      if (mapping) {
        if (mapping.fieldType === 'subcategory') {
          subcategories.push({
            sourceName: mapping.sourceCategory,
            key,
            fieldType: mapping.fieldType
          })
        } else {
          mainCategories.push({
            sourceName: mapping.sourceCategory,
            key
          })
        }
      }
    })

    // If there are subcategories, show dialog to assign parent
    if (subcategories.length > 0) {
      // Try to suggest a parent category (use first main category if available, or first existing category)
      const suggestedParent = mainCategories.length > 0 
        ? mainCategories[0].sourceName
        : (mainCategoriesOnly.length > 0 ? mainCategoriesOnly[0] : '')
      
      setBulkSubcategoryDialog({
        open: true,
        subcategories,
        defaultParent: suggestedParent
      })
      setBulkSubcategoryParent(suggestedParent)
      
      // Create main categories immediately (no parent needed)
      mainCategories.forEach(({ sourceName, key }) => {
        const mapping = categoryMappings.find(m => getUniqueKey(m) === key)
        if (mapping) {
          onUpdateMapping(mapping.sourceCategory, sourceName, true, mapping.fieldType)
        }
      })
      
      if (mainCategories.length > 0) {
        setCreatedCategories(prev => [...prev, ...mainCategories.map(c => c.sourceName)])
      }
    } else {
      // Only main categories, create them directly
      const newCats: string[] = []
      mainCategories.forEach(({ sourceName, key }) => {
        const mapping = categoryMappings.find(m => getUniqueKey(m) === key)
        if (mapping) {
          newCats.push(sourceName)
          onUpdateMapping(mapping.sourceCategory, sourceName, true, mapping.fieldType)
        }
      })
      setCreatedCategories(prev => [...prev, ...newCats])
      setSelectedItems(new Set())
    }
  }, [selectedItems, categoryMappings, getUniqueKey, onUpdateMapping, mainCategoriesOnly])

  // Handle bulk subcategory creation with parent assignment
  const handleBulkSubcategoryCreate = useCallback(() => {
    let parent = bulkSubcategoryParent.trim()
    
    // If creating new parent, use the input value
    if (parent === '__new_parent__') {
      parent = bulkNewParentName.trim()
      if (!parent) {
        // No parent name entered - create as main categories instead
        bulkSubcategoryDialog.subcategories.forEach(({ sourceName, key }) => {
          const mapping = categoryMappings.find(m => getUniqueKey(m) === key)
          if (mapping) {
            onUpdateMapping(mapping.sourceCategory, sourceName, true, 'category')
          }
        })
        const newCats = bulkSubcategoryDialog.subcategories.map(s => s.sourceName)
        setCreatedCategories(prev => [...prev, ...newCats])
        setBulkSubcategoryDialog({ open: false, subcategories: [], defaultParent: '' })
        setBulkSubcategoryParent('')
        setBulkNewParentName('')
        setSelectedItems(new Set())
        return
      }
      // Add new parent to created categories
      if (!allCategories.includes(parent) && !createdCategories.includes(parent)) {
        setCreatedCategories(prev => [...prev, parent])
      }
    }
    
    if (!parent) {
      // No parent selected - create as main categories instead
      bulkSubcategoryDialog.subcategories.forEach(({ sourceName, key }) => {
        const mapping = categoryMappings.find(m => getUniqueKey(m) === key)
        if (mapping) {
          onUpdateMapping(mapping.sourceCategory, sourceName, true, 'category')
        }
      })
    } else {
      // Create subcategories under selected parent
      bulkSubcategoryDialog.subcategories.forEach(({ sourceName, key }) => {
        const mapping = categoryMappings.find(m => getUniqueKey(m) === key)
        if (mapping) {
          const fullCategoryName = `${parent} > ${sourceName}`
          onUpdateMapping(mapping.sourceCategory, fullCategoryName, true, mapping.fieldType)
        }
      })
      
      // Add parent to created categories if it's new (and not already added above)
      if (bulkSubcategoryParent !== '__new_parent__' && !allCategories.includes(parent) && !createdCategories.includes(parent)) {
        setCreatedCategories(prev => [...prev, parent])
      }
    }
    
    const newCats = bulkSubcategoryDialog.subcategories.map(s => s.sourceName)
    setCreatedCategories(prev => [...prev, ...newCats])
    setBulkSubcategoryDialog({ open: false, subcategories: [], defaultParent: '' })
    setBulkSubcategoryParent('')
    setBulkNewParentName('')
    setSelectedItems(new Set())
  }, [bulkSubcategoryDialog, bulkSubcategoryParent, bulkNewParentName, categoryMappings, getUniqueKey, onUpdateMapping, allCategories, createdCategories])

  // Toggle selection
  const toggleSelection = useCallback((key: string) => {
    setSelectedItems(prev => {
      const newSet = new Set(prev)
      if (newSet.has(key)) {
        newSet.delete(key)
      } else {
        newSet.add(key)
      }
      return newSet
    })
  }, [])

  // Select all in a group
  const selectAllInGroup = useCallback((group: CategoryMapping[]) => {
    setSelectedItems(prev => {
      const newSet = new Set(prev)
      const allSelected = group.every(m => newSet.has(getUniqueKey(m)))
      if (allSelected) {
        group.forEach(m => newSet.delete(getUniqueKey(m)))
      } else {
        group.forEach(m => newSet.add(getUniqueKey(m)))
      }
      return newSet
    })
  }, [getUniqueKey])

  // Bulk assign to existing category
  const handleBulkAssign = useCallback(() => {
    if (!bulkTargetCategory) return

    if (bulkTargetCategory === '__create_new__') {
      setNewCategoryDialog({ open: true, mapping: null, mode: 'bulk' })
      setBulkAssignOpen(false)
      return
    }

    selectedItems.forEach(key => {
      const mapping = categoryMappings.find(m => getUniqueKey(m) === key)
      if (mapping) {
        onUpdateMapping(mapping.sourceCategory, bulkTargetCategory, false, mapping.fieldType)
      }
    })

    setSelectedItems(new Set())
    setBulkAssignOpen(false)
    setBulkTargetCategory('')
  }, [bulkTargetCategory, selectedItems, categoryMappings, getUniqueKey, onUpdateMapping])

  // Render section
  const renderSection = (
    title: string,
    icon: React.ReactNode,
    mappings: CategoryMapping[],
    iconColor: string,
    badge?: string
  ) => {
    const allSelected = mappings.length > 0 && mappings.every(m => selectedItems.has(getUniqueKey(m)))
    const someSelected = mappings.some(m => selectedItems.has(getUniqueKey(m)))

    return (
      <GlassCard>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div 
              onClick={() => selectAllInGroup(mappings)}
              className={cn(
                'w-5 h-5 rounded border-2 flex items-center justify-center cursor-pointer transition-colors',
                allSelected 
                  ? 'bg-blue-500 border-blue-500 text-white' 
                  : someSelected
                  ? 'bg-blue-200 border-blue-400'
                  : 'border-gray-300 dark:border-gray-600 hover:border-blue-400'
              )}
            >
              {(allSelected || someSelected) && <Check className="w-3 h-3" />}
            </div>
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <span className={iconColor}>{icon}</span>
              {title}
              <Badge variant="secondary">{mappings.length}</Badge>
            </h3>
          </div>
          {badge && (
            <Badge variant="outline" className="text-xs">
              {badge}
            </Badge>
          )}
        </div>

        <div className="space-y-2 max-h-[350px] overflow-y-auto pr-1">
          {mappings.map(mapping => {
            const key = getUniqueKey(mapping)
            return (
              <CategoryCard
                key={key}
                mapping={mapping}
                isSelected={selectedItems.has(key)}
                onToggleSelect={() => toggleSelection(key)}
                onSelectChange={(value) => handleSelectChange(mapping, value)}
                allCategories={allCategories}
              />
            )
          })}
        </div>
      </GlassCard>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <GlassCard className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{categoryStats.exactMatches}</p>
              <p className="text-sm text-muted-foreground">{t('csvImport.categoryMapping.exactMatch')}</p>
            </div>
          </div>
        </GlassCard>

        <GlassCard className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
              <RefreshCw className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{categoryStats.autoMatches}</p>
              <p className="text-sm text-muted-foreground">{t('csvImport.categoryMapping.autoMapped')}</p>
            </div>
          </div>
        </GlassCard>

        <GlassCard className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
              <AlertCircle className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{categoryStats.manualReview}</p>
              <p className="text-sm text-muted-foreground">{t('csvImport.categoryMapping.needReview')}</p>
            </div>
          </div>
        </GlassCard>

        <GlassCard className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
              <Plus className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{categoryStats.newCategories}</p>
              <p className="text-sm text-muted-foreground">{t('csvImport.categoryMapping.newCategories')}</p>
            </div>
          </div>
        </GlassCard>
      </div>

      {/* Bulk Action Bar */}
      {selectedItems.size > 0 && (
        <GlassCard className="bg-blue-50/80 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800 sticky top-0 z-20">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <Badge className="bg-blue-500 text-white">
                {selectedItems.size} {t('csvImport.categoryMapping.selected')}
              </Badge>
              <Button variant="ghost" size="sm" onClick={() => setSelectedItems(new Set())}>
                <X className="w-4 h-4 mr-1" />
                {t('csvImport.categoryMapping.clear')}
              </Button>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setBulkAssignOpen(true)}
              >
                <Package className="w-4 h-4 mr-1" />
                {t('csvImport.categoryMapping.assignToExisting')}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleBulkCreateAsSourceNames}
                className="border-emerald-300 text-emerald-700 hover:bg-emerald-50"
              >
                <Wand2 className="w-4 h-4 mr-1" />
                {t('csvImport.categoryMapping.createAsSourceNames')}
              </Button>
              <Button
                size="sm"
                onClick={() => {
                  setNewCategoryDialog({ open: true, mapping: null, mode: 'bulk' })
                  setNewCategoryName('')
                  setNewCategoryType('main')
                  setNewCategoryParent('')
                  setNewParentName('')
                }}
                className="bg-emerald-600 hover:bg-emerald-700"
              >
                <Plus className="w-4 h-4 mr-1" />
                {t('csvImport.categoryMapping.createCustom')}
              </Button>
            </div>
          </div>
        </GlassCard>
      )}

      {/* No Categories Info */}
      {categoryMappings.length === 0 && (
        <GlassCard className="text-center py-12">
          <FolderTree className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">{t('csvImport.categoryMapping.noCategoryColumnsMapped')}</h3>
          <p className="text-muted-foreground">
            {t('csvImport.categoryMapping.noCategoryColumnsDetected')}
          </p>
        </GlassCard>
      )}

      {/* Category Mappings Section */}
      {categoryMappingsGroup.length > 0 && renderSection(
        t('csvImport.categoryMapping.categoryMappings'),
        <FolderTree className="w-5 h-5" />,
        categoryMappingsGroup,
        'text-blue-600',
        isLoadingCategories ? t('general.loading') : `${allCategories.length} ${t('csvImport.categoryMapping.inCatalog')}`
      )}

      {/* Sub-Category Mappings Section */}
      {subCategoryMappingsGroup.length > 0 && renderSection(
        t('csvImport.categoryMapping.subCategoryMappings'),
        <Layers className="w-5 h-5" />,
        subCategoryMappingsGroup,
        'text-purple-600',
        t('csvImport.categoryMapping.nestedUnderMain')
      )}

      {/* Smart Matching Info */}
      <GlassCard className="bg-gradient-to-br from-slate-50 to-gray-50 dark:from-slate-950/30 dark:to-gray-950/30">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-lg bg-slate-200 dark:bg-slate-800 flex items-center justify-center shrink-0">
            <Sparkles className="w-4 h-4 text-slate-600 dark:text-slate-400" />
          </div>
          <div>
            <h4 className="font-semibold">{t('csvImport.categoryMapping.quickActions')}</h4>
            <p className="text-sm text-muted-foreground mt-1">
              {t('csvImport.categoryMapping.quickActionsDescription')}
            </p>
          </div>
        </div>
      </GlassCard>

      {/* Bulk Assign Dialog */}
      <Dialog open={bulkAssignOpen} onOpenChange={setBulkAssignOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('csvImport.categoryMapping.assignItems', { count: selectedItems.size })}</DialogTitle>
            <DialogDescription>
              {t('csvImport.categoryMapping.selectExistingCategory')}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            {allCategories.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <AlertCircle className="w-8 h-8 mx-auto mb-2 text-amber-500" />
                <p>{t('csvImport.categoryMapping.noCategoriesAvailable')}</p>
                <p className="text-sm mt-1">{t('csvImport.categoryMapping.createCategoriesFirst')}</p>
              </div>
            ) : (
              <Select value={bulkTargetCategory} onValueChange={setBulkTargetCategory}>
                <SelectTrigger>
                  <SelectValue placeholder={t('csvImport.categoryMapping.selectCategory')} />
                </SelectTrigger>
                <SelectContent>
                  {allCategories.map(cat => (
                    <SelectItem key={cat} value={cat}>
                      {cat}
                    </SelectItem>
                  ))}
                  <SelectItem 
                    value="__create_new__" 
                    className="text-emerald-600 font-medium border-t mt-1 pt-2"
                  >
                    <Plus className="w-3 h-3 inline mr-2" />
                    {t('csvImport.categoryMapping.createNew')}
                  </SelectItem>
                </SelectContent>
              </Select>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkAssignOpen(false)}>
              {t('general.cancel')}
            </Button>
            <Button 
              onClick={handleBulkAssign} 
              disabled={!bulkTargetCategory || allCategories.length === 0}
            >
              {t('csvImport.categoryMapping.assign')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create New Category Dialog */}
      <Dialog 
        open={newCategoryDialog.open} 
        onOpenChange={(open) => {
          setNewCategoryDialog(prev => ({ ...prev, open }))
          if (!open) {
            setNewCategoryType('main')
            setNewCategoryParent('')
            setNewCategoryName('')
            setNewParentName('')
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="w-5 h-5 text-emerald-600" />
              {t('csvImport.categoryMapping.createNewCategory')}
            </DialogTitle>
            <DialogDescription>
              {newCategoryDialog.mode === 'bulk' 
                ? t('csvImport.categoryMapping.createNewCategoryDescription', { count: selectedItems.size })
                : t('csvImport.categoryMapping.createNewCategorySingle')
              }
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Category Name */}
            <div className="space-y-2">
              <Label htmlFor="new-cat-name">{t('csvImport.categoryMapping.categoryName')}</Label>
              <Input
                id="new-cat-name"
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                placeholder={t('csvImport.categoryMapping.enterCategoryName')}
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && newCategoryName.trim() && (newCategoryType === 'main' || newCategoryParent)) {
                    e.preventDefault()
                    handleCreateNewCategory()
                  }
                }}
              />
            </div>

            {/* Category Type */}
            <div className="space-y-3">
              <Label>{t('csvImport.categoryMapping.categoryType')}</Label>
              <RadioGroup value={newCategoryType} onValueChange={(v: string) => setNewCategoryType(v as 'main' | 'sub')}>
                <div className={cn(
                  "flex items-center space-x-3 p-3 rounded-lg border cursor-pointer transition-colors",
                  newCategoryType === 'main' ? 'border-blue-400 bg-blue-50 dark:bg-blue-950/30' : 'hover:bg-gray-50 dark:hover:bg-gray-900/50'
                )} onClick={() => setNewCategoryType('main')}>
                  <RadioGroupItem value="main" id="type-main" />
                  <Label htmlFor="type-main" className="flex-1 cursor-pointer">
                    <div className="font-medium flex items-center gap-2">
                      <FolderTree className="w-4 h-4 text-blue-600" />
                      {t('csvImport.categoryMapping.mainCategory')}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {t('csvImport.categoryMapping.topLevelCategory')}
                    </p>
                  </Label>
                </div>
                <div className={cn(
                  "flex items-center space-x-3 p-3 rounded-lg border cursor-pointer transition-colors",
                  newCategoryType === 'sub' ? 'border-purple-400 bg-purple-50 dark:bg-purple-950/30' : 'hover:bg-gray-50 dark:hover:bg-gray-900/50'
                )} onClick={() => setNewCategoryType('sub')}>
                  <RadioGroupItem value="sub" id="type-sub" />
                  <Label htmlFor="type-sub" className="flex-1 cursor-pointer">
                    <div className="font-medium flex items-center gap-2">
                      <Layers className="w-4 h-4 text-purple-600" />
                      {t('csvImport.categoryMapping.subCategory')}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {t('csvImport.categoryMapping.underExistingMain')}
                    </p>
                  </Label>
                </div>
              </RadioGroup>
            </div>

            {/* Parent Category (for sub-category) - only main categories */}
            {newCategoryType === 'sub' && (
              <div className="space-y-2">
                <Label>{t('csvImport.categoryMapping.parentCategory')}</Label>
                {newCategoryParent === '__new_parent__' ? (
                  <div className="space-y-2">
                    <Input
                      placeholder={t('csvImport.categoryMapping.enterNewParentCategoryName')}
                      value={newParentName}
                      onChange={(e) => setNewParentName(e.target.value)}
                      autoFocus
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setNewCategoryParent('')
                        setNewParentName('')
                      }}
                      className="text-xs"
                    >
                      <X className="w-3 h-3 mr-1" />
                      {t('csvImport.categoryMapping.cancelSelectExisting')}
                    </Button>
                  </div>
                ) : (
                  <Select value={newCategoryParent || ''} onValueChange={setNewCategoryParent}>
                    <SelectTrigger>
                      <SelectValue placeholder={t('csvImport.categoryMapping.selectParentCategory')} />
                    </SelectTrigger>
                    <SelectContent>
                      {mainCategoriesOnly.length > 0 ? (
                        mainCategoriesOnly.map(cat => (
                          <SelectItem key={cat} value={cat}>
                            <div className="flex items-center gap-2">
                              <FolderTree className="w-3 h-3 text-blue-600" />
                              {cat}
                            </div>
                          </SelectItem>
                        ))
                      ) : (
                        <div className="px-2 py-1.5 text-sm text-muted-foreground">
                          {t('csvImport.categoryMapping.noMainCategoriesFound')}
                        </div>
                      )}
                      <SelectItem value="__new_parent__" className="text-emerald-600 font-medium border-t mt-1 pt-2">
                        <Plus className="w-3 h-3 inline mr-2" />
                        {t('csvImport.categoryMapping.createNewParentCategory')}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                )}
                {newCategoryType === 'sub' && (
                  <p className="text-xs text-muted-foreground">
                    {newCategoryParent === '__new_parent__' ? (
                      newParentName ? (
                        <>{t('csvImport.categoryMapping.willCreate')}: <span className="font-medium text-purple-600">{newParentName} &gt; {newCategoryName || '[name]'}</span></>
                      ) : (
                        <>{t('csvImport.categoryMapping.enterParentNameAbove')}</>
                      )
                    ) : newCategoryParent ? (
                      <>{t('csvImport.categoryMapping.willCreate')}: <span className="font-medium text-purple-600">{newCategoryParent} &gt; {newCategoryName || '[name]'}</span></>
                    ) : (
                      <>{t('csvImport.categoryMapping.selectOrCreateParent')}</>
                    )}
                  </p>
                )}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setNewCategoryDialog({ open: false, mapping: null, mode: 'single' })}>
              {t('general.cancel')}
            </Button>
            <Button 
              onClick={handleCreateNewCategory}
              disabled={
                !newCategoryName.trim() || 
                (newCategoryType === 'sub' && (
                  (!newCategoryParent || (newCategoryParent === '__new_parent__' && !newParentName.trim()))
                ))
              }
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              <Plus className="w-4 h-4 mr-2" />
              {t('csvImport.categoryMapping.create')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Subcategory Creation Dialog */}
      <Dialog 
        open={bulkSubcategoryDialog.open} 
        onOpenChange={(open) => {
          if (!open) {
            setBulkSubcategoryDialog({ open: false, subcategories: [], defaultParent: '' })
            setBulkSubcategoryParent('')
            setBulkNewParentName('')
          }
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Layers className="w-5 h-5 text-purple-600" />
              {t('csvImport.categoryMapping.createSubCategories', { count: bulkSubcategoryDialog.subcategories.length })}
            </DialogTitle>
            <DialogDescription>
              {t('csvImport.categoryMapping.assignParentForAll', { parent: bulkSubcategoryParent || 'Parent' })}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Subcategories List */}
            <div className="space-y-2">
              <Label>{t('csvImport.categoryMapping.subCategoriesToCreate', { count: bulkSubcategoryDialog.subcategories.length })}</Label>
              <div className="max-h-[200px] overflow-y-auto border rounded-lg p-3 bg-gray-50 dark:bg-gray-900/50 space-y-1">
                {bulkSubcategoryDialog.subcategories.map((sub, idx) => (
                  <div key={idx} className="flex items-center gap-2 text-sm py-1">
                    <div className="w-2 h-2 rounded-full bg-purple-500"></div>
                    <span className="font-medium">{sub.sourceName}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Parent Category Selection */}
            <div className="space-y-2">
              <Label>{t('csvImport.categoryMapping.parentCategory')}</Label>
              {bulkSubcategoryParent === '__new_parent__' ? (
                <div className="space-y-2">
                  <Input
                    placeholder={t('csvImport.categoryMapping.enterNewParentCategoryName')}
                    value={bulkNewParentName}
                    onChange={(e) => setBulkNewParentName(e.target.value)}
                    autoFocus
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setBulkSubcategoryParent('')
                      setBulkNewParentName('')
                    }}
                    className="text-xs"
                  >
                    <X className="w-3 h-3 mr-1" />
                    {t('csvImport.categoryMapping.cancelSelectExisting')}
                  </Button>
                </div>
              ) : (
                <>
                  <Select 
                    value={bulkSubcategoryParent} 
                    onValueChange={setBulkSubcategoryParent}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={t('csvImport.categoryMapping.selectParentCategory')} />
                    </SelectTrigger>
                    <SelectContent>
                      {mainCategoriesOnly.length > 0 ? (
                        mainCategoriesOnly.map(cat => (
                          <SelectItem key={cat} value={cat}>
                            <div className="flex items-center gap-2">
                              <FolderTree className="w-3 h-3 text-blue-600" />
                              {cat}
                            </div>
                          </SelectItem>
                        ))
                      ) : (
                        <div className="px-2 py-1.5 text-sm text-muted-foreground">
                          {t('csvImport.categoryMapping.noMainCategoriesFound')}
                        </div>
                      )}
                      <SelectItem 
                        value="__new_parent__" 
                        className="text-emerald-600 font-medium border-t mt-1 pt-2"
                      >
                        <Plus className="w-3 h-3 inline mr-2" />
                        {t('csvImport.categoryMapping.createNewParentCategory')}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  
                  {/* Option to create as main categories instead */}
                  <div className="pt-2 border-t">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setBulkSubcategoryParent('')
                      }}
                      className="text-xs text-muted-foreground hover:text-foreground"
                    >
                      <X className="w-3 h-3 mr-1" />
                      {t('csvImport.categoryMapping.orCreateAsMainCategories')}
                    </Button>
                  </div>
                </>
              )}
            </div>

            {/* Preview */}
            {bulkSubcategoryParent && bulkSubcategoryParent !== '__new_parent__' && (
              <div className="bg-purple-50 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-800 rounded-lg p-3">
                <p className="text-xs font-medium text-purple-700 dark:text-purple-400 mb-2">
                  {t('csvImport.validation.preview')}:
                </p>
                <div className="space-y-1 text-xs text-purple-600 dark:text-purple-500">
                  {bulkSubcategoryDialog.subcategories.slice(0, 3).map((sub, idx) => (
                    <div key={idx}>
                      {bulkSubcategoryParent} {'>'} {sub.sourceName}
                    </div>
                  ))}
                  {bulkSubcategoryDialog.subcategories.length > 3 && (
                    <div className="text-muted-foreground">
                      ... and {bulkSubcategoryDialog.subcategories.length - 3} more
                    </div>
                  )}
                </div>
              </div>
            )}
            
            {bulkSubcategoryParent === '__new_parent__' && bulkNewParentName && (
              <div className="bg-purple-50 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-800 rounded-lg p-3">
                <p className="text-xs font-medium text-purple-700 dark:text-purple-400 mb-2">
                  Preview:
                </p>
                <div className="space-y-1 text-xs text-purple-600 dark:text-purple-500">
                  {bulkSubcategoryDialog.subcategories.slice(0, 3).map((sub, idx) => (
                    <div key={idx}>
                      {bulkNewParentName} {'>'} {sub.sourceName}
                    </div>
                  ))}
                  {bulkSubcategoryDialog.subcategories.length > 3 && (
                    <div className="text-muted-foreground">
                      ... and {bulkSubcategoryDialog.subcategories.length - 3} more
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => {
                setBulkSubcategoryDialog({ open: false, subcategories: [], defaultParent: '' })
                setBulkSubcategoryParent('')
              }}
            >
              {t('general.cancel')}
            </Button>
            <Button 
              onClick={handleBulkSubcategoryCreate}
              disabled={bulkSubcategoryParent === '__new_parent__' && !bulkNewParentName.trim()}
              className="bg-purple-600 hover:bg-purple-700"
            >
              <Layers className="w-4 h-4 mr-2" />
              {t('csvImport.categoryMapping.createSubCategories', { count: bulkSubcategoryDialog.subcategories.length })}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
