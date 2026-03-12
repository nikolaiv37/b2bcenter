import { useAuth } from '@/hooks/useAuth'
import { CSVImportWizard } from '@/components/csv-import'
import { GlassCard } from '@/components/GlassCard'
import { Lock, Shield } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useTenantPath } from '@/lib/tenant/TenantProvider'

export function CSVImportPage() {
  const { isAdmin, isLoading } = useAuth()
  const navigate = useNavigate()
  const { withBase } = useTenantPath()
  const { t } = useTranslation()

  // Show loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-violet-600 mx-auto mb-4"></div>
          <p className="text-muted-foreground">{t('general.loading')}</p>
        </div>
      </div>
    )
  }

  // Non-admin users see access denied message
  if (!isAdmin) {
    return (
      <div className="max-w-2xl mx-auto mt-12">
        <GlassCard className="text-center py-12 border-2 border-amber-200 dark:border-amber-800 bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/20 dark:to-orange-950/20">
          <div className="w-16 h-16 rounded-2xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center mx-auto mb-6">
            <Lock className="w-8 h-8 text-amber-600 dark:text-amber-400" />
          </div>
          
          <h2 className="text-2xl font-bold mb-3 text-amber-700 dark:text-amber-400">
            {t('csvImport.access.adminOnly')}
          </h2>
          
          <p className="text-muted-foreground mb-6 max-w-md mx-auto">
            {t('csvImport.access.adminOnlyDescription')}
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Button 
              variant="outline"
              onClick={() => navigate(withBase('/dashboard/products'))}
            >
              {t('csvImport.access.viewProducts')}
            </Button>
            <Button
              onClick={() => navigate(withBase('/dashboard'))}
            >
              {t('csvImport.access.goToDashboard')}
            </Button>
          </div>

          <div className="mt-8 pt-6 border-t border-amber-200 dark:border-amber-800">
            <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <Shield className="w-4 h-4" />
              <span>{t('csvImport.access.contactAdmin')}</span>
            </div>
          </div>
        </GlassCard>
      </div>
    )
  }

  // Admin users see the full wizard
  return <CSVImportWizard />
}
