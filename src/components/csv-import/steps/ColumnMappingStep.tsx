import { useMemo, useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { GlassCard } from '@/components/GlassCard'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { 
  CheckCircle2, 
  AlertCircle, 
  XCircle,
  ArrowRight,
  Columns,
  Ban,
  Zap,
  AlertTriangle,
  Check,
  X,
} from 'lucide-react'
import type { ColumnMapping } from '@/hooks/useSmartMapping'
import type { StandardField } from '@/lib/csv/distributors'

interface ColumnMappingStepProps {
  columnMappings: ColumnMapping[]
  columnValidation: {
    isValid: boolean
    missingRequired: StandardField[]
    missingRecommended: StandardField[]
    duplicateMappings: Array<{ field: StandardField; columns: string[] }>
    totalMapped: number
    totalColumns: number
  }
  availableFields: { value: string; label: string }[]
  distributorName: string
  onUpdateMapping: (sourceColumn: string, targetField: StandardField | 'ignore' | null) => void
}

// Fields that should only be mapped once (important for data integrity)
const UNIQUE_FIELDS = ['category', 'subcategory', 'sku', 'name', 'wholesale_price', 'retail_price', 'main_image']

export function ColumnMappingStep({
  columnMappings,
  columnValidation,
  availableFields,
  distributorName,
  onUpdateMapping,
}: ColumnMappingStepProps) {
  const { t } = useTranslation()
  // Selection state
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set())

  // Toggle selection
  const toggleSelection = useCallback((sourceColumn: string) => {
    setSelectedItems(prev => {
      const newSet = new Set(prev)
      if (newSet.has(sourceColumn)) {
        newSet.delete(sourceColumn)
      } else {
        newSet.add(sourceColumn)
      }
      return newSet
    })
  }, [])

  // Select all / Deselect all
  const toggleSelectAll = useCallback(() => {
    if (selectedItems.size === columnMappings.length) {
      setSelectedItems(new Set())
    } else {
      setSelectedItems(new Set(columnMappings.map(m => m.sourceColumn)))
    }
  }, [selectedItems.size, columnMappings])

  // Bulk actions
  const handleBulkAction = useCallback((action: 'ignore' | 'unmap') => {
    selectedItems.forEach(sourceColumn => {
      if (action === 'ignore') {
        onUpdateMapping(sourceColumn, 'ignore')
      } else {
        onUpdateMapping(sourceColumn, null)
      }
    })
    setSelectedItems(new Set())
  }, [selectedItems, onUpdateMapping])

  // Calculate stats from mappings
  const stats = useMemo(() => {
    let autoMapped = 0
    let reviewNeeded = 0
    let unmapped = 0
    let ignored = 0
    let manual = 0

    for (const m of columnMappings) {
      if (m.targetField === 'ignore') {
        ignored++
      } else if (m.status === 'auto' && m.targetField) {
        autoMapped++
      } else if (m.status === 'review') {
        reviewNeeded++
      } else if (m.status === 'manual' && m.targetField) {
        manual++
      } else {
        unmapped++
      }
    }

    return { autoMapped, reviewNeeded, unmapped, ignored, manual, mapped: autoMapped + manual }
  }, [columnMappings])

  // Track which fields are already used (for unique fields like category, sub_category)
  const usedFields = useMemo(() => {
    const used = new Map<string, string>() // field -> sourceColumn
    for (const m of columnMappings) {
      if (m.targetField && m.targetField !== 'ignore' && UNIQUE_FIELDS.includes(m.targetField)) {
        used.set(m.targetField, m.sourceColumn)
      }
    }
    return used
  }, [columnMappings])

  const getStatusIcon = (mapping: ColumnMapping) => {
    if (mapping.targetField === 'ignore') {
      return <Ban className="w-4 h-4 text-gray-400" />
    }
    if (mapping.targetField && (mapping.status === 'auto' || mapping.status === 'manual')) {
      return <CheckCircle2 className="w-4 h-4 text-green-500" />
    }
    if (mapping.status === 'review') {
      return <AlertCircle className="w-4 h-4 text-amber-500" />
    }
    return <XCircle className="w-4 h-4 text-gray-400" />
  }

  const getStatusBadge = (mapping: ColumnMapping) => {
    if (mapping.targetField === 'ignore') {
      return <Badge variant="outline" className="text-gray-500">🚫 Ignored</Badge>
    }
    if (mapping.status === 'auto' && mapping.targetField) {
      return <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">✅ Auto</Badge>
    }
    if (mapping.status === 'manual' && mapping.targetField) {
      return <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">✏️ Manual</Badge>
    }
    if (mapping.status === 'review') {
      return <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">⚠️ Review</Badge>
    }
    return <Badge variant="outline">Unmapped</Badge>
  }

  const getRowBackground = (mapping: ColumnMapping) => {
    if (mapping.targetField === 'ignore') {
      return 'bg-gray-50/50 dark:bg-gray-900/20'
    }
    if (mapping.status === 'review') {
      return 'bg-amber-50/50 dark:bg-amber-950/10'
    }
    // Highlight category/subcategory mappings
    if (mapping.targetField === 'category' || mapping.targetField === 'subcategory') {
      return 'bg-blue-50/30 dark:bg-blue-950/10'
    }
    return ''
  }

  // Check if a field is available for selection
  const isFieldAvailable = (fieldValue: string, currentSourceColumn: string) => {
    if (!UNIQUE_FIELDS.includes(fieldValue)) return true
    const usedBy = usedFields.get(fieldValue)
    return !usedBy || usedBy === currentSourceColumn
  }

  return (
    <div className="space-y-6">
      {/* Header Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <GlassCard className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.autoMapped}</p>
              <p className="text-sm text-muted-foreground">{t('csvImport.columnMapping.autoMapped')}</p>
            </div>
          </div>
        </GlassCard>

        <GlassCard className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
              <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.reviewNeeded}</p>
              <p className="text-sm text-muted-foreground">{t('csvImport.columnMapping.needReview')}</p>
            </div>
          </div>
        </GlassCard>

        <GlassCard className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
              <XCircle className="w-5 h-5 text-gray-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.unmapped}</p>
              <p className="text-sm text-muted-foreground">{t('csvImport.columnMapping.unmapped')}</p>
            </div>
          </div>
        </GlassCard>

        <GlassCard className={cn(
          "p-4 border-2",
          columnValidation.isValid 
            ? "border-green-300 dark:border-green-700 bg-green-50/50 dark:bg-green-950/10"
            : "border-red-300 dark:border-red-700 bg-red-50/50 dark:bg-red-950/10"
        )}>
          <div className="flex items-center gap-3">
            <div className={cn(
              "w-10 h-10 rounded-xl flex items-center justify-center",
              columnValidation.isValid 
                ? "bg-green-100 dark:bg-green-900/30"
                : "bg-red-100 dark:bg-red-900/30"
            )}>
              {columnValidation.isValid ? (
                <Zap className="w-5 h-5 text-green-600 dark:text-green-400" />
              ) : (
                <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
              )}
            </div>
            <div>
              <p className="text-lg font-bold">
                {columnValidation.isValid ? t('csvImport.columnMapping.ready') : t('csvImport.columnMapping.missing')}
              </p>
              <p className="text-sm text-muted-foreground">
                {columnValidation.totalMapped}/{columnMappings.length} {t('csvImport.columnMapping.mapped')}
              </p>
            </div>
          </div>
        </GlassCard>
      </div>

      {/* Validation Errors */}
      {!columnValidation.isValid && (
        <div className="space-y-3">
          {/* Missing Required Fields Warning */}
          {columnValidation.missingRequired.length > 0 && (
            <GlassCard className="bg-red-50/50 dark:bg-red-950/10 border-red-200 dark:border-red-800">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 mt-0.5" />
                <div className="flex-1">
                  <h4 className="font-semibold text-red-700 dark:text-red-400">
                    {t('csvImport.columnMapping.missingRequiredFields')}
                  </h4>
                  <p className="text-sm text-red-600 dark:text-red-500 mb-2">
                    {t('csvImport.columnMapping.mustBeMapped')}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {columnValidation.missingRequired.map(field => (
                      <Badge key={field} variant="destructive">
                        {field.replace(/_/g, ' ')}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>
            </GlassCard>
          )}

          {/* Duplicate Mappings Warning */}
          {columnValidation.duplicateMappings.length > 0 && (
            <GlassCard className="bg-amber-50/50 dark:bg-amber-950/10 border-amber-200 dark:border-amber-800">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 mt-0.5" />
                <div className="flex-1">
                  <h4 className="font-semibold text-amber-700 dark:text-amber-400">
                    {t('csvImport.columnMapping.duplicateMappingsDetected')}
                  </h4>
                  <p className="text-sm text-amber-600 dark:text-amber-500 mb-2">
                    {t('csvImport.columnMapping.mappedToMultiple')}
                  </p>
                  <div className="space-y-2">
                    {columnValidation.duplicateMappings.map(({ field, columns }) => (
                      <div key={field} className="bg-white/50 dark:bg-gray-900/50 p-2 rounded border border-amber-200 dark:border-amber-700">
                        <div className="font-medium text-amber-700 dark:text-amber-400 mb-1">
                          {field.replace(/_/g, ' ')}:
                        </div>
                        <div className="text-sm text-amber-600 dark:text-amber-500">
                          {t('csvImport.columnMapping.mappedTo')} {columns.map(c => `"${c}"`).join(', ')}
                        </div>
                        <div className="text-xs text-amber-500 dark:text-amber-600 mt-1">
                          {t('csvImport.columnMapping.tip')}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </GlassCard>
          )}
        </div>
      )}

      {/* Important Fields Notice */}
      <GlassCard className="bg-blue-50/50 dark:bg-blue-950/10 border-blue-200 dark:border-blue-800">
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5" />
          <div>
            <h4 className="font-semibold text-blue-700 dark:text-blue-400">
              {t('csvImport.columnMapping.importantCategoryFields')}
            </h4>
            <p className="text-sm text-blue-600 dark:text-blue-500">
              {t('csvImport.columnMapping.categorySubcategoryInfo')}
            </p>
            <div className="flex flex-wrap gap-2 mt-2">
              <Badge variant="outline" className="border-blue-300 text-blue-700 dark:border-blue-700 dark:text-blue-400">
                {usedFields.has('category') ? `✅ Category → ${usedFields.get('category')}` : t('csvImport.columnMapping.categoryNotMapped')}
              </Badge>
              <Badge variant="outline" className="border-blue-300 text-blue-700 dark:border-blue-700 dark:text-blue-400">
                {usedFields.has('subcategory') ? `✅ Sub-Category → ${usedFields.get('subcategory')}` : t('csvImport.columnMapping.subCategoryNotMapped')}
              </Badge>
            </div>
          </div>
        </div>
      </GlassCard>

      {/* Bulk Action Bar */}
      {selectedItems.size > 0 && (
        <GlassCard className="bg-blue-50/80 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800 sticky top-0 z-20">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <Badge className="bg-blue-500 text-white">
                {selectedItems.size} {t('csvImport.columnMapping.selected')}
              </Badge>
              <Button variant="ghost" size="sm" onClick={() => setSelectedItems(new Set())}>
                <X className="w-4 h-4 mr-1" />
                {t('csvImport.columnMapping.clear')}
              </Button>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleBulkAction('ignore')}
                className="border-gray-300 text-gray-700 hover:bg-gray-50"
              >
                <Ban className="w-4 h-4 mr-1" />
                {t('csvImport.columnMapping.ignoreAll')}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleBulkAction('unmap')}
                className="border-amber-300 text-amber-700 hover:bg-amber-50"
              >
                <XCircle className="w-4 h-4 mr-1" />
                {t('csvImport.columnMapping.unmapAll')}
              </Button>
            </div>
          </div>
        </GlassCard>
      )}

      {/* Mapping Table */}
      <GlassCard>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Columns className="w-5 h-5" />
            {t('csvImport.columnMapping.columnMappings')}
            <Badge variant="secondary" className="ml-2">
              {columnMappings.length} {t('csvImport.columnMapping.columns')}
            </Badge>
          </h3>
          <Badge variant="outline">
            {distributorName} {t('csvImport.columnMapping.format')}
          </Badge>
        </div>

        <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
          <table className="w-full">
            <thead className="sticky top-0 bg-white dark:bg-gray-950 z-10">
              <tr className="border-b-2 border-gray-200 dark:border-gray-700">
                <th className="text-left px-4 py-3 font-semibold text-sm bg-white dark:bg-gray-950 w-12">
                  <div 
                    onClick={toggleSelectAll}
                    className={cn(
                      'w-5 h-5 rounded border-2 flex items-center justify-center cursor-pointer transition-colors',
                      selectedItems.size === columnMappings.length
                        ? 'bg-blue-500 border-blue-500 text-white'
                        : 'border-gray-300 dark:border-gray-600 hover:border-blue-400'
                    )}
                  >
                    {selectedItems.size === columnMappings.length && <Check className="w-3 h-3" />}
                  </div>
                </th>
                <th className="text-left px-4 py-3 font-semibold text-sm bg-white dark:bg-gray-950">
                  {t('csvImport.columnMapping.sourceColumn')}
                </th>
                <th className="px-4 py-3 w-12 bg-white dark:bg-gray-950"></th>
                <th className="text-left px-4 py-3 font-semibold text-sm bg-white dark:bg-gray-950">
                  {t('csvImport.columnMapping.mapToField')}
                </th>
                <th className="text-center px-4 py-3 font-semibold text-sm bg-white dark:bg-gray-950">
                  {t('csvImport.columnMapping.status')}
                </th>
                <th className="text-center px-4 py-3 font-semibold text-sm bg-white dark:bg-gray-950">
                  {t('csvImport.columnMapping.match')}
                </th>
              </tr>
            </thead>
            <tbody>
              {columnMappings.map((mapping) => {
                const isSelected = selectedItems.has(mapping.sourceColumn)
                return (
                  <tr 
                    key={mapping.sourceColumn}
                    className={cn(
                      'border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-900/50 transition-colors',
                      getRowBackground(mapping),
                      isSelected && 'bg-blue-50 dark:bg-blue-950/20'
                    )}
                  >
                    <td className="px-4 py-3">
                      <div 
                        onClick={() => toggleSelection(mapping.sourceColumn)}
                        className={cn(
                          'w-5 h-5 rounded border-2 flex items-center justify-center cursor-pointer transition-colors',
                          isSelected
                            ? 'bg-blue-500 border-blue-500 text-white'
                            : 'border-gray-300 dark:border-gray-600 hover:border-blue-400'
                        )}
                      >
                        {isSelected && <Check className="w-3 h-3" />}
                      </div>
                    </td>
                    <td className="px-4 py-3 min-w-[250px]">
                      <div className="flex items-center gap-2">
                        {getStatusIcon(mapping)}
                        <code className="text-sm font-mono bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded break-all">
                          {mapping.sourceColumn}
                        </code>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <ArrowRight className="w-4 h-4 text-gray-400 mx-auto" />
                    </td>
                  <td className="px-4 py-3">
                    <Select
                      value={mapping.targetField || 'unmapped'}
                      onValueChange={(value) => {
                        const newValue = value === 'unmapped' ? null : value as StandardField | 'ignore'
                        onUpdateMapping(mapping.sourceColumn, newValue)
                      }}
                    >
                      <SelectTrigger className={cn(
                        'w-full max-w-[200px]',
                        mapping.targetField && mapping.targetField !== 'ignore' && 'border-green-300 dark:border-green-700',
                        (mapping.targetField === 'category' || mapping.targetField === 'subcategory') && 'border-blue-400 dark:border-blue-600 bg-blue-50 dark:bg-blue-950/20'
                      )}>
                        <SelectValue placeholder={t('general.select')} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="unmapped">{t('csvImport.columnMapping.notMapped')}</SelectItem>
                        <SelectItem value="ignore">{t('csvImport.columnMapping.ignoreColumn')}</SelectItem>
                        {availableFields.map(field => {
                          const isAvailable = isFieldAvailable(field.value, mapping.sourceColumn)
                          const isCurrentlySelected = mapping.targetField === field.value
                          const isImportantField = field.value === 'category' || field.value === 'subcategory'
                          
                          return (
                            <SelectItem 
                              key={field.value} 
                              value={field.value}
                              disabled={!isAvailable && !isCurrentlySelected}
                              className={cn(
                                !isAvailable && !isCurrentlySelected && 'opacity-50',
                                isImportantField && 'font-medium text-blue-600 dark:text-blue-400'
                              )}
                            >
                              {isImportantField && '📁 '}
                              {field.label}
                              {!isAvailable && !isCurrentlySelected && ` (${t('csvImport.columnMapping.alreadyUsed')})`}
                            </SelectItem>
                          )
                        })}
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="px-4 py-3 text-center">
                    {getStatusBadge(mapping)}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={cn(
                      'text-sm font-medium',
                      mapping.confidence >= 90 && 'text-green-600',
                      mapping.confidence >= 70 && mapping.confidence < 90 && 'text-amber-600',
                      mapping.confidence < 70 && 'text-gray-400'
                    )}>
                      {mapping.confidence > 0 ? `${mapping.confidence}%` : '—'}
                    </span>
                  </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* Quick Legend */}
        <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-800 flex flex-wrap gap-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3 text-green-500" />
            <span>{t('csvImport.columnMapping.mapped')}</span>
          </div>
          <div className="flex items-center gap-1">
            <AlertCircle className="w-3 h-3 text-amber-500" />
            <span>{t('csvImport.columnMapping.reviewSuggested')}</span>
          </div>
          <div className="flex items-center gap-1">
            <XCircle className="w-3 h-3 text-gray-400" />
            <span>{t('csvImport.columnMapping.notMapped')}</span>
          </div>
          <div className="flex items-center gap-1">
            <Ban className="w-3 h-3 text-gray-400" />
            <span>{t('csvImport.columnMapping.ignored')}</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded bg-blue-200 dark:bg-blue-800" />
            <span>{t('csvImport.columnMapping.categorySubCat')}</span>
          </div>
        </div>
      </GlassCard>

      {/* Smart Matching Info */}
      <GlassCard className="bg-gradient-to-br from-slate-50 to-gray-50 dark:from-slate-950/30 dark:to-gray-950/30">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-lg bg-slate-200 dark:bg-slate-800 flex items-center justify-center">
            <Zap className="w-4 h-4 text-slate-600 dark:text-slate-400" />
          </div>
          <div>
            <h4 className="font-semibold">
              {t('csvImport.columnMapping.smartMatchingActive')}
            </h4>
            <p className="text-sm text-muted-foreground">
              {t('csvImport.columnMapping.smartMatchingDescription')}
            </p>
          </div>
        </div>
      </GlassCard>
    </div>
  )
}
