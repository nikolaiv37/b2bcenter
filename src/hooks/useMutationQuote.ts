import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase/client'
import { Quote, QuoteItem } from '@/types'
import { addDays } from 'date-fns'
import { sendEmail, EmailTemplates } from '@/lib/resendClient'
import { useTenant } from '@/lib/tenant/TenantProvider'

interface CreateQuoteData {
  companyId: string
  customerId: string
  customerEmail: string
  customerName: string
  items: QuoteItem[]
  subtotal: number
  tax: number
  shipping: number
  total: number
  notes?: string
}

export function useMutationCreateQuote() {
  const queryClient = useQueryClient()
  const { tenant } = useTenant()
  const tenantId = tenant?.id

  return useMutation({
    mutationFn: async (data: CreateQuoteData) => {
      if (!tenantId) {
        throw new Error('Missing tenant context')
      }
      const expiresAt = addDays(new Date(), 30).toISOString()

      // New orders auto-create as 'new' (Processing status)
      const { data: quote, error } = await supabase
        .from('quotes')
        .insert({
          tenant_id: tenantId,
          company_id: data.companyId,
          customer_id: data.customerId,
          customer_email: data.customerEmail,
          customer_name: data.customerName,
          items: data.items,
          subtotal: data.subtotal,
          tax: data.tax,
          shipping: data.shipping,
          total: data.total,
          status: 'new', // Processing status - auto-set when company user creates order
          expires_at: expiresAt,
          notes: data.notes,
        })
        .select()
        .single()

      if (error) throw error

      // Send email notification
      try {
        await sendEmail({
          to: data.customerEmail,
          subject: 'Quote Request Received',
          html: EmailTemplates.quoteReceived(
            data.customerName,
            quote.id,
            data.total
          ),
        })
      } catch (emailError) {
        console.error('Failed to send email:', emailError)
        // Don't fail the mutation if email fails
      }

      return quote as Quote
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenant', tenantId, 'quotes'] })
    },
  })
}

export function useMutationUpdateQuoteStatus() {
  const queryClient = useQueryClient()
  const { tenant } = useTenant()
  const tenantId = tenant?.id

  return useMutation({
    mutationFn: async ({
      quoteId,
      status,
      reason,
    }: {
      quoteId: string
      status: 'approved' | 'rejected'
      reason?: string
    }) => {
      const { data: quote, error } = await supabase
        .from('quotes')
        .update({ status })
        .eq('id', quoteId)
        .eq('tenant_id', tenantId)
        .select()
        .single()

      if (error) throw error

      // Send email notification
      try {
        if (status === 'approved') {
          await sendEmail({
            to: quote.customer_email,
            subject: 'Quote Approved!',
            html: EmailTemplates.quoteApproved(
              quote.customer_name,
              quote.id,
              quote.total,
              `${window.location.origin}/checkout/${quote.id}`
            ),
          })
        } else if (status === 'rejected') {
          await sendEmail({
            to: quote.customer_email,
            subject: 'Quote Update',
            html: EmailTemplates.quoteRejected(
              quote.customer_name,
              quote.id,
              reason
            ),
          })
        }
      } catch (emailError) {
        console.error('Failed to send email:', emailError)
      }

      return quote as Quote
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenant', tenantId, 'quotes'] })
    },
  })
}
