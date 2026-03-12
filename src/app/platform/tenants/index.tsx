import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { format } from 'date-fns'
import { supabase } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Building2,
  Plus,
  Search,
  Eye,
  Users,
} from 'lucide-react'
import { CreateTenantModal } from './CreateTenantModal'

interface TenantRow {
  id: string
  name: string
  slug: string
  status: 'active' | 'suspended'
  owner_user_id: string | null
  created_at: string
  admin_count: number
  member_count: number
}

export function PlatformTenantsPage() {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [createOpen, setCreateOpen] = useState(false)

  const { data: tenants, isLoading, refetch } = useQuery({
    queryKey: ['platform', 'tenants'],
    queryFn: async (): Promise<TenantRow[]> => {
      const { data: tenantRows, error } = await supabase
        .from('tenants')
        .select('id, name, slug, status, owner_user_id, created_at')
        .order('created_at', { ascending: false })

      if (error) throw error
      if (!tenantRows) return []

      const tenantIds = tenantRows.map((t) => t.id)

      const { data: memberships } = await supabase
        .from('tenant_memberships')
        .select('tenant_id, role')
        .in('tenant_id', tenantIds)

      const countMap = new Map<string, { admins: number; members: number }>()
      for (const m of memberships || []) {
        const entry = countMap.get(m.tenant_id) || { admins: 0, members: 0 }
        if (m.role === 'owner' || m.role === 'admin') {
          entry.admins++
        } else {
          entry.members++
        }
        countMap.set(m.tenant_id, entry)
      }

      return tenantRows.map((t) => ({
        id: t.id,
        name: t.name,
        slug: t.slug,
        status: t.status as 'active' | 'suspended',
        owner_user_id: t.owner_user_id,
        created_at: t.created_at,
        admin_count: countMap.get(t.id)?.admins || 0,
        member_count: countMap.get(t.id)?.members || 0,
      }))
    },
  })

  const filtered = (tenants || []).filter((t) => {
    if (!search) return true
    const q = search.toLowerCase()
    return (
      t.name.toLowerCase().includes(q) ||
      t.slug.toLowerCase().includes(q) ||
      (t.owner_user_id && t.owner_user_id.toLowerCase().includes(q))
    )
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Tenants</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Manage all workspaces on the platform
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)} className="gap-2">
          <Plus className="w-4 h-4" />
          Create Tenant
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          label="Total Tenants"
          value={tenants?.length ?? 0}
          icon={<Building2 className="w-5 h-5 text-violet-600" />}
          loading={isLoading}
        />
        <StatCard
          label="Active"
          value={tenants?.filter((t) => t.status === 'active').length ?? 0}
          icon={<div className="w-3 h-3 bg-green-500 rounded-full" />}
          loading={isLoading}
        />
        <StatCard
          label="Suspended"
          value={tenants?.filter((t) => t.status === 'suspended').length ?? 0}
          icon={<div className="w-3 h-3 bg-red-500 rounded-full" />}
          loading={isLoading}
        />
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <Input
          placeholder="Search tenants..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Tenant</TableHead>
              <TableHead>Slug</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Owner</TableHead>
              <TableHead className="text-center">
                <Users className="w-4 h-4 inline mr-1" />
                Admins
              </TableHead>
              <TableHead className="text-center">
                <Users className="w-4 h-4 inline mr-1" />
                Clients
              </TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 8 }).map((_, j) => (
                    <TableCell key={j}>
                      <Skeleton className="h-4 w-full" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-12 text-gray-500">
                  {search ? 'No tenants match your search' : 'No tenants yet'}
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((tenant) => (
                <TableRow
                  key={tenant.id}
                  className="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50"
                  onClick={() => navigate(`/platform/tenants/${tenant.id}`)}
                >
                  <TableCell className="font-medium">{tenant.name}</TableCell>
                  <TableCell>
                    <code className="text-xs bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded">
                      {tenant.slug}
                    </code>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={tenant.status === 'active' ? 'default' : 'destructive'}
                      className="text-xs"
                    >
                      {tenant.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-gray-600 dark:text-gray-400">
                    {tenant.owner_user_id ? (
                      <span className="text-gray-400 italic">Owner account</span>
                    ) : (
                      <span className="text-gray-400 italic">Invite pending</span>
                    )}
                  </TableCell>
                  <TableCell className="text-center">{tenant.admin_count}</TableCell>
                  <TableCell className="text-center">{tenant.member_count}</TableCell>
                  <TableCell className="text-sm text-gray-500">
                    {format(new Date(tenant.created_at), 'MMM d, yyyy')}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation()
                        navigate(`/platform/tenants/${tenant.id}`)
                      }}
                    >
                      <Eye className="w-4 h-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <CreateTenantModal
        open={createOpen}
        onOpenChange={setCreateOpen}
        onSuccess={() => {
          setCreateOpen(false)
          refetch()
        }}
      />
    </div>
  )
}

function StatCard({
  label,
  value,
  icon,
  loading,
}: {
  label: string
  value: number
  icon: React.ReactNode
  loading: boolean
}) {
  return (
    <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-4 flex items-center gap-4">
      <div className="w-10 h-10 rounded-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
        {icon}
      </div>
      <div>
        <p className="text-sm text-gray-500 dark:text-gray-400">{label}</p>
        {loading ? (
          <Skeleton className="h-6 w-12 mt-1" />
        ) : (
          <p className="text-xl font-bold text-gray-900 dark:text-white">{value}</p>
        )}
      </div>
    </div>
  )
}
