import { lazy, Suspense } from 'react'
import { SpeedInsights } from '@vercel/speed-insights/react'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { HelmetProvider } from 'react-helmet-async'
import { ErrorBoundary } from 'react-error-boundary'
import { Toaster } from '@/components/ui/toaster'
import { ErrorFallback } from '@/components/ErrorFallback'
import { AuthGuard } from '@/components/AuthGuard'
import { TenantProvider } from '@/lib/tenant/TenantProvider'
import { TenantActiveGuard } from '@/components/guards/TenantActiveGuard'
import { MembershipGuard } from '@/components/guards/MembershipGuard'
import { SignupGuard } from '@/components/guards/SignupGuard'
import { PageLoader } from '@/components/PageLoader'
import { AppContextProvider } from '@/lib/app/AppContext'

// Auth pages
const LoginPage = lazy(() => import('@/app/auth/login').then((m) => ({ default: m.LoginPage })))
const SignupPage = lazy(() => import('@/app/auth/signup').then((m) => ({ default: m.SignupPage })))
const OnboardingPage = lazy(() => import('@/app/auth/onboarding').then((m) => ({ default: m.OnboardingPage })))
const AcceptInvitePage = lazy(() => import('@/app/auth/accept-invite').then((m) => ({ default: m.AcceptInvitePage })))
const ClientSetupPage = lazy(() => import('@/app/auth/client-setup').then((m) => ({ default: m.ClientSetupPage })))
const OwnerSetupPage = lazy(() => import('@/app/auth/owner-setup').then((m) => ({ default: m.OwnerSetupPage })))

// Dashboard pages
const DashboardLayout = lazy(() => import('@/app/dashboard/layout').then((m) => ({ default: m.DashboardLayout })))
const DashboardOverview = lazy(() => import('@/app/dashboard/overview').then((m) => ({ default: m.DashboardOverview })))
const ProductsPage = lazy(() => import('@/app/dashboard/products').then((m) => ({ default: m.ProductsPage })))
const ProductDetailPage = lazy(() => import('@/app/dashboard/products/[sku]/page').then((m) => ({ default: m.ProductDetailPage })))
const WishlistPage = lazy(() => import('@/app/dashboard/wishlist').then((m) => ({ default: m.WishlistPage })))
const OrdersPage = lazy(() => import('@/app/dashboard/orders').then((m) => ({ default: m.OrdersPage })))
const QuotesPage = lazy(() => import('@/app/dashboard/quotes').then((m) => ({ default: m.QuotesPage })))
const CSVImportPage = lazy(() => import('@/app/dashboard/csv-import').then((m) => ({ default: m.CSVImportPage })))
const SettingsPage = lazy(() => import('@/app/dashboard/settings').then((m) => ({ default: m.SettingsPage })))
const AnalyticsPage = lazy(() => import('@/app/dashboard/analytics').then((m) => ({ default: m.AnalyticsPage })))
const ComplaintsPage = lazy(() => import('@/app/dashboard/complaints').then((m) => ({ default: m.ComplaintsPage })))
const UnpaidBalancesPage = lazy(() => import('@/app/dashboard/unpaid-balances').then((m) => ({ default: m.UnpaidBalancesPage })))
const CategoriesPage = lazy(() => import('@/app/dashboard/categories').then((m) => ({ default: m.CategoriesPage })))
const ManageCategoriesPage = lazy(() => import('@/app/dashboard/categories/manage').then((m) => ({ default: m.ManageCategoriesPage })))
const ClientsPage = lazy(() => import('@/app/dashboard/clients').then((m) => ({ default: m.ClientsPage })))

const LandingPage = lazy(() => import('@/pages/LandingPage'))
const MainIndexRoute = lazy(() => import('@/pages/MainIndexRoute').then((m) => ({ default: m.MainIndexRoute })))
const NotFound = lazy(() => import('@/pages/NotFound').then((m) => ({ default: m.NotFound })))

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
              <AppContextProvider>
                <Routes>
                <Route
                  path="/"
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <MainIndexRoute />
                    </Suspense>
                  }
                />
                <Route
                  path="/landing"
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <LandingPage />
                    </Suspense>
                  }
                />

                <Route
                  path="/auth/login"
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <LoginPage />
                    </Suspense>
                  }
                />
                <Route
                  path="/auth/signup"
                  element={
                    <SignupGuard>
                      <Suspense fallback={<PageLoader />}>
                        <SignupPage />
                      </Suspense>
                    </SignupGuard>
                  }
                />
                <Route
                  path="/auth/onboarding"
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <OnboardingPage />
                    </Suspense>
                  }
                />
                <Route
                  path="/auth/accept-invite"
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <AcceptInvitePage />
                    </Suspense>
                  }
                />
                <Route
                  path="/auth/client-setup"
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <ClientSetupPage />
                    </Suspense>
                  }
                />
                <Route
                  path="/auth/owner-setup"
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <OwnerSetupPage />
                    </Suspense>
                  }
                />

                <Route
                  path="/dashboard"
                  element={
                    <TenantActiveGuard>
                      <AuthGuard>
                        <MembershipGuard>
                          <Suspense fallback={<PageLoader />}>
                            <DashboardLayout />
                          </Suspense>
                        </MembershipGuard>
                      </AuthGuard>
                    </TenantActiveGuard>
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

                <Route
                  path="*"
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <NotFound />
                    </Suspense>
                  }
                />
                </Routes>
              </AppContextProvider>
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
