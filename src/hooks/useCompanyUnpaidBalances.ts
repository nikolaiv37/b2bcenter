import { useQuery } from '@tanstack/react-query'
import { useAppContext } from '@/lib/app/AppContext'
import { supabase } from '@/lib/supabase/client'
import { useAuth } from './useAuth'

export interface CompanyUnpaidBalance {
  /** Company name or identifier */
  companyName: string
  /** Email for identification if no company name */
  email: string
  /** User ID for filtering */
  userId: string | null
  /** Sum of unpaid order totals */
  unpaidAmount: number
  /** Count of unpaid orders */
  orderCount: number
  /** Date of the most recent unpaid order */
  lastOrderDate: string
}

export interface CompanyUnpaidBalancesData {
  /** List of companies with unpaid balances */
  companies: CompanyUnpaidBalance[]
  /** Total unpaid amount across all companies */
  totalUnpaidAmount: number
  /** Total count of unpaid orders */
  totalOrdersCount: number
}

/**
 * Hook to fetch unpaid balances grouped by company for admin users.
 * 
 * Fetches orders where status is:
 * - 'new' = Processing (unpaid)
 * - 'pending' = Awaiting Payment (unpaid)
 * Groups by company and calculates totals.
 * 
 * @param limit - Maximum number of companies to return (default: 10)
 * @returns Company unpaid balances data
 */
export function useCompanyUnpaidBalances(limit: number = 10) {
  const { user, isAdmin } = useAuth()
  const { workspaceId: tenantId } = useAppContext()

  return useQuery<CompanyUnpaidBalancesData | null>({
    queryKey: ['workspace', 'company-unpaid-balances', limit],
    queryFn: async () => {
      if (!tenantId) return null
      // Fetch unpaid orders: Processing ('new') + Awaiting Payment ('pending')
      const { data: unpaidOrders, error } = await supabase
        .from('quotes')
        .select('id, total, status, created_at, user_id, company_name, email')
        .in('status', ['new', 'pending'])
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Error fetching unpaid orders for admin:', error)
        throw error
      }

      if (!unpaidOrders || unpaidOrders.length === 0) {
        return {
          companies: [],
          totalUnpaidAmount: 0,
          totalOrdersCount: 0,
        }
      }

      // Group by company (using company_name, email, or user_id as identifier)
      const companyMap = new Map<string, {
        companyName: string
        email: string
        userId: string | null
        unpaidAmount: number
        orderCount: number
        lastOrderDate: string
      }>()

      unpaidOrders.forEach((order) => {
        // Create a unique key for the company
        const key = order.company_name || order.email || order.user_id || 'unknown'
        
        const existing = companyMap.get(key)
        
        if (existing) {
          existing.unpaidAmount += Number(order.total || 0)
          existing.orderCount += 1
          // Update last order date if this one is more recent
          if (new Date(order.created_at) > new Date(existing.lastOrderDate)) {
            existing.lastOrderDate = order.created_at
          }
        } else {
          companyMap.set(key, {
            companyName: order.company_name || '',
            email: order.email || '',
            userId: order.user_id || null,
            unpaidAmount: Number(order.total || 0),
            orderCount: 1,
            lastOrderDate: order.created_at,
          })
        }
      })

      // Convert to array, sort by unpaid amount (desc), and limit
      const companies = Array.from(companyMap.values())
        .sort((a, b) => b.unpaidAmount - a.unpaidAmount)
        .slice(0, limit)

      // Calculate totals
      const totalUnpaidAmount = unpaidOrders.reduce(
        (sum, order) => sum + Number(order.total || 0),
        0
      )
      const totalOrdersCount = unpaidOrders.length

      return {
        companies,
        totalUnpaidAmount,
        totalOrdersCount,
      }
    },
    // Only fetch for admin users
    enabled: isAdmin && !!user?.id && !!tenantId,
    // Refetch every 30 seconds to stay in sync
    refetchInterval: 30000,
    staleTime: 10000,
  })
}

/**
 * Hook to fetch all unpaid balances (no limit) for the full table view.
 * Processing ('new') + Awaiting Payment ('pending') statuses.
 */
export function useAllCompanyUnpaidBalances() {
  const { user, isAdmin } = useAuth()
  const { workspaceId: tenantId } = useAppContext()

  return useQuery<CompanyUnpaidBalancesData | null>({
    queryKey: ['workspace', 'all-company-unpaid-balances'],
    queryFn: async () => {
      if (!tenantId) return null
      // Fetch unpaid orders: Processing ('new') + Awaiting Payment ('pending')
      const { data: unpaidOrders, error } = await supabase
        .from('quotes')
        .select('id, total, status, created_at, user_id, company_name, email')
        .in('status', ['new', 'pending'])
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Error fetching all unpaid orders for admin:', error)
        throw error
      }

      if (!unpaidOrders || unpaidOrders.length === 0) {
        return {
          companies: [],
          totalUnpaidAmount: 0,
          totalOrdersCount: 0,
        }
      }

      // Group by company
      const companyMap = new Map<string, {
        companyName: string
        email: string
        userId: string | null
        unpaidAmount: number
        orderCount: number
        lastOrderDate: string
      }>()

      unpaidOrders.forEach((order) => {
        const key = order.company_name || order.email || order.user_id || 'unknown'
        
        const existing = companyMap.get(key)
        
        if (existing) {
          existing.unpaidAmount += Number(order.total || 0)
          existing.orderCount += 1
          if (new Date(order.created_at) > new Date(existing.lastOrderDate)) {
            existing.lastOrderDate = order.created_at
          }
        } else {
          companyMap.set(key, {
            companyName: order.company_name || '',
            email: order.email || '',
            userId: order.user_id || null,
            unpaidAmount: Number(order.total || 0),
            orderCount: 1,
            lastOrderDate: order.created_at,
          })
        }
      })

      // Convert to array and sort by unpaid amount (desc) - no limit
      const companies = Array.from(companyMap.values())
        .sort((a, b) => b.unpaidAmount - a.unpaidAmount)

      const totalUnpaidAmount = unpaidOrders.reduce(
        (sum, order) => sum + Number(order.total || 0),
        0
      )
      const totalOrdersCount = unpaidOrders.length

      return {
        companies,
        totalUnpaidAmount,
        totalOrdersCount,
      }
    },
    enabled: isAdmin && !!user?.id && !!tenantId,
    refetchInterval: 30000,
    staleTime: 10000,
  })
}
