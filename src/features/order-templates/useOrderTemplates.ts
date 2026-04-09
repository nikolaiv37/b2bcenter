import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAppContext } from '@/lib/app/AppContext'
import { supabase } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/useAuth'
import { OrderSourceLine } from '@/lib/orderSourceCart'

export interface OrderTemplate {
  id: string
  tenant_id: string
  user_id: string
  name: string
  source_quote_id: number | null
  items: OrderSourceLine[]
  created_at: string
  updated_at: string
}

interface CreateOrderTemplateInput {
  name: string
  sourceQuoteId?: number | null
  items: OrderSourceLine[]
}

export function useOrderTemplates() {
  const { user } = useAuth()
  const { workspaceId: tenantId } = useAppContext()
  const queryClient = useQueryClient()
  const userId = user?.id

  const queryKey = ['workspace', 'order-templates', tenantId, userId]

  const { data: templates = [], isLoading } = useQuery({
    queryKey,
    queryFn: async () => {
      if (!tenantId || !userId) {
        return []
      }

      const { data, error } = await supabase
        .from('order_templates')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('user_id', userId)
        .order('updated_at', { ascending: false })

      if (error) {
        throw error
      }

      return (data ?? []) as OrderTemplate[]
    },
    enabled: !!tenantId && !!userId,
  })

  const createTemplateMutation = useMutation({
    mutationFn: async (input: CreateOrderTemplateInput) => {
      if (!tenantId || !userId) {
        throw new Error('Missing tenant context')
      }

      const { data, error } = await supabase
        .from('order_templates')
        .insert({
          tenant_id: tenantId,
          user_id: userId,
          name: input.name.trim(),
          source_quote_id: input.sourceQuoteId ?? null,
          items: input.items,
        })
        .select('*')
        .single()

      if (error) {
        throw error
      }

      return data as OrderTemplate
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey })
    },
  })

  const deleteTemplateMutation = useMutation({
    mutationFn: async (templateId: string) => {
      if (!tenantId || !userId) {
        throw new Error('Missing tenant context')
      }

      const { error } = await supabase
        .from('order_templates')
        .delete()
        .eq('id', templateId)
        .eq('tenant_id', tenantId)
        .eq('user_id', userId)

      if (error) {
        throw error
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey })
    },
  })

  return {
    templates,
    isLoading,
    createTemplate: createTemplateMutation.mutate,
    createTemplateAsync: createTemplateMutation.mutateAsync,
    isCreating: createTemplateMutation.isPending,
    deleteTemplate: deleteTemplateMutation.mutate,
    deleteTemplateAsync: deleteTemplateMutation.mutateAsync,
    isDeleting: deleteTemplateMutation.isPending,
  }
}
