import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase/client'
import { useAuth } from './useAuth'
import { useTenant } from '@/lib/tenant/TenantProvider'

export interface UnpaidBalanceData {
  /** Sum of all unpaid order totals */
  unpaidBalance: number
  /** Count of unpaid orders */
  unpaidOrdersCount: number
  /** Total order count for this user */
  totalOrdersCount: number
}

/**
 * Hook to fetch unpaid balance data for non-admin (company/buyer) users.
 * 
 * Fetches orders from the quotes table where status is 'new' or 'pending'
 * (treated as unpaid/awaiting payment). RLS automatically filters by user.
 * 
 * @returns Unpaid balance data including sum, count, and total orders
 */
export function useUnpaidBalance() {
  const { user, isAdmin } = useAuth()
  const { tenant } = useTenant()
  const tenantId = tenant?.id

  return useQuery<UnpaidBalanceData | null>({
    queryKey: ['tenant', tenantId, 'unpaid-balance', user?.id],
    queryFn: async () => {
      if (!tenantId || !user?.id) return null

      // Fetch all orders for this user (RLS filters automatically by company)
      // Status meanings: 
      // - 'new' = Processing (unpaid)
      // - 'pending' = Awaiting Payment (unpaid)
      // - 'shipped' = Shipped (may be unpaid)
      // - 'approved' = Completed & Sent (paid)
      const { data: allOrders, error: allError } = await supabase
        .from('quotes')
        .select('id, total, status')
        .in('status', ['new', 'pending', 'shipped', 'approved'])
        .eq('tenant_id', tenantId)

      if (allError) {
        console.error('Error fetching orders for unpaid balance:', allError)
        throw allError
      }

      // Calculate unpaid balance (orders that are not completed/approved)
      // Processing ('new') and Awaiting Payment ('pending') are unpaid
      const unpaidOrders = allOrders?.filter(
        (o) => o.status === 'new' || o.status === 'pending'
      ) || []

      const unpaidBalance = unpaidOrders.reduce(
        (sum, order) => sum + Number(order.total || 0),
        0
      )

      const unpaidOrdersCount = unpaidOrders.length
      const totalOrdersCount = allOrders?.length || 0

      return {
        unpaidBalance,
        unpaidOrdersCount,
        totalOrdersCount,
      }
    },
    // Only fetch for non-admin users with valid user ID
    enabled: !isAdmin && !!user?.id && !!tenantId,
    // Refetch every 30 seconds to stay in sync with layout topbar
    refetchInterval: 30000,
    staleTime: 10000, // Consider data stale after 10 seconds
  })
}
