import { useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase/client'
import { GlassCard } from '@/components/GlassCard'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useAuth } from '@/hooks/useAuth'
import { useToast } from '@/components/ui/use-toast'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Upload,
  X,
  Image as ImageIcon,
  AlertCircle,
  CheckCircle2,
  Loader2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTenant } from '@/lib/tenant/TenantProvider'
import { sendNotification } from '@/lib/notifications'

interface OrderItem {
  product_id?: string
  product_name: string
  sku: string
  quantity: number
  unit_price: number
  total: number
  image_url?: string
}


interface SelectedItem {
  sku: string
  name: string
  quantity: number
  maxQuantity: number
  imageUrl?: string
}

interface ComplaintFormData {
  orderId: string
  selectedItems: SelectedItem[]
  reason: string
  description: string
  photos: File[]
}

export function NewComplaintTab({ onSubmitted }: { onSubmitted: () => void }) {
  const { t } = useTranslation()
  const { user, profile, company } = useAuth()
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const { tenant } = useTenant()
  const tenantId = tenant?.id

  const [formData, setFormData] = useState<ComplaintFormData>({
    orderId: '',
    selectedItems: [],
    reason: '',
    description: '',
    photos: [],
  })

  const [dragActive, setDragActive] = useState(false)
  const [photoPreviews, setPhotoPreviews] = useState<string[]>([])

  // Fetch user's orders (from quotes table - this is the orders table in this system)
  const isDevMode = import.meta.env.VITE_DEV_MODE === 'true'
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || ''
  const isDemoMode = supabaseUrl.includes('placeholder')
  const devUserId = (isDevMode || isDemoMode) ? '00000000-0000-0000-0000-000000000123' : null
  const userId = user?.id || devUserId

  const { data: orders, isLoading: ordersLoading } = useQuery({
    queryKey: ['tenant', tenantId, 'user-orders-complaints', userId, isDevMode || isDemoMode],
    queryFn: async () => {
      if (!userId || !tenantId) return []

      // Query quotes table directly (this is the orders table in this system)
      // In dev/demo mode, show all orders. In production, filter by user_id
      let query = supabase
        .from('quotes')
        .select('id, order_number, items, created_at, user_id')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false })
        .limit(100)

      // Only filter by user_id in production mode (match orders page pattern)
      if (!isDevMode && !isDemoMode && userId) {
        // user_id in quotes table is TEXT, so convert to string
        query = query.eq('user_id', userId.toString())
      }

      const { data: quotes, error: quotesError } = await query

      if (quotesError) {
        // If table doesn't exist, return empty array
        if (quotesError.code === 'PGRST205' || quotesError.message?.includes('Could not find the table')) {
          return []
        }
        throw quotesError
      }

      return (quotes || []).map((q: {
        id: string | number
        order_number?: number
        items: OrderItem[]
        created_at: string
      }) => ({
        id: q.id,
        order_number: q.order_number || q.id,
        items: Array.isArray(q.items) ? q.items : [],
        created_at: q.created_at,
      }))
    },
    enabled: !!userId && !!tenantId,
  })

  // Get selected order
  const selectedOrder = orders?.find((o) => o.id.toString() === formData.orderId)

  // Handle order selection
  const handleOrderSelect = (orderId: string) => {
    setFormData({
      ...formData,
      orderId,
      selectedItems: [],
    })
  }

  // Toggle item selection
  const toggleItemSelection = (item: OrderItem) => {
    const existingIndex = formData.selectedItems.findIndex(
      (si) => si.sku === item.sku
    )

    if (existingIndex >= 0) {
      // Remove item
      setFormData({
        ...formData,
        selectedItems: formData.selectedItems.filter((_, i) => i !== existingIndex),
      })
    } else {
      // Add item
      setFormData({
        ...formData,
        selectedItems: [
          ...formData.selectedItems,
          {
            sku: item.sku,
            name: item.product_name,
            quantity: 1,
            maxQuantity: item.quantity,
            imageUrl: item.image_url,
          },
        ],
      })
    }
  }

  // Update item quantity
  const updateItemQuantity = (sku: string, quantity: number) => {
    setFormData({
      ...formData,
      selectedItems: formData.selectedItems.map((item) =>
        item.sku === sku
          ? { ...item, quantity: Math.min(Math.max(1, quantity), item.maxQuantity) }
          : item
      ),
    })
  }

  // Handle photo upload
  const handlePhotoSelect = useCallback((files: FileList | null) => {
    if (!files) return

    const newFiles: File[] = []
    const remainingSlots = 5 - formData.photos.length

    Array.from(files).slice(0, remainingSlots).forEach((file) => {
      if (file.type.startsWith('image/')) {
        newFiles.push(file)
      }
    })

    if (newFiles.length === 0) return

    // Create previews for new files
    const previewPromises = newFiles.map((file) => {
      return new Promise<string>((resolve) => {
        const reader = new FileReader()
        reader.onload = (e) => {
          resolve(e.target?.result as string)
        }
        reader.readAsDataURL(file)
      })
    })

    Promise.all(previewPromises).then((previews) => {
      setPhotoPreviews((prev) => [...prev, ...previews])
      setFormData((prev) => ({
        ...prev,
        photos: [...prev.photos, ...newFiles],
      }))
    })
  }, [formData.photos.length])

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true)
    } else if (e.type === 'dragleave') {
      setDragActive(false)
    }
  }, [])

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      setDragActive(false)
      handlePhotoSelect(e.dataTransfer.files)
    },
    [handlePhotoSelect]
  )

  const removePhoto = (index: number) => {
    setFormData({
      ...formData,
      photos: formData.photos.filter((_, i) => i !== index),
    })
    setPhotoPreviews(photoPreviews.filter((_, i) => i !== index))
  }

  // Submit complaint
  const submitMutation = useMutation({
    mutationFn: async (data: ComplaintFormData) => {
      if (!user?.id || !tenantId) throw new Error('Missing tenant context')

      // Upload photos
      const photoUrls: string[] = []
      for (const photo of data.photos) {
        const fileExt = photo.name.split('.').pop()
        const fileName = `complaints/${user.id}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`
        
        const { error: uploadError } = await supabase.storage
          .from('complaints')
          .upload(fileName, photo)

        if (uploadError) {
          console.error('Photo upload error:', uploadError)
          continue
        }

        const { data: { publicUrl } } = supabase.storage
          .from('complaints')
          .getPublicUrl(fileName)

        photoUrls.push(publicUrl)
      }

      // Create complaint
      const { data: complaint, error } = await supabase
        .from('complaints')
        .insert({
          tenant_id: tenantId,
          user_id: user.id,
          order_id: data.orderId,
          status: 'pending',
          items: data.selectedItems.map((item) => ({
            sku: item.sku,
            name: item.name,
            quantity: item.quantity,
          })),
          photos: photoUrls,
          reason: data.reason,
          message: data.description,
        })
        .select()
        .single()

      if (error) throw error
      return complaint
    },
    onSuccess: (data) => {
      // Notify admins about the new complaint
      sendNotification({
        type: 'complaint_created',
        entityType: 'complaints',
        entityId: data?.id,
        metadata: {
          company_name: company?.name || profile?.company_name || profile?.full_name || user?.email || 'Unknown',
        },
        targetAudience: 'admins',
      })

      toast({
        title: t('complaints.complaintSubmitted'),
        description: t('complaints.complaintSubmittedDescription'),
      })
      queryClient.invalidateQueries({ queryKey: ['tenant', tenantId, 'complaints', user?.id] })
      onSubmitted()
      
      // Reset form
      setFormData({
        orderId: '',
        selectedItems: [],
        reason: '',
        description: '',
        photos: [],
      })
      setPhotoPreviews([])
    },
    onError: (error: Error) => {
      toast({
        title: t('complaints.error'),
        description: error.message || t('complaints.failedToSubmit'),
        variant: 'destructive',
      })
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.orderId) {
      toast({
        title: t('complaints.error'),
        description: t('complaints.selectOrder'),
        variant: 'destructive',
      })
      return
    }

    if (formData.selectedItems.length === 0) {
      toast({
        title: t('complaints.error'),
        description: t('complaints.selectItems'),
        variant: 'destructive',
      })
      return
    }

    if (!formData.reason) {
      toast({
        title: t('complaints.error'),
        description: t('complaints.selectReason'),
        variant: 'destructive',
      })
      return
    }

    submitMutation.mutate(formData)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <GlassCard className="p-6 space-y-6">
        <h2 className="text-xl font-semibold">{t('complaints.newComplaint')}</h2>

        {/* User Info (Auto-filled) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label htmlFor="name">{t('general.name')}</Label>
            <Input
              id="name"
              value={profile?.full_name || ''}
              disabled
              className="bg-muted"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">{t('auth.email')}</Label>
            <Input
              id="email"
              value={profile?.email || user?.email || ''}
              disabled
              className="bg-muted"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="phone">{t('general.phone')}</Label>
            <Input
              id="phone"
              placeholder={t('general.none')}
              disabled
              className="bg-muted"
            />
          </div>
        </div>

        {/* Order Selection */}
        <div className="space-y-2">
          <Label htmlFor="order">{t('complaints.orderId')} *</Label>
          {ordersLoading ? (
            <Skeleton className="h-10 w-full" />
          ) : (
            <Select
              value={formData.orderId}
              onValueChange={handleOrderSelect}
              required
            >
              <SelectTrigger id="order">
                <SelectValue placeholder={t('complaints.selectOrder')} />
              </SelectTrigger>
              <SelectContent>
                {orders && orders.length > 0 ? (
                  orders.map((order) => (
                    <SelectItem key={order.id} value={order.id.toString()}>
                      {t('orders.order')} #{order.order_number || order.id} -{' '}
                      {new Date(order.created_at).toLocaleDateString()}
                    </SelectItem>
                  ))
                ) : (
                  <SelectItem value="no-orders" disabled>
                    {t('orders.noOrdersFound')}
                  </SelectItem>
                )}
              </SelectContent>
            </Select>
          )}
        </div>

        {/* Order Items Selection */}
        {selectedOrder && selectedOrder.items && selectedOrder.items.length > 0 && (
          <div className="space-y-4">
            <Label>{t('complaints.selectItems')} *</Label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {selectedOrder.items.map((item: OrderItem, index: number) => {
                const isSelected = formData.selectedItems.some(
                  (si) => si.sku === item.sku
                )
                const selectedItem = formData.selectedItems.find(
                  (si) => si.sku === item.sku
                )

                return (
                  <div
                    key={`${item.sku}-${index}`}
                    className={cn(
                      'border-2 rounded-lg p-4 cursor-pointer transition-all',
                      isSelected
                        ? 'border-primary bg-primary/5'
                        : 'border-gray-200 dark:border-gray-700 hover:border-primary/50'
                    )}
                    onClick={() => toggleItemSelection(item)}
                  >
                    <div className="flex items-start gap-4">
                      {item.image_url ? (
                        <img
                          src={item.image_url}
                          alt={item.product_name}
                          className="w-16 h-16 object-cover rounded"
                        />
                      ) : (
                        <div className="w-16 h-16 bg-muted rounded flex items-center justify-center">
                          <ImageIcon className="w-8 h-8 text-muted-foreground" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <p className="font-medium truncate">{item.product_name}</p>
                            <p className="text-sm text-muted-foreground font-mono">
                              {t('products.sku')}: {item.sku}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {t('orders.items')}: {item.quantity} {t('products.items')}
                            </p>
                          </div>
                          {isSelected && (
                            <CheckCircle2 className="w-5 h-5 text-primary flex-shrink-0" />
                          )}
                        </div>
                        {isSelected && selectedItem && (
                          <div className="mt-3 pt-3 border-t">
                            <Label className="text-xs">{t('general.quantity')}</Label>
                            <div className="flex items-center gap-2 mt-1">
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  updateItemQuantity(item.sku, selectedItem.quantity - 1)
                                }}
                                disabled={selectedItem.quantity <= 1}
                              >
                                -
                              </Button>
                              <Input
                                type="number"
                                min={1}
                                max={selectedItem.maxQuantity}
                                value={selectedItem.quantity}
                                onChange={(e) => {
                                  e.stopPropagation()
                                  updateItemQuantity(
                                    item.sku,
                                    parseInt(e.target.value) || 1
                                  )
                                }}
                                onClick={(e) => e.stopPropagation()}
                                className="w-20 text-center"
                              />
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  updateItemQuantity(item.sku, selectedItem.quantity + 1)
                                }}
                                disabled={selectedItem.quantity >= selectedItem.maxQuantity}
                              >
                                +
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Reason */}
        <div className="space-y-2">
          <Label htmlFor="reason">{t('complaints.reason')} *</Label>
          <Select
            value={formData.reason}
            onValueChange={(value) =>
              setFormData({ ...formData, reason: value })
            }
            required
          >
            <SelectTrigger id="reason">
              <SelectValue placeholder={t('complaints.selectReason')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="damaged_transport">
                {t('complaints.damagedTransport')}
              </SelectItem>
              <SelectItem value="wrong_product">{t('complaints.wrongProduct')}</SelectItem>
              <SelectItem value="missing_parts">{t('complaints.missingParts')}</SelectItem>
              <SelectItem value="defective">{t('complaints.defective')}</SelectItem>
              <SelectItem value="other">{t('complaints.other')}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Description */}
        <div className="space-y-2">
          <Label htmlFor="description">{t('complaints.description')}</Label>
          <Textarea
            id="description"
            value={formData.description}
            onChange={(e) =>
              setFormData({ ...formData, description: e.target.value })
            }
            placeholder={t('complaints.description') + '...'}
            rows={4}
          />
        </div>

        {/* Photo Upload */}
        <div className="space-y-2">
          <Label>{t('complaints.photosMax', { count: 5 })}</Label>
          <div
            className={cn(
              'border-2 border-dashed rounded-lg p-6 text-center transition-colors',
              dragActive
                ? 'border-primary bg-primary/5'
                : 'border-gray-200 dark:border-gray-700'
            )}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
          >
            <input
              type="file"
              id="photo-upload"
              multiple
              accept="image/*"
              onChange={(e) => handlePhotoSelect(e.target.files)}
              className="hidden"
            />
            <label htmlFor="photo-upload" className="cursor-pointer">
              <Upload className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                {t('general.dragDropPhotos')}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {t('complaints.photosCount', { count: formData.photos.length, max: 5 })}
              </p>
            </label>
          </div>

          {/* Photo Previews */}
          {photoPreviews.length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mt-4">
              {photoPreviews.map((preview, index) => (
                <div key={index} className="relative group">
                  <img
                    src={preview}
                    alt={t('complaints.photoPreview', { index: index + 1 })}
                    className="w-full h-24 object-cover rounded border"
                  />
                  <Button
                    type="button"
                    variant="destructive"
                    size="icon"
                    className="absolute top-1 right-1 w-6 h-6 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => removePhoto(index)}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Help Link */}
        <div className="pt-4 border-t">
          <p className="text-sm text-muted-foreground">
            {t('general.help')}?{' '}
            <a
              href="mailto:support@furnitrade.com"
              className="text-primary hover:underline"
            >
              {t('general.contactSupport')}
            </a>
            {' '}{t('general.or')}{' '}
            <a
              href="https://wa.me/359123456789"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              {t('general.whatsapp')}
            </a>
          </p>
        </div>

        {/* Submit Button */}
        <Button
          type="submit"
          size="lg"
          className="w-full bg-red-600 hover:bg-red-700"
          disabled={submitMutation.isPending}
        >
          {submitMutation.isPending ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              {t('complaints.submitting')}
            </>
          ) : (
            <>
              <AlertCircle className="w-4 h-4 mr-2" />
              {t('complaints.submit')}
            </>
          )}
        </Button>
      </GlassCard>
    </form>
  )
}
