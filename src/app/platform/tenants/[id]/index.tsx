import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { format } from 'date-fns'
import { supabase } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useToast } from '@/components/ui/use-toast'
import {
  ArrowLeft,
  Building2,
  Users,
  Package,
  FolderKanban,
  ShieldAlert,
  UserPlus,
  Trash2,
  Loader2,
  Ban,
  CheckCircle,
} from 'lucide-react'

interface TenantDetail {
  id: string
  name: string
  slug: string
  status: 'active' | 'suspended'
  owner_user_id: string | null
  created_at: string
}

interface MemberRow {
  id: string
  user_id: string
  role: string
  created_at: string
}

export function PlatformTenantDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { toast } = useToast()
  const queryClient = useQueryClient()

  const [inviteOpen, setInviteOpen] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteSubmitting, setInviteSubmitting] = useState(false)
  const [confirmSuspend, setConfirmSuspend] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleteConfirmSlug, setDeleteConfirmSlug] = useState('')

  // Fetch tenant detail
  const { data: tenant, isLoading: tenantLoading } = useQuery({
    queryKey: ['platform', 'tenant', id],
    queryFn: async (): Promise<TenantDetail | null> => {
      const { data, error } = await supabase
        .from('tenants')
        .select('id, name, slug, status, owner_user_id, created_at')
        .eq('id', id!)
        .single()

      if (error) throw error
      return data as TenantDetail
    },
    enabled: !!id,
  })

  // Fetch memberships with profile info
  const { data: members, isLoading: membersLoading } = useQuery({
    queryKey: ['platform', 'tenant', id, 'members'],
    queryFn: async (): Promise<MemberRow[]> => {
      const { data: memberships, error } = await supabase
        .from('tenant_memberships')
        .select('id, user_id, role, created_at')
        .eq('tenant_id', id!)

      if (error) throw error
      if (!memberships?.length) return []

      return memberships.map((m) => ({
        id: m.id,
        user_id: m.user_id,
        role: m.role,
        created_at: m.created_at,
      }))
    },
    enabled: !!id,
  })

  // Fetch stats
  const { data: stats } = useQuery({
    queryKey: ['platform', 'tenant', id, 'stats'],
    queryFn: async () => {
      const [products, categories, admins, clients] = await Promise.all([
        supabase.from('products').select('id', { count: 'exact', head: true }).eq('tenant_id', id!),
        supabase.from('categories').select('id', { count: 'exact', head: true }).eq('tenant_id', id!),
        supabase.from('tenant_memberships').select('id', { count: 'exact', head: true }).eq('tenant_id', id!).in('role', ['owner', 'admin']),
        supabase.from('tenant_memberships').select('id', { count: 'exact', head: true }).eq('tenant_id', id!).eq('role', 'member'),
      ])

      return {
        products: products.count ?? 0,
        categories: categories.count ?? 0,
        admins: admins.count ?? 0,
        clients: clients.count ?? 0,
      }
    },
    enabled: !!id,
  })

  // Suspend / resume mutation
  const statusMutation = useMutation({
    mutationFn: async (newStatus: 'active' | 'suspended') => {
      const { error } = await supabase
        .from('tenants')
        .update({ status: newStatus })
        .eq('id', id!)

      if (error) throw error
    },
    onSuccess: (_, newStatus) => {
      queryClient.invalidateQueries({ queryKey: ['platform', 'tenant', id] })
      queryClient.invalidateQueries({ queryKey: ['platform', 'tenants'] })
      toast({
        title: newStatus === 'suspended' ? 'Tenant suspended' : 'Tenant reactivated',
        description: `${tenant?.name} is now ${newStatus}.`,
      })
      setConfirmSuspend(false)
    },
    onError: (err) => {
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Failed to update status',
        variant: 'destructive',
      })
    },
  })

  // Remove member mutation
  const removeMemberMutation = useMutation({
    mutationFn: async (membershipId: string) => {
      const { error } = await supabase
        .from('tenant_memberships')
        .delete()
        .eq('id', membershipId)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['platform', 'tenant', id, 'members'] })
      toast({ title: 'Member removed' })
    },
    onError: (err) => {
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Failed to remove member',
        variant: 'destructive',
      })
    },
  })

  const deleteTenantMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('delete-tenant', {
        body: {
          tenant_id: id,
          delete_member_accounts: true,
        },
      })

      if (error) throw new Error(error.message || 'Failed to delete tenant')
      if (data?.error) throw new Error(data.error)

      return data as {
        success: boolean
        summary?: {
          deleted_tenant_id: string
          deleted_member_accounts: number
          skipped_member_accounts: number
        }
      }
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['platform', 'tenants'] })
      queryClient.removeQueries({ queryKey: ['platform', 'tenant', id] })
      toast({
        title: 'Tenant deleted',
        description:
          data?.summary?.deleted_member_accounts != null
            ? `${tenant?.name} was deleted. Removed ${data.summary.deleted_member_accounts} linked account(s).`
            : `${tenant?.name} was deleted.`,
      })
      setConfirmDelete(false)
      setDeleteConfirmSlug('')
      navigate('/platform/tenants')
    },
    onError: (err) => {
      toast({
        title: 'Delete failed',
        description: err instanceof Error ? err.message : 'Failed to delete tenant',
        variant: 'destructive',
      })
    },
  })

  const handleInviteAdmin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!inviteEmail.trim() || !id) return
    setInviteSubmitting(true)

    try {
      const { data, error } = await supabase.functions.invoke('invite-client', {
        body: {
          email: inviteEmail.trim(),
          tenant_id: id,
          target_role: 'admin',
        },
      })

      if (error || data?.error) {
        toast({
          title: 'Invite failed',
          description: data?.error || error?.message || 'Unknown error',
          variant: 'destructive',
        })
        return
      }

      toast({ title: 'Admin invitation sent', description: `Invited ${inviteEmail}` })
      setInviteEmail('')
      setInviteOpen(false)
      queryClient.invalidateQueries({ queryKey: ['platform', 'tenant', id, 'members'] })
    } catch (err) {
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Unexpected error',
        variant: 'destructive',
      })
    } finally {
      setInviteSubmitting(false)
    }
  }

  const admins = (members || []).filter((m) => m.role === 'owner' || m.role === 'admin')
  const clientMembers = (members || []).filter((m) => m.role === 'member')

  if (tenantLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  if (!tenant) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Tenant not found</p>
        <Button variant="outline" className="mt-4" onClick={() => navigate('/platform/tenants')}>
          Back to Tenants
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => navigate('/platform/tenants')}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{tenant.name}</h1>
            <Badge variant={tenant.status === 'active' ? 'default' : 'destructive'}>
              {tenant.status}
            </Badge>
          </div>
          <p className="text-sm text-gray-500 mt-1">
            <code className="bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded">{tenant.slug}</code>
            {' '}&middot;{' '}
            Created {format(new Date(tenant.created_at), 'MMM d, yyyy')}
          </p>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="admins">Admins ({admins.length})</TabsTrigger>
          <TabsTrigger value="clients">Clients ({clientMembers.length})</TabsTrigger>
          <TabsTrigger value="danger">Danger Zone</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <OverviewCard
              icon={<Package className="w-5 h-5 text-blue-600" />}
              label="Products"
              value={stats?.products ?? '-'}
            />
            <OverviewCard
              icon={<FolderKanban className="w-5 h-5 text-green-600" />}
              label="Categories"
              value={stats?.categories ?? '-'}
            />
            <OverviewCard
              icon={<Users className="w-5 h-5 text-violet-600" />}
              label="Admins"
              value={stats?.admins ?? '-'}
            />
            <OverviewCard
              icon={<Building2 className="w-5 h-5 text-amber-600" />}
              label="Clients"
              value={stats?.clients ?? '-'}
            />
          </div>
        </TabsContent>

        {/* Admins Tab */}
        <TabsContent value="admins" className="space-y-4">
          <div className="flex justify-end">
            <Button size="sm" onClick={() => setInviteOpen(true)} className="gap-2">
              <UserPlus className="w-4 h-4" />
              Invite Admin
            </Button>
          </div>
          <MembersTable
            members={admins}
            loading={membersLoading}
            ownerUserId={tenant.owner_user_id}
            onRemove={(m) => removeMemberMutation.mutate(m.id)}
          />
        </TabsContent>

        {/* Clients Tab */}
        <TabsContent value="clients" className="space-y-4">
          <MembersTable
            members={clientMembers}
            loading={membersLoading}
            ownerUserId={tenant.owner_user_id}
            onRemove={(m) => removeMemberMutation.mutate(m.id)}
          />
        </TabsContent>

        {/* Danger Zone Tab */}
        <TabsContent value="danger" className="space-y-4">
          <Card className="border-red-200 dark:border-red-900">
            <CardHeader>
              <CardTitle className="text-red-600 dark:text-red-400 flex items-center gap-2">
                <ShieldAlert className="w-5 h-5" />
                Danger Zone
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {tenant.status === 'active' ? (
                <div className="flex items-center justify-between p-4 bg-red-50 dark:bg-red-900/10 rounded-lg">
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">Suspend Tenant</p>
                    <p className="text-sm text-gray-500">
                      All users will lose access to this workspace until reactivated.
                    </p>
                  </div>
                  <Button
                    variant="destructive"
                    onClick={() => setConfirmSuspend(true)}
                    disabled={statusMutation.isPending}
                  >
                    <Ban className="w-4 h-4 mr-2" />
                    Suspend
                  </Button>
                </div>
              ) : (
                <div className="flex items-center justify-between p-4 bg-green-50 dark:bg-green-900/10 rounded-lg">
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">Reactivate Tenant</p>
                    <p className="text-sm text-gray-500">
                      Restore access for all users in this workspace.
                    </p>
                  </div>
                  <Button
                    variant="default"
                    onClick={() => statusMutation.mutate('active')}
                    disabled={statusMutation.isPending}
                  >
                    {statusMutation.isPending ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <CheckCircle className="w-4 h-4 mr-2" />
                    )}
                    Reactivate
                  </Button>
                </div>
              )}

              <div className="flex items-center justify-between p-4 bg-red-50 dark:bg-red-900/10 rounded-lg border border-red-200 dark:border-red-900/40">
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">Delete Tenant Permanently</p>
                  <p className="text-sm text-gray-500">
                    Deletes the workspace, frees its slug, removes invitations and memberships, and attempts to delete linked tenant member accounts.
                  </p>
                </div>
                <Button
                  variant="destructive"
                  onClick={() => setConfirmDelete(true)}
                  disabled={deleteTenantMutation.isPending}
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete Tenant
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Invite Admin Dialog */}
      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Invite Admin</DialogTitle>
            <DialogDescription>
              Send an admin invitation for {tenant.name}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleInviteAdmin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="admin-email">Email</Label>
              <Input
                id="admin-email"
                type="email"
                placeholder="admin@example.com"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                required
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setInviteOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={inviteSubmitting || !inviteEmail.trim()}>
                {inviteSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Send Invitation
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Confirm Suspend Dialog */}
      <Dialog open={confirmSuspend} onOpenChange={setConfirmSuspend}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Suspend {tenant.name}?</DialogTitle>
            <DialogDescription>
              All users will immediately lose access to this workspace.
              You can reactivate it later.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmSuspend(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => statusMutation.mutate('suspended')}
              disabled={statusMutation.isPending}
            >
              {statusMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Confirm Suspend
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirm Delete Dialog */}
      <Dialog
        open={confirmDelete}
        onOpenChange={(open) => {
          setConfirmDelete(open)
          if (!open) setDeleteConfirmSlug('')
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete {tenant.name} permanently?</DialogTitle>
            <DialogDescription>
              This cannot be undone. The tenant record will be deleted (freeing slug <code>{tenant.slug}</code>), tenant data will be cleaned up, and linked member accounts may also be removed.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <Label htmlFor="confirm-delete-slug">
              Type the tenant slug to confirm: <code>{tenant.slug}</code>
            </Label>
            <Input
              id="confirm-delete-slug"
              value={deleteConfirmSlug}
              onChange={(e) => setDeleteConfirmSlug(e.target.value)}
              placeholder={tenant.slug}
              autoComplete="off"
            />
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setConfirmDelete(false)
                setDeleteConfirmSlug('')
              }}
              disabled={deleteTenantMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteTenantMutation.mutate()}
              disabled={deleteTenantMutation.isPending || deleteConfirmSlug.trim() !== tenant.slug}
            >
              {deleteTenantMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Permanently Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function OverviewCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string | number }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center gap-3">
          {icon}
          <div>
            <p className="text-sm text-gray-500">{label}</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">{value}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function MembersTable({
  members,
  loading,
  ownerUserId,
  onRemove,
}: {
  members: MemberRow[]
  loading: boolean
  ownerUserId: string | null
  onRemove: (member: MemberRow) => void
}) {
  if (loading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    )
  }

  if (members.length === 0) {
    return <p className="text-center py-8 text-gray-500">No members</p>
  }

  return (
    <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>User</TableHead>
            <TableHead>Role</TableHead>
            <TableHead>Joined</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {members.map((m) => {
            const isOwner = m.user_id === ownerUserId
            return (
              <TableRow key={m.id}>
                <TableCell>
                  <div>
                    <p className="font-medium">{`User ${m.user_id.slice(0, 8)}`}</p>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant={isOwner ? 'default' : 'secondary'} className="text-xs">
                    {m.role}
                  </Badge>
                </TableCell>
                <TableCell className="text-sm text-gray-500">
                  {format(new Date(m.created_at), 'MMM d, yyyy')}
                </TableCell>
                <TableCell className="text-right">
                  {!isOwner && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-red-600 hover:text-red-700"
                      onClick={() => onRemove(m)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}
