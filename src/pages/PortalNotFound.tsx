import { GlassCard } from '@/components/GlassCard'
import { AlertCircle } from 'lucide-react'

export function PortalNotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <GlassCard className="max-w-md w-full text-center">
        <AlertCircle className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
        <h1 className="text-2xl font-bold mb-2">Portal not found</h1>
        <p className="text-muted-foreground">
          This domain is not linked to a Centivon tenant. If you expected access, contact your administrator.
        </p>
      </GlassCard>
    </div>
  )
}
