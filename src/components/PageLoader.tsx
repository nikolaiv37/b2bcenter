import { Skeleton } from '@/components/ui/skeleton'

export function PageLoader() {
  return (
    <div className="container mx-auto p-6 space-y-6">
      <Skeleton className="h-12 w-64" />
      <Skeleton className="h-64 w-full" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    </div>
  )
}
