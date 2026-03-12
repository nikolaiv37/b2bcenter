import { useState, useEffect } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard,
  Package,
  FileText,
  Settings,
  LogOut,
  Building2,
  User,
  ChevronDown,
  Heart,
  BarChart3,
  AlertCircle,
  Grid3X3,
  FileSpreadsheet,
  FolderKanban,
  Users,
} from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useWishlist } from '@/hooks/useWishlist'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { useTenantPath } from '@/lib/tenant/TenantProvider'

// Buyers section removed — this is a single-wholesaler platform. Stores place orders directly to us.

// Navigation items structure (titles will be translated in component)
const mainNavItemsConfig = [
  {
    titleKey: 'nav.overview',
    href: '/dashboard',
    icon: LayoutDashboard,
  },
  {
    titleKey: 'nav.orders',
    href: '/dashboard/orders',
    icon: FileText,
    badge: 0, // TODO: Calculate from orders with awaiting_payment status
  },
  // Admin-only: Clients (Distributors), shown under Orders in main navigation
  {
    titleKey: 'nav.distributors',
    href: '/dashboard/clients',
    icon: Users,
    adminOnly: true,
  },
  {
    titleKey: 'nav.complaintsReturns',
    href: '/dashboard/complaints',
    icon: AlertCircle,
  },
  {
    titleKey: 'nav.analytics',
    href: '/dashboard/analytics',
    icon: BarChart3,
  },
]

const catalogSubmenuItemsConfig = [
  {
    titleKey: 'nav.categories',
    href: '/dashboard/categories',
    icon: Grid3X3,
  },
  {
    titleKey: 'nav.manageCategories',
    href: '/dashboard/categories/manage',
    icon: FolderKanban,
    adminOnly: true,
  },
  {
    titleKey: 'nav.allProducts',
    href: '/dashboard/products',
    icon: Package,
  },
  {
    titleKey: 'nav.wishlist',
    href: '/dashboard/wishlist',
    icon: Heart,
  },
]

const settingsSubmenuItemsConfig = [
      {
        titleKey: 'nav.company',
        href: '/dashboard/settings#company',
        icon: Building2,
      },
  {
    titleKey: 'nav.profile',
    href: '/dashboard/settings#profile',
    icon: User,
  },
]

interface SidebarNavProps {
  mobile?: boolean
  onNavigate?: () => void
}

