import { useState } from 'react'
import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { SidebarNav } from '@/components/SidebarNav'
import { CartDrawer } from '@/components/CartDrawer'
import { OrderRequestModal } from '@/components/QuoteRequestModal'
import { LanguageSwitcher } from '@/components/LanguageSwitcher'
import { NotificationBell } from '@/components/NotificationBell'
import { useAuth } from '@/hooks/useAuth'
import { useCartStore } from '@/stores/cartStore'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet'
import {
  ShoppingCart,
  Sun,
  Moon,
  Settings,
  Building2,
  LogOut,
  Menu,
  ChevronRight,
} from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useDarkMode } from '@/hooks/useDarkMode'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase/client'
import { useTenantPath } from '@/lib/tenant/TenantProvider'
import { useAppContext } from '@/lib/app/AppContext'

// Buyers section removed — this is a single-wholesaler platform. Stores place orders directly to us.

// Page title mapping for breadcrumbs (will be translated in component)
const pageTitleKeys: Record<string, string> = {
  '/dashboard': 'nav.overview',
  '/dashboard/products': 'products.title',
  '/dashboard/orders': 'orders.title',
  '/dashboard/complaints': 'nav.complaintsReturns',
  '/dashboard/csv-import': 'nav.csvImport',
  '/dashboard/quotes': 'orders.title',
  '/dashboard/settings': 'settings.title',
  '/dashboard/analytics': 'nav.analytics',
  '/dashboard/unpaid-balances': 'orders.title',
  '/dashboard/clients': 'distributors.title',
}

