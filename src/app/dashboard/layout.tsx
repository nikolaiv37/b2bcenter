import { useState } from 'react'
import { Outlet, useNavigate } from 'react-router-dom'
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
  Phone,
  LogOut,
  Menu,
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

export function DashboardLayout() {
  const { t } = useTranslation()
  const [cartOpen, setCartOpen] = useState(false)
  const [quoteModalOpen, setQuoteModalOpen] = useState(false)
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const { signOut } = useAuth()
  const { currentAccount, currentCompany, workspaceId } = useAppContext()
  const { withBase } = useTenantPath()
  const profile = currentAccount.profile
  const isAdmin = currentAccount.isAdmin
  const userId = currentAccount.userId
  
  // Fetch real status data for badges
  const { data: statusData } = useQuery({
    queryKey: ['workspace', 'status-badges', userId, isAdmin, workspaceId],
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

      return {
        pendingOrders: pendingCount || 0,
      }
    },
    enabled: !!workspaceId && (isAdmin || !!userId),
    refetchInterval: 30000, // Refetch every 30 seconds
  })

  const { getItemCount } = useCartStore()
  const navigate = useNavigate()
  const { isDark, toggle: toggleTheme } = useDarkMode()

  const cartItemCount = getItemCount()

  const pendingOrders = statusData?.pendingOrders || 0
  const accountManagerName = profile?.full_name || null
  const accountManagerPhone = profile?.phone || currentCompany?.phone || null
  const accountCompanyName = currentCompany?.name || profile?.company_name || null

  // Get user initials for avatar
  const getUserInitials = () => {
    if (accountManagerName) {
      const names = accountManagerName.split(' ')
      if (names.length >= 2) {
        return `${names[0][0]}${names[1][0]}`.toUpperCase()
      }
      return accountManagerName.substring(0, 2).toUpperCase()
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
          <div className="px-3 py-2 sm:px-4 lg:px-6 lg:py-2.5">
            {/* Main Navbar */}
            <div className="flex items-center justify-between gap-3">
              {/* LEFT: Navigation anchor */}
              <div className="flex min-w-0 flex-1 items-center gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 lg:hidden"
                  onClick={() => setMobileNavOpen(true)}
                  aria-label={t('common.landing.nav.toggleMenu')}
                >
                  <Menu className="h-5 w-5" />
                </Button>
              </div>

              {/* RIGHT: Actions Group */}
              <div className="flex shrink-0 items-center gap-1.5 sm:gap-2 lg:gap-3">
                {/* Language Switcher */}
                <div className="hidden md:block">
                  <LanguageSwitcher />
                </div>

                {/* Vertical Divider */}
                <div className="hidden h-6 w-px bg-gray-200 dark:bg-gray-700 md:block"></div>

                {/* Theme Toggle */}
                <div className="hidden md:block">
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
                </div>

                {/* Vertical Divider */}
                <div className="hidden h-6 w-px bg-gray-200 dark:bg-gray-700 md:block"></div>

                {/* Status Indicators */}
                {pendingOrders > 0 && (
                  <div className="hidden lg:flex items-center gap-2">
                    <div className="flex items-center gap-1.5 px-3 py-1 bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 rounded-full text-xs font-medium">
                      <div className="w-2 h-2 bg-amber-500 rounded-full"></div>
                      <span>{pendingOrders} {t('header.pending')}</span>
                    </div>
                  </div>
                )}

                {/* Vertical Divider (only if status indicators are shown) */}
                {pendingOrders > 0 && (
                  <div className="hidden lg:block h-6 w-px bg-gray-200 dark:bg-gray-700"></div>
                )}

                {/* Notification Bell */}
                <div className="order-2 md:order-none">
                  <NotificationBell />
                </div>

                {/* Vertical Divider */}
                <div className="hidden h-6 w-px bg-gray-200 dark:bg-gray-700 md:block"></div>

                {/* Cart Icon */}
                <div className="order-3 md:order-none">
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
                </div>

                {/* Vertical Divider */}
                <div className="hidden h-6 w-px bg-gray-200 dark:bg-gray-700 md:block"></div>

                {/* User Profile Menu */}
                <div className="order-1 md:order-none">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        className="h-auto rounded-2xl px-2 py-1.5 hover:bg-slate-100/90 dark:hover:bg-slate-800/80 sm:px-2.5"
                      >
                        <div className="flex items-center gap-2.5 sm:gap-3">
                        <div className="order-2 min-w-0 flex-1 md:order-none">
                          <div className="flex items-center justify-start md:hidden">
                            <div className="min-w-0 text-left">
                              <div className="truncate text-[13px] font-semibold leading-tight text-slate-900 dark:text-white">
                                {accountManagerName || 'User'}
                              </div>
                              {accountManagerPhone && (
                                <div className="mt-0.5 inline-flex max-w-full items-center justify-start gap-1 text-[11px] font-medium leading-tight text-slate-500 dark:text-slate-400">
                                  <Phone className="h-3 w-3 shrink-0 text-slate-400 dark:text-slate-500" />
                                  <span className="truncate">{accountManagerPhone}</span>
                                </div>
                              )}
                            </div>
                          </div>
                          <div className="hidden min-w-0 md:flex items-center justify-end gap-4 lg:gap-5">
                            <div className="min-w-0 flex flex-col items-end gap-1 text-right">
                              {accountManagerPhone && (
                                <span className="inline-flex min-w-0 items-center gap-1.5 whitespace-nowrap text-[12px] font-medium leading-none text-slate-600 dark:text-slate-300">
                                  <Phone className="h-3.5 w-3.5 shrink-0 text-slate-400 dark:text-slate-500" />
                                  <span className="truncate">{accountManagerPhone}</span>
                                </span>
                              )}
                              {accountCompanyName && (
                                <span className="inline-flex min-w-0 max-w-[220px] items-center gap-1.5 truncate text-[12px] font-medium leading-none text-slate-600 dark:text-slate-300 xl:max-w-[260px]">
                                  <Building2 className="h-3.5 w-3.5 shrink-0 text-slate-400 dark:text-slate-500" />
                                  <span className="truncate">{accountCompanyName}</span>
                                </span>
                              )}
                            </div>
                            <div className="min-w-0 flex flex-col items-end gap-1 text-right">
                              <span className="max-w-[230px] truncate text-[15px] font-semibold tracking-tight text-slate-900 dark:text-white xl:max-w-[280px]">
                                {accountManagerName || 'User'}
                              </span>
                              {isAdmin && (
                                <Badge
                                  variant="secondary"
                                  className="rounded-full border border-slate-200 bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                                >
                                  {t('header.admin')}
                                </Badge>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="order-1 md:order-none h-10 w-10 rounded-full overflow-hidden bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center text-white text-sm font-medium shrink-0 ring-2 ring-white shadow-sm dark:ring-slate-900">
                          {profile?.avatar_url ? (
                            <img
                              src={profile.avatar_url}
                              alt={profile?.full_name || t('settings.avatarAlt')}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            getUserInitials()
                          )}
                        </div>
                        </div>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-56">
                      <DropdownMenuLabel>
                        <div className="flex flex-col space-y-1">
                          <p className="text-sm font-medium leading-none">
                            {accountManagerName || profile?.full_name || 'User'}
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