export function SidebarNav({ mobile = false, onNavigate }: SidebarNavProps) {
  const { t } = useTranslation()
  const location = useLocation()
  const navigate = useNavigate()
  const { withBase, stripBase } = useTenantPath()
  const { company, isAdmin, signOut } = useAuth()
  const { count: wishlistCount } = useWishlist()
  const logicalPath = stripBase(location.pathname)
  // Default to open on page load
  const [settingsOpen, setSettingsOpen] = useState<string>('settings')
  const [catalogOpen, setCatalogOpen] = useState<string>('catalog')

  // Translate navigation items
  const mainNavItems = mainNavItemsConfig
    .filter((item) => !(item as { adminOnly?: boolean }).adminOnly || isAdmin)
    .map((item) => ({
      ...item,
      title: t(item.titleKey),
    }))
  const catalogSubmenuItems = catalogSubmenuItemsConfig
    .map(item => ({
      ...item,
      title: t(item.titleKey),
    }))
  const settingsSubmenuItems = settingsSubmenuItemsConfig.map(item => ({
    ...item,
    title: t(item.titleKey),
  }))

  // Check if item is active
  const isItemActive = (href: string) => {
    if (href === '/dashboard') {
      return logicalPath === href
    }
    return logicalPath.startsWith(href)
  }

  // Check if submenu item is active
  const isSubmenuItemActive = (href: string) => {
    // Handle hash-based settings sections
    if (href.includes('#')) {
      const [path, hash] = href.split('#')
      if (!hash) return logicalPath === path
      return logicalPath === path && location.hash === `#${hash}`
    }
    return logicalPath === href
  }

  // Check if Catalog or any submenu is active
  const isCatalogActive = () => {
    return (
      logicalPath === '/dashboard/products' ||
      logicalPath === '/dashboard/wishlist' ||
      catalogSubmenuItems.some((item) => isSubmenuItemActive(item.href))
    )
  }

  // Check if Settings or any submenu is active
  const isSettingsActive = () => {
    return (
      logicalPath === '/dashboard/settings' ||
      settingsSubmenuItems.some((item) => isSubmenuItemActive(item.href))
    )
  }

  // Auto-open Catalog submenu if on catalog page or any submenu, or use saved state
  useEffect(() => {
    const active = isCatalogActive()
    if (active) {
      setCatalogOpen('catalog')
      return
    }
    // Check localStorage, default to open if not set
    const savedState = localStorage.getItem('sidebar-catalog-open')
    if (savedState === null) {
      // First time - default to open
      setCatalogOpen('catalog')
      localStorage.setItem('sidebar-catalog-open', 'true')
    } else if (savedState === 'true') {
      setCatalogOpen('catalog')
    } else {
      setCatalogOpen('')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname, location.search, logicalPath])

  // Auto-open Settings submenu if on settings page or any submenu, or use saved state
  useEffect(() => {
    const active = isSettingsActive()
    if (active) {
      setSettingsOpen('settings')
      return
    }
    // Check localStorage, default to open if not set
    const savedState = localStorage.getItem('sidebar-settings-open')
    if (savedState === null) {
      // First time - default to open
      setSettingsOpen('settings')
      localStorage.setItem('sidebar-settings-open', 'true')
    } else if (savedState === 'true') {
      setSettingsOpen('settings')
    } else {
      setSettingsOpen('')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname, location.search, logicalPath])

  // Save catalog submenu state to localStorage
  const handleCatalogToggle = (value: string) => {
    setCatalogOpen(value)
    localStorage.setItem('sidebar-catalog-open', value === 'catalog' ? 'true' : 'false')
  }

  // Save settings submenu state to localStorage
  const handleSettingsToggle = (value: string) => {
    setSettingsOpen(value)
    localStorage.setItem('sidebar-settings-open', value === 'settings' ? 'true' : 'false')
  }

  const handleItemNavigate = () => {
    onNavigate?.()
  }

  return (
    <aside
      className={cn(
        'flex flex-col',
        mobile
          ? 'h-full w-full bg-white dark:bg-gray-900'
          : 'glass-sidebar w-64 hidden lg:flex h-screen fixed left-0 top-0 z-40'
      )}
    >
      {/* Top Section: Company Branding */}
      <div className="p-6 border-b border-gray-200 dark:border-gray-700">
        <Link
          to={withBase('/dashboard')}
          className="flex items-center gap-3 group cursor-pointer"
          onClick={handleItemNavigate}
        >
          {/* Company Logo */}
          <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-blue-800 rounded-lg flex items-center justify-center shadow-md flex-shrink-0 group-hover:scale-105 transition-transform">
            {company?.logo_url ? (
              <img
                src={company.logo_url}
                alt={company.name}
                className="w-full h-full rounded-lg object-cover"
              />
            ) : (
              <span className="text-white font-bold text-lg">
                {company?.name?.charAt(0) || 'D'}
              </span>
            )}
          </div>
          <div className="flex flex-col min-w-0">
            <h2 className="font-bold text-base text-gray-900 dark:text-white truncate">
              {company?.name || 'FurniTrade'}
            </h2>
          </div>
        </Link>
      </div>

      {/* Navigation Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {/* Main Navigation Section */}
        <div>
          <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider px-3 py-2 mb-2">
            {t('nav.mainNavigation')}
          </h3>
          <nav className="space-y-1">
            {mainNavItems.map((item) => {
              const isActive = isItemActive(item.href)

              return (
                <Link
                  key={item.href}
                  to={withBase(item.href)}
                  onClick={handleItemNavigate}
                  className={cn(
                    'flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-150',
                    isActive
                      ? 'bg-[#0f172a] dark:bg-[#0f172a] text-white font-semibold hover:bg-[#1e293b] dark:hover:bg-[#1e293b]'
                      : 'hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300'
                  )}
                >
                  <item.icon className="w-5 h-5 flex-shrink-0" />
                  <span className="font-medium flex-1 text-xs uppercase tracking-wide">{item.title}</span>
                  {item.badge !== undefined && item.badge > 0 && (
                    <Badge
                      variant="destructive"
                      className="h-5 w-5 flex items-center justify-center p-0 text-xs"
                    >
                      {item.badge}
                    </Badge>
                  )}
                </Link>
              )
            })}

            {/* Catalog with Submenu */}
            <Accordion
              type="single"
              collapsible
              value={catalogOpen}
              onValueChange={handleCatalogToggle}
              className="w-full"
            >
              <AccordionItem value="catalog" className="border-0">
                <AccordionTrigger className="hidden" />
                <div 
                  className={cn(
                    'flex items-center rounded-lg transition-all duration-150',
                    isCatalogActive()
                      ? 'bg-[#0f172a] dark:bg-[#0f172a]'
                      : ''
                  )}
                >
                  <div
                    className={cn(
                      'flex items-center gap-3 px-3 py-2.5 transition-all duration-150 flex-1 cursor-pointer rounded-l-lg',
                      isCatalogActive()
                        ? 'text-white font-semibold hover:bg-[#1e293b] dark:hover:bg-[#1e293b]'
                        : 'hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300'
                    )}
                    onClick={() => {
                      if (logicalPath !== '/dashboard/products' && logicalPath !== '/dashboard/wishlist') {
                        navigate(withBase('/dashboard/products'))
                        handleItemNavigate()
                      }
                      handleCatalogToggle(catalogOpen === 'catalog' ? '' : 'catalog')
                    }}
                  >
                    <Package className={cn(
                      'w-5 h-5 flex-shrink-0',
                      isCatalogActive() ? 'text-white' : 'text-gray-700 dark:text-gray-300'
                    )} />
                    <span className="font-medium flex-1 text-xs uppercase tracking-wide">{t('nav.catalog')}</span>
                  </div>
                  <button
                    type="button"
                    className={cn(
                      'p-2 rounded-r-lg transition-all duration-150 flex items-center justify-center relative z-10',
                      isCatalogActive()
                        ? 'hover:bg-[#1e293b] dark:hover:bg-[#1e293b]'
                        : 'hover:bg-gray-100 dark:hover:bg-gray-800'
                    )}
                    onClick={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      handleCatalogToggle(catalogOpen === 'catalog' ? '' : 'catalog')
                    }}
                    aria-label={t('nav.toggleCatalogMenu')}
                    style={{
                      minWidth: '32px',
                      minHeight: '32px'
                    }}
                  >
                    <ChevronDown 
                      className={cn(
                        'h-4 w-4 shrink-0 transition-transform duration-200',
                        catalogOpen === 'catalog' && 'rotate-180',
                        isCatalogActive() ? 'text-white' : 'text-gray-800 dark:text-gray-300'
                      )}
                      style={{
                        opacity: 1,
                        visibility: 'visible',
                        display: 'block',
                        pointerEvents: 'none',
                        stroke: isCatalogActive() ? '#ffffff' : '#1f2937',
                        strokeWidth: isCatalogActive() ? 3.5 : 2.5,
                        fill: 'none',
                        filter: isCatalogActive() ? 'drop-shadow(0 1px 2px rgba(0,0,0,0.5))' : 'none'
                      }}
                    />
                  </button>
                </div>
                <AccordionContent className="pt-1">
                  <div className="space-y-1 pl-6">
                    {catalogSubmenuItems.map((subItem) => {
                      if ((subItem as { adminOnly?: boolean }).adminOnly && !isAdmin) {
                        return null
                      }
                      const isSubActive = isSubmenuItemActive(subItem.href)
                      const isWishlist = subItem.href === '/dashboard/wishlist'
                      return (
                        <Link
                          key={subItem.href}
                          to={
                            subItem.href.includes('#')
                              ? `${withBase(subItem.href.split('#')[0])}#${subItem.href.split('#')[1]}`
                              : withBase(subItem.href)
                          }
                          onClick={handleItemNavigate}
                          className={cn(
                            'flex items-center gap-2 px-3 py-2 rounded-lg text-xs transition-colors duration-150',
                            isSubActive
                              ? 'bg-[#0f172a]/10 dark:bg-[#0f172a]/20 text-[#0f172a] dark:text-white font-semibold'
                              : 'text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100'
                          )}
                        >
                          <subItem.icon className={cn(
                            'w-4 h-4',
                            isWishlist && wishlistCount > 0 && 'text-red-500 fill-red-500'
                          )} />
                          <span className="text-xs uppercase tracking-wide">{subItem.title}</span>
                          {isWishlist && wishlistCount > 0 && (
                            <Badge
                              variant="destructive"
                              className="ml-auto h-5 min-w-5 flex items-center justify-center px-1.5 text-xs"
                            >
                              {wishlistCount > 99 ? '99+' : wishlistCount}
                            </Badge>
                          )}
                        </Link>
                      )
                    })}
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </nav>
        </div>

        {/* Divider */}
        <div className="border-t border-gray-200 dark:border-gray-700"></div>

        {/* Tools & Account Section */}
        <div>
          <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider px-3 py-2 mb-2">
            {t('nav.toolsAndAccount')}
          </h3>
          <nav className="space-y-1">
            {/* CSV Import Wizard - promoted as top-level item */}
            {isAdmin && (
              <Link
                to={withBase('/dashboard/csv-import')}
                onClick={handleItemNavigate}
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-150',
                  isItemActive('/dashboard/csv-import')
                    ? 'bg-[#0f172a] dark:bg-[#0f172a] text-white font-semibold hover:bg-[#1e293b] dark:hover:bg-[#1e293b]'
                    : 'hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300'
                )}
              >
                <FileSpreadsheet className="w-5 h-5 flex-shrink-0" />
                <span className="font-medium flex-1 text-xs uppercase tracking-wide">{t('nav.csvImport')}</span>
              </Link>
            )}

            {/* Settings with Submenu */}
            <Accordion
              type="single"
              collapsible
              value={settingsOpen}
              onValueChange={handleSettingsToggle}
              className="w-full"
            >
              <AccordionItem value="settings" className="border-0">
                {/* Hidden AccordionTrigger for Radix to work properly */}
                <AccordionTrigger className="hidden" />
                <div 
                  className={cn(
                    'flex items-center rounded-lg transition-all duration-150',
                    isSettingsActive()
                      ? 'bg-[#0f172a] dark:bg-[#0f172a]'
                      : ''
                  )}
                >
                  {/* Settings Icon and Text - Clickable */}
                  <div
                    className={cn(
                      'flex items-center gap-3 px-3 py-2.5 transition-all duration-150 flex-1 cursor-pointer rounded-l-lg',
                      isSettingsActive()
                        ? 'text-white font-semibold hover:bg-[#1e293b] dark:hover:bg-[#1e293b]'
                        : 'hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300'
                    )}
                    onClick={() => {
                      // Navigate to settings if not already there
                      if (logicalPath !== '/dashboard/settings') {
                        navigate(withBase('/dashboard/settings'))
                        handleItemNavigate()
                      }
                      // Toggle accordion
                      handleSettingsToggle(settingsOpen === 'settings' ? '' : 'settings')
                    }}
                  >
                    <Settings className={cn(
                      'w-5 h-5 flex-shrink-0',
                      isSettingsActive() ? 'text-white' : 'text-gray-700 dark:text-gray-300'
                    )} />
                    <span className="font-medium flex-1 text-xs uppercase tracking-wide">{t('nav.settings')}</span>
                  </div>
                  {/* Custom chevron button - always visible, good looking, and rotates */}
                  <button
                    type="button"
                    className={cn(
                      'p-2 rounded-r-lg transition-all duration-150 flex items-center justify-center relative z-10',
                      isSettingsActive()
                        ? 'hover:bg-[#1e293b] dark:hover:bg-[#1e293b]'
                        : 'hover:bg-gray-100 dark:hover:bg-gray-800'
                    )}
                    onClick={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      handleSettingsToggle(settingsOpen === 'settings' ? '' : 'settings')
                    }}
                    aria-label={t('nav.toggleSettingsMenu')}
                    style={{
                      minWidth: '32px',
                      minHeight: '32px'
                    }}
                  >
                    <ChevronDown 
                      className={cn(
                        'h-4 w-4 shrink-0 transition-transform duration-200',
                        settingsOpen === 'settings' && 'rotate-180',
                        // Force color classes
                        isSettingsActive() ? 'text-white' : 'text-gray-800 dark:text-gray-300'
                      )}
                      style={{
                        opacity: 1,
                        visibility: 'visible',
                        display: 'block',
                        pointerEvents: 'none',
                        stroke: isSettingsActive() ? '#ffffff' : '#1f2937',
                        strokeWidth: isSettingsActive() ? 3.5 : 2.5,
                        fill: 'none',
                        filter: isSettingsActive() ? 'drop-shadow(0 1px 2px rgba(0,0,0,0.5))' : 'none'
                      }}
                    />
                  </button>
                </div>
                <AccordionContent className="pt-1">
                  <div className="space-y-1 pl-6">
                    {settingsSubmenuItems
                      .filter((subItem) => {
                        // Hide CSV Import unless user is admin
                        if (subItem.href === '/dashboard/csv-import' && !isAdmin) {
                          return false
                        }
                        return true
                      })
                      .map((subItem) => {
                        const isSubActive = isSubmenuItemActive(subItem.href)
                        return (
                          <Link
                            key={subItem.href}
                            to={
                              subItem.href.includes('#')
                                ? `${withBase(subItem.href.split('#')[0])}#${subItem.href.split('#')[1]}`
                                : withBase(subItem.href)
                            }
                            onClick={handleItemNavigate}
                            className={cn(
                              'flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors duration-150',
                              isSubActive
                                ? 'bg-[#0f172a]/10 dark:bg-[#0f172a]/20 text-[#0f172a] dark:text-white font-semibold'
                                : 'text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100'
                            )}
                          >
                            <subItem.icon className="w-4 h-4" />
                            <span className="text-xs uppercase tracking-wide">{subItem.title}</span>
                          </Link>
                        )
                      })}
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>

            {/* Logout */}
            <Button
              variant="ghost"
              className="w-full justify-start px-3 py-2.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300 transition-colors duration-150"
              onClick={() => {
                handleItemNavigate()
                signOut()
              }}
            >
              <LogOut className="w-5 h-5 mr-3" />
              <span className="font-medium text-xs uppercase tracking-wide">{t('nav.logout')}</span>
            </Button>
          </nav>
        </div>
      </div>
    </aside>
  )
}
