import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { GlassCard } from './GlassCard'
import { AlertCircle } from 'lucide-react'
import { useTenant, useTenantPath } from '@/lib/tenant/TenantProvider'

interface ErrorFallbackProps {
  error: Error
  resetErrorBoundary: () => void
}

export function ErrorFallback({ error, resetErrorBoundary }: ErrorFallbackProps) {
  const { t } = useTranslation()
  const { domainKind, tenant } = useTenant()
  const { withBase } = useTenantPath()
  // Safely extract error information
  const errorMessage = error?.message || error?.toString() || t('errors.unknownError')
  const errorStack = error?.stack || t('errors.noStackTrace')
  const errorName = error?.name || t('errors.genericError')

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <GlassCard className="max-w-md w-full text-center p-6">
        <AlertCircle className="w-16 h-16 text-destructive mx-auto mb-4" />
        <h2 className="text-2xl font-bold mb-2 text-foreground">{t('errors.somethingWentWrong')}</h2>
        <p className="text-muted-foreground mb-4">
          {t('errors.genericDescription')}
        </p>
        <details className="mb-4 text-left">
          <summary className="cursor-pointer text-sm font-medium mb-2 text-foreground hover:text-primary">
            {t('errors.details')}
          </summary>
          <div className="text-xs bg-muted p-3 rounded-md overflow-auto max-h-40">
            <div className="font-semibold mb-1 text-foreground">{errorName}</div>
            <div className="text-foreground/90 mb-2">{errorMessage}</div>
            {process.env.NODE_ENV === 'development' && errorStack && (
              <div className="mt-2 pt-2 border-t border-border">
                <div className="text-xs opacity-70 mb-1">{t('errors.stackTrace')}</div>
                <pre className="text-xs opacity-60 mt-1 whitespace-pre-wrap break-words">
                  {errorStack}
                </pre>
              </div>
            )}
          </div>
        </details>
        <div className="flex gap-2 justify-center">
          <Button onClick={resetErrorBoundary} variant="default">
            {t('errors.tryAgain')}
          </Button>
          <Button
            onClick={() => {
              if (tenant) {
                window.location.href = withBase('/dashboard')
                return
              }
              if (domainKind === 'tenant') {
                window.location.href = '/'
                return
              }
              window.location.href = '/'
            }}
            variant="outline"
          >
            {t('errors.goToDashboard')}
          </Button>
        </div>
      </GlassCard>
    </div>
  )
}
