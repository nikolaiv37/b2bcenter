// Feature flag for Supabase realtime subscriptions.
// Defaults to OFF for demo stability — rely on React Query refetch/invalidation.
// Set VITE_ENABLE_REALTIME=true in .env to re-enable.
export const isRealtimeEnabled = (): boolean => {
  const flag = import.meta.env.VITE_ENABLE_REALTIME
  return flag === 'true' || flag === '1'
}