export function DashboardLayout() {
  const { t } = useTranslation()
  const [cartOpen, setCartOpen] = useState(false)
  const [quoteModalOpen, setQuoteModalOpen] = useState(false)
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const { signOut } = useAuth()
  const { currentAccount, workspaceId } = useAppContext()
  const { withBase, stripBase } = useTenantPath()
  const profile = currentAccount.profile
  const isAdmin = currentAccount.isAdmin
  const userId = currentAccount.userId
  
  // Fetch real status data for badges
  const { data: statusData } = useQuery({
    queryKey: ['workspace', 'status-badges', userId, isAdmin],
    queryFn: async () => {
      if (!workspaceId) return null
      if (!isAdmin && !userId) return null

      // Fetch pending orders: Processing ('new') + Awaiting Payment ('pending')
      // These are orders that need attention
      const { count: pendingCount } = await supabase
        .from('quotes')
        .select('*', { count: 'exact', head: true })
        .in('status', ['new', 'pending'])
        .eq('tenant_id', workspaceId)

      // Fetch low stock products (quantity 1-10)
      const { count: lowStockCount } = await supabase
        .from('products')
        .select('*', { count: 'exact', head: true })
        .gt('quantity', 0)
        .lte('quantity', 10)
        .eq('tenant_id', workspaceId)

      return {
        pendingOrders: pendingCount || 0,
        lowStockItems: lowStockCount || 0,
      }
    },
    enabled: !!workspaceId && (isAdmin || !!userId),
    refetchInterval: 30000, // Refetch every 30 seconds
  })

  const { getItemCount } = useCartStore()
  const navigate = useNavigate()
  const location = useLocation()
  const { isDark, toggle: toggleTheme } = useDarkMode()

  const cartItemCount = getItemCount()

  const pendingOrders = statusData?.pendingOrders || 0
  const lowStockItems = statusData?.lowStockItems || 0

  // Get current page title for breadcrumbs
  const getPageTitle = () => {
    const path = stripBase(location.pathname)
    for (const [route, key] of Object.entries(pageTitleKeys)) {
      if (path === route || (route !== '/dashboard' && path.startsWith(route))) {
        return t(key)
      }
    }
    return t('nav.overview')
  }

  // Get user initials for avatar
  const getUserInitials = () => {
    if (profile?.full_name) {
      const names = profile.full_name.split(' ')
      if (names.length >= 2) {
        return `${names[0][0]}${names[1][0]}`.toUpperCase()
      }
      return profile.full_name.substring(0, 2).toUpperCase()
    }
    if (profile?.email) {
      return profile.email.substring(0, 2).toUpperCase()
    }
    return 'JD'
  }

  return (
    <div className="min-h-screen flex overflow-x-hidden">
      <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
        <SheetContent
          side="left"
          className="w-[86vw] max-w-[340px] p-0 border-r border-gray-200 dark:border-gray-800"
        >
          <SheetTitle className="sr-only">{t('nav.mainNavigation')}</SheetTitle>
          <SidebarNav mobile onNavigate={() => setMobileNavOpen(false)} />
        </SheetContent>
      </Sheet>
      <SidebarNav />
      <div className="flex-1 flex flex-col lg:ml-64">
        {/* Enhanced Top Header */}
        <header className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 shadow-sm">
          <div className="px-3 py-3 sm:px-4 lg:px-6 lg:py-4">
            {/* Main Navbar */}
            <div className="flex items-center justify-between gap-3">
              {/* LEFT: Breadcrumbs */}
              <div className="flex min-w-0 flex-1 items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 lg:hidden"
                  onClick={() => setMobileNavOpen(true)}
                  aria-label={t('common.landing.nav.toggleMenu')}
                >
                  <Menu className="h-5 w-5" />
                </Button>
                <div className="hidden min-w-0 items-center gap-2 sm:flex">
                  <span
                    className="cursor-pointer truncate hover:text-gray-900 dark:hover:text-gray-100"
                    onClick={() => navigate(withBase('/dashboard'))}
                  >
                    {t('header.home')}
                  </span>
                  <ChevronRight className="h-4 w-4 shrink-0" />
                  <span className="truncate text-gray-900 dark:text-gray-100 font-medium">
                    {getPageTitle()}
                  </span>
                </div>
                <span className="truncate text-sm font-medium text-gray-900 dark:text-gray-100 sm:hidden">
                  {getPageTitle()}
                </span>
              </div>

              {/* RIGHT: Actions Group */}
              <div className="flex shrink-0 items-center gap-1.5 sm:gap-2.5 lg:gap-4">
                {/* Language Switcher */}
                <LanguageSwitcher />

                {/* Vertical Divider */}
                <div className="hidden h-6 w-px bg-gray-200 dark:bg-gray-700 md:block"></div>

                {/* Theme Toggle */}
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 hover:bg-gray-100 dark:hover:bg-gray-800"
                  onClick={toggleTheme}
                >
                  {isDark ? (
                    <Sun className="h-5 w-5 transition-all" />
                  ) : (
                    <Moon className="h-5 w-5 transition-all" />
                  )}
                </Button>

                {/* Vertical Divider */}
                <div className="hidden h-6 w-px bg-gray-200 dark:bg-gray-700 md:block"></div>

                {/* Status Indicators */}
                {(pendingOrders > 0 || lowStockItems > 0) && (
                  <div className="hidden lg:flex items-center gap-2">
                    {pendingOrders > 0 && (
                      <div className="flex items-center gap-1.5 px-3 py-1 bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 rounded-full text-xs font-medium">
                        <div className="w-2 h-2 bg-amber-500 rounded-full"></div>
                        <span>{pendingOrders} {t('header.pending')}</span>
                      </div>
                    )}
                    {lowStockItems > 0 && (
                      <div className="flex items-center gap-1.5 px-3 py-1 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-full text-xs font-medium">
                        <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                        <span>{lowStockItems} {t('header.lowStock')}</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Vertical Divider (only if status indicators are shown) */}
                {(pendingOrders > 0 || lowStockItems > 0) && (
                  <div className="hidden lg:block h-6 w-px bg-gray-200 dark:bg-gray-700"></div>
                )}

                {/* Notification Bell */}
                <NotificationBell />

                {/* Vertical Divider */}
                <div className="hidden h-6 w-px bg-gray-200 dark:bg-gray-700 md:block"></div>

                {/* Cart Icon */}
                <Button
                  variant="ghost"
                  size="icon"
                  className="relative h-9 w-9 hover:bg-gray-100 dark:hover:bg-gray-800"
                  onClick={() => setCartOpen(true)}
                >
                  <ShoppingCart className="h-5 w-5" />
                  {cartItemCount > 0 && (
                    <Badge
                      variant="destructive"
                      className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs"
                    >
                      {cartItemCount > 99 ? '99+' : cartItemCount}
                    </Badge>
                  )}
                </Button>

                {/* Vertical Divider */}
                <div className="hidden h-6 w-px bg-gray-200 dark:bg-gray-700 md:block"></div>

                {/* User Profile Menu */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      className="h-9 px-2 gap-2 hover:bg-gray-100 dark:hover:bg-gray-800"
                    >
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center text-white text-sm font-medium">
                        {getUserInitials()}
                      </div>
                      <div className="hidden md:flex flex-col items-start">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-gray-900 dark:text-white">
                            {profile?.full_name || 'User'}
                          </span>
                          {isAdmin && (
                            <Badge variant="secondary" className="text-xs px-1.5 py-0">
                              {t('header.admin')}
                            </Badge>
                          )}
                        </div>
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          {profile?.email || 'user@example.com'}
                        </span>
                      </div>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    <DropdownMenuLabel>
                      <div className="flex flex-col space-y-1">
                        <p className="text-sm font-medium leading-none">
                          {profile?.full_name || 'User'}
                        </p>
                        <p className="text-xs leading-none text-muted-foreground">
                          {profile?.email || 'user@example.com'}
                        </p>
                      </div>
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={() => {
                        console.log('Account Settings clicked')
                        navigate(withBase('/dashboard/settings'))
                      }}
                      className="cursor-pointer"
                    >
                      <Settings className="mr-2 h-4 w-4" />
                      {t('header.accountSettings')}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => {
                        console.log('Company Info clicked')
                        navigate(withBase('/dashboard/settings'))
                      }}
                      className="cursor-pointer"
                    >
                      <Building2 className="mr-2 h-4 w-4" />
                      {t('header.companyInfo')}
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={() => {
                        signOut()
                      }}
                      className="cursor-pointer text-red-600 dark:text-red-400"
                    >
                      <LogOut className="mr-2 h-4 w-4" />
                      {t('nav.logout')}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 overflow-auto p-4 sm:p-5 lg:p-8 custom-scrollbar">
          <Outlet />
        </main>
      </div>

      {/* Cart Drawer */}
      <CartDrawer
        open={cartOpen}
        onOpenChange={setCartOpen}
        onRequestQuote={() => {
          setCartOpen(false)
          setQuoteModalOpen(true)
        }}
      />

      {/* Order Request Modal */}
      <OrderRequestModal
        open={quoteModalOpen}
        onClose={() => setQuoteModalOpen(false)}
        onSuccess={(orderId) => {
          setQuoteModalOpen(false)
          setCartOpen(false)
          // Redirect to orders page with new order highlight
          if (orderId) {
            navigate(`${withBase('/dashboard/orders')}?newOrder=${orderId}`)
          } else {
            navigate(withBase('/dashboard/orders'))
          }
        }}
      />
    </div>
  )
}
