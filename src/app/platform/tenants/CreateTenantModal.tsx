import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useToast } from '@/components/ui/use-toast'
import { Loader2 } from 'lucide-react'

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

interface CreateTenantModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

export function CreateTenantModal({ open, onOpenChange, onSuccess }: CreateTenantModalProps) {
  const { toast } = useToast()
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [slugTouched, setSlugTouched] = useState(false)
  const [ownerEmail, setOwnerEmail] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!slugTouched && name) {
      setSlug(slugify(name))
    }
  }, [name, slugTouched])

  useEffect(() => {
    if (!open) {
      setName('')
      setSlug('')
      setSlugTouched(false)
      setOwnerEmail('')
      setSubmitting(false)
    }
  }, [open])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim() || !ownerEmail.trim()) return

    setSubmitting(true)
    try {
      const { data, error } = await supabase.functions.invoke('create-tenant', {
        body: {
          name: name.trim(),
          slug: slug.trim() || slugify(name.trim()),
          owner_email: ownerEmail.trim(),
        },
      })

      if (error) {
        toast({
          title: 'Failed to create tenant',
          description: error.message || 'An unexpected error occurred',
          variant: 'destructive',
        })
        return
      }

      if (data?.error) {
        toast({
          title: 'Failed to create tenant',
          description: data.error,
          variant: 'destructive',
        })
        return
      }

      toast({
        title: 'Tenant created',
        description: `${name} has been created and an owner invitation sent to ${ownerEmail}.`,
      })

      onSuccess()
    } catch (err) {
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Unexpected error',
        variant: 'destructive',
      })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create Tenant</DialogTitle>
          <DialogDescription>
            Create a new workspace and send an owner invitation.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="tenant-name">Tenant Name</Label>
            <Input
              id="tenant-name"
              placeholder="Acme Corp"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="tenant-slug">Slug</Label>
            <Input
              id="tenant-slug"
              placeholder="acme-corp"
              value={slug}
              onChange={(e) => {
                setSlugTouched(true)
                setSlug(slugify(e.target.value))
              }}
            />
            <p className="text-xs text-gray-500">
              Used in the URL: /t/{slug || 'your-slug'}
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="owner-email">Owner Email</Label>
            <Input
              id="owner-email"
              type="email"
              placeholder="owner@example.com"
              value={ownerEmail}
              onChange={(e) => setOwnerEmail(e.target.value)}
              required
            />
            <p className="text-xs text-gray-500">
              This person will receive an invitation and become the workspace owner.
            </p>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={submitting || !name.trim() || !ownerEmail.trim()}>
              {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Create & Send Invite
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
