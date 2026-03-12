import { lazy, Suspense } from 'react'
import { SpeedInsights } from '@vercel/speed-insights/react'
import { BrowserRouter, Routes, Route, Outlet, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { HelmetProvider } from 'react-helmet-async'
import { ErrorBoundary } from 'react-error-boundary'
import { Toaster } from '@/components/ui/toaster'
import { ErrorFallback } from '@/components/ErrorFallback'
import { AuthGuard } from '@/components/AuthGuard'
import { TenantProvider } from '@/lib/tenant/TenantProvider'
import { TenantBootstrapGate } from '@/components/guards/TenantBootstrapGate'
import { DomainGuardMainOnly } from '@/components/guards/DomainGuardMainOnly'
import { DomainGuardTenantOnly } from '@/components/guards/DomainGuardTenantOnly'
import { TenantActiveGuard } from '@/components/guards/TenantActiveGuard'
import { MembershipGuard } from '@/components/guards/MembershipGuard'
import { SignupGuard } from '@/components/guards/SignupGuard'
import { SlugOnlyGuard } from '@/components/guards/SlugOnlyGuard'
import { PlatformAdminGuard } from '@/components/guards/PlatformAdminGuard'
import { useTenant } from '@/lib/tenant/TenantProvider'

// Auth Pages
const LoginPage = lazy(() => import('@/app/auth/login').then(m => ({ default: m.LoginPage })))
const PlatformLoginPage = lazy(() => import('@/app/auth/platform-login').then(m => ({ default: m.PlatformLoginPage })))
const SignupPage = lazy(() => import('@/app/auth/signup').then(m => ({ default: m.SignupPage })))
const OnboardingPage = lazy(() => import('@/app/auth/onboarding').then(m => ({ default: m.OnboardingPage })))
const AcceptInvitePage = lazy(() => import('@/app/auth/accept-invite').then(m => ({ default: m.AcceptInvitePage })))
const ClientSetupPage = lazy(() => import('@/app/auth/client-setup').then(m => ({ default: m.ClientSetupPage })))
const OwnerSetupPage = lazy(() => import('@/app/auth/owner-setup').then(m => ({ default: m.OwnerSetupPage })))

// Dashboard Pages
const DashboardLayout = lazy(() => import('@/app/dashboard/layout').then(m => ({ default: m.DashboardLayout })))
const DashboardOverview = lazy(() => import('@/app/dashboard/overview').then(m => ({ default: m.DashboardOverview })))
const ProductsPage = lazy(() => import('@/app/dashboard/products').then(m => ({ default: m.ProductsPage })))
const ProductDetailPage = lazy(() => import('@/app/dashboard/products/[sku]/page').then(m => ({ default: m.ProductDetailPage })))
const WishlistPage = lazy(() => import('@/app/dashboard/wishlist').then(m => ({ default: m.WishlistPage })))
const OrdersPage = lazy(() => import('@/app/dashboard/orders').then(m => ({ default: m.OrdersPage })))
const QuotesPage = lazy(() => import('@/app/dashboard/quotes').then(m => ({ default: m.QuotesPage })))
// Buyers section removed — this is a single-wholesaler platform. Stores place orders directly to us.
const CSVImportPage = lazy(() => import('@/app/dashboard/csv-import').then(m => ({ default: m.CSVImportPage })))
const SettingsPage = lazy(() => import('@/app/dashboard/settings').then(m => ({ default: m.SettingsPage })))
const AnalyticsPage = lazy(() => import('@/app/dashboard/analytics').then(m => ({ default: m.AnalyticsPage })))
const ComplaintsPage = lazy(() => import('@/app/dashboard/complaints').then(m => ({ default: m.ComplaintsPage })))
const UnpaidBalancesPage = lazy(() => import('@/app/dashboard/unpaid-balances').then(m => ({ default: m.UnpaidBalancesPage })))
const CategoriesPage = lazy(() => import('@/app/dashboard/categories').then(m => ({ default: m.CategoriesPage })))
const ManageCategoriesPage = lazy(() => import('@/app/dashboard/categories/manage').then(m => ({ default: m.ManageCategoriesPage })))
const ClientsPage = lazy(() => import('@/app/dashboard/clients').then(m => ({ default: m.ClientsPage })))

// Platform Console Pages
const PlatformLayout = lazy(() => import('@/app/platform/layout').then(m => ({ default: m.PlatformLayout })))
const PlatformTenantsPage = lazy(() => import('@/app/platform/tenants').then(m => ({ default: m.PlatformTenantsPage })))
const PlatformTenantDetailPage = lazy(() => import('@/app/platform/tenants/[id]').then(m => ({ default: m.PlatformTenantDetailPage })))

const LandingPage = lazy(() => import('@/pages/LandingPage'))
const NotFound = lazy(() => import('@/pages/NotFound').then(m => ({ default: m.NotFound })))
const TenantEntry = lazy(() => import('@/pages/TenantEntry').then(m => ({ default: m.TenantEntry })))
const MainIndexRoute = lazy(() => import('@/pages/MainIndexRoute').then(m => ({ default: m.MainIndexRoute })))
const PortalNotFound = lazy(() => import('@/pages/PortalNotFound').then(m => ({ default: m.PortalNotFound })))
import { PageLoader } from '@/components/PageLoader'

function RootRoute() {
  const { domainKind, tenant } = useTenant()

  // Supabase sometimes lands on "/" with an auth hash when processing invite links
  // (especially on expired/invalid OTP links, or if the redirect path is stripped).
  // Forward these to the invite handler page so users see the correct recovery UI
  // instead of the generic app host state ("No tenant linked").
  if (domainKind === 'app' && !tenant) {
    const hash = window.location.hash
    if (hash) {
      const hashParams = new URLSearchParams(hash.replace(/^#/, ''))
      const hashType = hashParams.get('type')
      const hashErrorCode = hashParams.get('error_code')
      const isInviteHash = hashType === 'invite' || hashErrorCode === 'otp_expired'

      if (isInviteHash) {
        return (
          <Navigate
            to={`/auth/accept-invite${window.location.search}${window.location.hash}`}
            replace
          />
        )
      }
    }
  }

  if (domainKind === 'tenant' && tenant) {
    return (
      <Suspense fallback={<PageLoader />}>
        <TenantEntry />
      </Suspense>
    )
  }

  // Marketing host — show landing page directly, no auth/tenant logic
  if (domainKind === 'marketing') {
    return (
      <Suspense fallback={<PageLoader />}>
        <LandingPage />
      </Suspense>
    )
  }

  // App host — workspace discovery / login
  if (domainKind === 'app') {
    return (
      <Suspense fallback={<PageLoader />}>
        <MainIndexRoute />
      </Suspense>
    )
  }

  return (
    <Suspense fallback={<PageLoader />}>
      <PortalNotFound />
    </Suspense>
  )
}

/**
 * Domain-aware login router.
 * Platform host (domainKind === 'app', no tenant context) → PlatformLoginPage
 * Tenant hosts + /t/:slug routes → original LoginPage (unchanged)
 */
function LoginRouter() {
  const { domainKind, tenant } = useTenant()
  if (domainKind === 'app' && !tenant) {
    return (
      <Suspense fallback={<PageLoader />}>
        <PlatformLoginPage />
      </Suspense>
    )
  }
  return (
    <Suspense fallback={<PageLoader />}>
      <LoginPage />
    </Suspense>
  )
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
})

function App() {
  const handleError = (error: Error, errorInfo: { componentStack?: string | null }) => {
    // Log error to console in development
    if (process.env.NODE_ENV === 'development') {
      console.error('Error caught by boundary:', error)
      console.error('Error info:', errorInfo)
    }
  }

  return (
    <ErrorBoundary
      FallbackComponent={ErrorFallback}
      onError={handleError}
      onReset={() => {
        // Reset app state if needed
        window.location.reload()
      }}
    >
      <HelmetProvider>
        <QueryClientProvider client={queryClient}>
          <BrowserRouter>
            <TenantProvider>
              <TenantBootstrapGate>
                <Routes>
                  {/* Root Route - domain aware */}
                  <Route path="/" element={<RootRoute />} />
                  <Route
                    path="/landing"
                    element={
                      <DomainGuardMainOnly>
                        <Suspense fallback={<PageLoader />}>
                          <LandingPage />
                        </Suspense>
                      </DomainGuardMainOnly>
                    }
                  />

                  {/* Auth Routes */}
                  <Route path="/auth/login" element={<LoginRouter />} />
                  <Route
                    path="/auth/signup"
                    element={
                      <DomainGuardMainOnly>
                        <SignupGuard>
                          <Suspense fallback={<PageLoader />}>
                            <SignupPage />
                          </Suspense>
                        </SignupGuard>
                      </DomainGuardMainOnly>
                    }
                  />
                  <Route path="/auth/onboarding" element={<Suspense fallback={<PageLoader />}><OnboardingPage /></Suspense>} />
                  <Route path="/auth/accept-invite" element={<Suspense fallback={<PageLoader />}><AcceptInvitePage /></Suspense>} />
                  <Route path="/auth/client-setup" element={<Suspense fallback={<PageLoader />}><ClientSetupPage /></Suspense>} />
                  <Route path="/auth/owner-setup" element={<Suspense fallback={<PageLoader />}><OwnerSetupPage /></Suspense>} />

                  {/* Platform Console Routes - Protected by PlatformAdminGuard */}
                  <Route
                    path="/platform"
                    element={
                      <PlatformAdminGuard>
                        <Suspense fallback={<PageLoader />}>
                          <PlatformLayout />
                        </Suspense>
                      </PlatformAdminGuard>
                    }
                  >
                    <Route path="tenants" element={<Suspense fallback={<PageLoader />}><PlatformTenantsPage /></Suspense>} />
                    <Route path="tenants/:id" element={<Suspense fallback={<PageLoader />}><PlatformTenantDetailPage /></Suspense>} />
                  </Route>

                  {/* Tenant Dashboard Routes - Protected */}
                  <Route
                    path="/dashboard"
                    element={
                      <DomainGuardTenantOnly>
                        <TenantActiveGuard>
                          <AuthGuard>
                            <MembershipGuard>
                              <Suspense fallback={<PageLoader />}><DashboardLayout /></Suspense>
                            </MembershipGuard>
                          </AuthGuard>
                        </TenantActiveGuard>
                      </DomainGuardTenantOnly>
                    }
                  >
                    <Route index element={<Suspense fallback={<PageLoader />}><DashboardOverview /></Suspense>} />
                    <Route path="categories" element={<Suspense fallback={<PageLoader />}><CategoriesPage /></Suspense>} />
                    <Route path="categories/:mainCategory" element={<Suspense fallback={<PageLoader />}><CategoriesPage /></Suspense>} />
                    <Route path="categories/:mainCategory/:subCategory" element={<Suspense fallback={<PageLoader />}><CategoriesPage /></Suspense>} />
                    <Route path="categories/manage" element={<Suspense fallback={<PageLoader />}><ManageCategoriesPage /></Suspense>} />
                    <Route path="products" element={<Suspense fallback={<PageLoader />}><ProductsPage /></Suspense>} />
                    <Route path="products/:sku" element={<Suspense fallback={<PageLoader />}><ProductDetailPage /></Suspense>} />
                    <Route path="wishlist" element={<Suspense fallback={<PageLoader />}><WishlistPage /></Suspense>} />
                    <Route path="orders" element={<Suspense fallback={<PageLoader />}><OrdersPage /></Suspense>} />
                    <Route path="complaints" element={<Suspense fallback={<PageLoader />}><ComplaintsPage /></Suspense>} />
                    <Route path="quotes" element={<Suspense fallback={<PageLoader />}><QuotesPage /></Suspense>} />
                    <Route path="csv-import" element={<Suspense fallback={<PageLoader />}><CSVImportPage /></Suspense>} />
                    <Route path="settings" element={<Suspense fallback={<PageLoader />}><SettingsPage /></Suspense>} />
                    <Route path="analytics" element={<Suspense fallback={<PageLoader />}><AnalyticsPage /></Suspense>} />
                    <Route path="unpaid-balances" element={<Suspense fallback={<PageLoader />}><UnpaidBalancesPage /></Suspense>} />
                    <Route path="clients" element={<Suspense fallback={<PageLoader />}><ClientsPage /></Suspense>} />
                  </Route>

                  {/* Slug Fallback Routes – /t/:slug/* on app host */}
                  <Route
                    path="/t/:slug"
                    element={
                      <SlugOnlyGuard>
                        <Outlet />
                      </SlugOnlyGuard>
                    }
                  >
                    <Route index element={<Suspense fallback={<PageLoader />}><TenantEntry /></Suspense>} />
                    <Route path="auth/login" element={<Suspense fallback={<PageLoader />}><LoginPage /></Suspense>} />
                    <Route path="auth/onboarding" element={<Suspense fallback={<PageLoader />}><OnboardingPage /></Suspense>} />
                    <Route path="auth/client-setup" element={<Suspense fallback={<PageLoader />}><ClientSetupPage /></Suspense>} />
                    <Route path="auth/owner-setup" element={<Suspense fallback={<PageLoader />}><OwnerSetupPage /></Suspense>} />
                    <Route
                      path="dashboard"
                      element={
                        <DomainGuardTenantOnly>
                          <TenantActiveGuard>
                            <AuthGuard>
                              <MembershipGuard>
                                <Suspense fallback={<PageLoader />}><DashboardLayout /></Suspense>
                              </MembershipGuard>
                            </AuthGuard>
                          </TenantActiveGuard>
                        </DomainGuardTenantOnly>
                      }
                    >
                      <Route index element={<Suspense fallback={<PageLoader />}><DashboardOverview /></Suspense>} />
                      <Route path="categories" element={<Suspense fallback={<PageLoader />}><CategoriesPage /></Suspense>} />
                      <Route path="categories/:mainCategory" element={<Suspense fallback={<PageLoader />}><CategoriesPage /></Suspense>} />
                      <Route path="categories/:mainCategory/:subCategory" element={<Suspense fallback={<PageLoader />}><CategoriesPage /></Suspense>} />
                      <Route path="categories/manage" element={<Suspense fallback={<PageLoader />}><ManageCategoriesPage /></Suspense>} />
                      <Route path="products" element={<Suspense fallback={<PageLoader />}><ProductsPage /></Suspense>} />
                      <Route path="products/:sku" element={<Suspense fallback={<PageLoader />}><ProductDetailPage /></Suspense>} />
                      <Route path="wishlist" element={<Suspense fallback={<PageLoader />}><WishlistPage /></Suspense>} />
                      <Route path="orders" element={<Suspense fallback={<PageLoader />}><OrdersPage /></Suspense>} />
                      <Route path="complaints" element={<Suspense fallback={<PageLoader />}><ComplaintsPage /></Suspense>} />
                      <Route path="quotes" element={<Suspense fallback={<PageLoader />}><QuotesPage /></Suspense>} />
                      <Route path="csv-import" element={<Suspense fallback={<PageLoader />}><CSVImportPage /></Suspense>} />
                      <Route path="settings" element={<Suspense fallback={<PageLoader />}><SettingsPage /></Suspense>} />
                      <Route path="analytics" element={<Suspense fallback={<PageLoader />}><AnalyticsPage /></Suspense>} />
                      <Route path="unpaid-balances" element={<Suspense fallback={<PageLoader />}><UnpaidBalancesPage /></Suspense>} />
                      <Route path="clients" element={<Suspense fallback={<PageLoader />}><ClientsPage /></Suspense>} />
                    </Route>
                    <Route path="*" element={<Suspense fallback={<PageLoader />}><NotFound /></Suspense>} />
                  </Route>

                  {/* 404 */}
                  <Route path="*" element={<Suspense fallback={<PageLoader />}><NotFound /></Suspense>} />
                </Routes>
              </TenantBootstrapGate>
            </TenantProvider>
          </BrowserRouter>
          <Toaster />
          <SpeedInsights />
        </QueryClientProvider>
      </HelmetProvider>
    </ErrorBoundary>
  )
}

export default App
