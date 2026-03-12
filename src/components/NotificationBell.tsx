import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { formatDistanceToNow } from 'date-fns'
import { Bell, ShoppingCart, AlertTriangle, UserPlus, Percent, Package, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useNotifications } from '@/hooks/useNotifications'
import { useTenantPath } from '@/lib/tenant/TenantProvider'
import type { AppNotification, NotificationType } from '@/types'

// Icon + color mapping per notification type
const typeConfig: Record<NotificationType, { icon: typeof Bell; color: string }> = {
  order_created: { icon: ShoppingCart, color: 'text-blue-500' },
  order_status_changed: { icon: Package, color: 'text-amber-500' },
  complaint_created: { icon: AlertTriangle, color: 'text-red-500' },
  complaint_status_changed: { icon: AlertTriangle, color: 'text-orange-500' },
  client_registered: { icon: UserPlus, color: 'text-green-500' },
  commission_changed: { icon: Percent, color: 'text-purple-500' },
  catalog_updated: { icon: Package, color: 'text-teal-500' },
}

// Map notification to its target dashboard route
function getEntityRoute(n: AppNotification): string | null {
  switch (n.type) {
    case 'order_created':
    case 'order_status_changed':
      return '/dashboard/orders'
    case 'complaint_created':
    case 'complaint_status_changed':
      return '/dashboard/complaints'
    case 'client_registered':
      return '/dashboard/clients'
    case 'commission_changed':
      return '/dashboard/products'
    case 'catalog_updated':
      return '/dashboard/products'
    default:
      return null
  }
}

function NotificationItem({
  notification,
  onRead,
  onNavigate,
}: {
  notification: AppNotification
  onRead: (id: string) => void
  onNavigate: (path: string) => void
}) {
  const { t } = useTranslation()
  const isUnread = !notification.read_at

  const config = typeConfig[notification.type] ?? { icon: Bell, color: 'text-gray-500' }
  const Icon = config.icon

  const message = t(`notifications.${notification.type}`, {
    ...notification.metadata,
    defaultValue: notification.type,
  })

  const timeAgo = formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })

  const handleClick = () => {
    if (isUnread) {
      onRead(notification.id)
    }
    const route = getEntityRoute(notification)
    if (route) {
      onNavigate(route)
    }
  }

  return (
    <button
      onClick={handleClick}
      className={`w-full flex items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/50 ${
        isUnread ? 'bg-blue-50/50 dark:bg-blue-950/20' : ''
      }`}
    >
      <div className={`mt-0.5 flex-shrink-0 ${config.color}`}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="flex-1 min-w-0">
        <p className={`text-sm leading-snug ${isUnread ? 'font-medium text-gray-900 dark:text-white' : 'text-gray-600 dark:text-gray-400'}`}>
          {message}
        </p>
        <p className="text-xs text-gray-500 dark:text-gray-500 mt-0.5">
          {timeAgo}
        </p>
      </div>
      {isUnread && (
        <div className="mt-2 flex-shrink-0">
          <div className="h-2 w-2 rounded-full bg-blue-500" />
        </div>
      )}
    </button>
  )
}

export function NotificationBell() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { withBase } = useTenantPath()
  const [open, setOpen] = useState(false)

  const {
    notifications,
    unreadCount,
    isLoading,
    markAsRead,
    markAllAsRead,
    isMarkingAllRead,
  } = useNotifications()

  const handleNavigate = (path: string) => {
    setOpen(false)
    navigate(withBase(path))
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative h-9 w-9 hover:bg-gray-100 dark:hover:bg-gray-800"
        >
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge
              variant="destructive"
              className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs"
            >
              {unreadCount > 99 ? '99+' : unreadCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>

      <PopoverContent
        align="end"
        className="w-80 p-0 shadow-lg"
        sideOffset={8}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
            {t('notifications.title', 'Notifications')}
          </h3>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-auto px-2 py-1 text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
              onClick={() => markAllAsRead()}
              disabled={isMarkingAllRead}
            >
              <Check className="h-3 w-3 mr-1" />
              {t('notifications.markAllRead', 'Mark all read')}
            </Button>
          )}
        </div>

        {/* Notification list */}
        <ScrollArea className="max-h-[360px]">
          {isLoading ? (
            <div className="px-4 py-8 text-center text-sm text-gray-500 dark:text-gray-400">
              ...
            </div>
          ) : notifications.length === 0 ? (
            <div className="px-4 py-8 text-center">
              <Bell className="h-8 w-8 mx-auto text-gray-300 dark:text-gray-600 mb-2" />
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {t('notifications.empty', 'No notifications yet')}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100 dark:divide-gray-800">
              {notifications.map((n) => (
                <NotificationItem
                  key={n.id}
                  notification={n}
                  onRead={markAsRead}
                  onNavigate={handleNavigate}
                />
              ))}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  )
}
