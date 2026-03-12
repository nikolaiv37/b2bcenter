import { useState } from 'react'
import { Link, Outlet, useLocation } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { Building2, LogOut, LayoutDashboard, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/hooks/useAuth'

const navItems = [
  { title: 'Tenants', href: '/platform/tenants', icon: Building2 },
]

export function PlatformLayout() {
  const location = useLocation()
  const { signOut } = useAuth()
  const [signingOut, setSigningOut] = useState(false)

  const handleSignOut = async () => {
    setSigningOut(true)
    await signOut('/auth/login')
  }

  return (
    <div className="min-h-screen flex">
      <aside className="w-64 hidden lg:flex flex-col h-screen fixed left-0 top-0 z-40 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <Link to="/platform/tenants" className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-violet-600 to-violet-800 rounded-lg flex items-center justify-center shadow-md">
              <LayoutDashboard className="w-5 h-5 text-white" />
            </div>
            <div className="flex flex-col">
              <h2 className="font-bold text-base text-gray-900 dark:text-white">Centivon</h2>
              <span className="text-xs text-gray-500 dark:text-gray-400">Platform Console</span>
            </div>
          </Link>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          <nav className="space-y-1">
            {navItems.map((item) => {
              const isActive = location.pathname.startsWith(item.href)
              return (
                <Link
                  key={item.href}
                  to={item.href}
                  className={cn(
                    'flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-150',
                    isActive
                      ? 'bg-violet-600 text-white font-semibold'
                      : 'hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300'
                  )}
                >
                  <item.icon className="w-5 h-5" />
                  <span className="font-medium text-sm">{item.title}</span>
                </Link>
              )
            })}
          </nav>
        </div>

        <div className="p-4 border-t border-gray-200 dark:border-gray-700">
          <Button
            variant="ghost"
            className="w-full justify-start text-gray-700 dark:text-gray-300"
            onClick={handleSignOut}
            disabled={signingOut}
          >
            {signingOut ? (
              <Loader2 className="w-5 h-5 mr-3 animate-spin" />
            ) : (
              <LogOut className="w-5 h-5 mr-3" />
            )}
            <span className="text-sm">Sign out</span>
          </Button>
        </div>
      </aside>

      <div className="flex-1 lg:ml-64">
        <main className="p-6 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
