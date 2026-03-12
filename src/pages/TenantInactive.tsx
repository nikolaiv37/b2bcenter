import { GlassCard } from '@/components/GlassCard'
import { Ban } from 'lucide-react'

export function TenantInactive() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <GlassCard className="max-w-md w-full text-center">
        <Ban className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
        <h1 className="text-2xl font-bold mb-2">Workspace suspended</h1>
        <p className="text-muted-foreground">
          This workspace has been suspended. Please contact support if you believe this is a mistake.
        </p>
      </GlassCard>
    </div>
  )
}
