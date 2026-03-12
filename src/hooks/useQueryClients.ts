import { useQuery } from '@tanstack/react-query'
import { useAppContext } from '@/lib/app/AppContext'
import { supabase } from '@/lib/supabase/client'
import { Client } from '@/types'

interface QuoteCompanyRow {
  user_id?: string | null
  company_name?: string | null
  email?: string | null
  status?: string | null
  total?: string | number | null
}

export function useQueryClients() {
  const { workspaceId: tenantId } = useAppContext()
  return useQuery({
    queryKey: ['workspace', 'clients'],
    queryFn: async () => {
      if (!tenantId) return []

      // Tenant membership is the source of truth for client/admin/owner access.
      // We still show pending invited client profiles (no membership yet), but
      // must exclude owner/admin accounts even if a profile role was left as
      // 'company' by older data or edge-case onboarding flows.
      const { data: memberships, error: membershipsError } = await supabase
        .from('tenant_memberships')
        .select('user_id, role')
        .eq('tenant_id', tenantId)

      if (membershipsError) throw membershipsError

      const membershipRoleByUserId = new Map<string, string>(
        (memberships || [])
          .filter((m) => !!m.user_id)
          .map((m) => [m.user_id as string, m.role as string])
      )

      // Base: all company-role profiles (B2B clients)
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('*')
        .eq('role', 'company')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false })

      if (profilesError) throw profilesError

      const baseClients = ((profiles || []) as Client[]).filter((profile) => {
        const membershipRole = membershipRoleByUserId.get(profile.id)

        if (membershipRole) {
          return membershipRole === 'member'
        }

        // Keep pending invited client profiles visible before they accept.
        return profile.invitation_status === 'invited'
      })

      if (!baseClients.length) {
        return baseClients
      }

      // Enrich with latest company_name/email from quotes (same source as Orders page)
      const { data: quoteCompanies, error: quotesError } = await supabase
        .from('quotes')
        .select('user_id, company_name, email, created_at, status, total')
        .not('user_id', 'is', null)
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false })

      if (quotesError) {
        // Fail gracefully: still return base clients if quotes lookup fails
        console.error('Failed to fetch quote company data for clients:', quotesError)
        return baseClients
      }

      const companyByUserId = new Map<
        string,
        {
          company_name?: string | null
          email?: string | null
          orders_count: number
          unpaid_amount: number
        }
      >()

      ;((quoteCompanies as QuoteCompanyRow[] | null) || []).forEach((quote) => {
        const userId = quote.user_id || null
        if (!userId) return

        const isUnpaid = ['new', 'pending'].includes(quote.status || '')
        const total = Number(quote.total || 0)

        const existing = companyByUserId.get(userId)

        // Because we ordered DESC by created_at, first hit per user_id is the latest
        if (!existing) {
          companyByUserId.set(userId, {
            company_name: quote.company_name || null,
            email: quote.email || null,
            orders_count: 1,
            unpaid_amount: isUnpaid ? total : 0,
          })
        } else {
          existing.orders_count += 1
          if (isUnpaid) {
            existing.unpaid_amount += total
          }
        }
      })

      const enriched = baseClients.map((client) => {
        const hint = companyByUserId.get(client.id)
        if (!hint) return client

        return {
          ...client,
          company_name: client.company_name || hint.company_name || null,
          email: client.email || hint.email || null,
          orders_count: hint.orders_count,
          unpaid_amount: hint.unpaid_amount,
        }
      })

      return enriched
    },
    staleTime: 30 * 1000,
    enabled: !!tenantId,
  })
}

/** Fetch pending invitations for the current tenant (admin only) */
export function useQueryInvitations() {
  const { workspaceId: tenantId } = useAppContext()
  return useQuery({
    queryKey: ['workspace', 'invitations'],
    queryFn: async () => {
      if (!tenantId) return []
      const { data, error } = await supabase
        .from('tenant_invitations')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('status', 'pending')
        .order('created_at', { ascending: false })

      if (error) throw error
      return data || []
    },
    staleTime: 30 * 1000,
    enabled: !!tenantId,
  })
}

export function useQueryClient(clientId: string) {
  const { workspaceId: tenantId } = useAppContext()
  return useQuery({
    queryKey: ['workspace', 'clients', clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', clientId)
        .eq('role', 'company')
        .eq('tenant_id', tenantId)
        .single()

      if (error) throw error
      return data as Client
    },
    enabled: !!clientId && !!tenantId,
  })
}
