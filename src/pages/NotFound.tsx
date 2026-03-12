import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { GlassCard } from '@/components/GlassCard'
import { Button } from '@/components/ui/button'
import { Home, AlertCircle } from 'lucide-react'

export function NotFound() {
  const { t } = useTranslation()
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <GlassCard className="max-w-md w-full text-center">
        <AlertCircle className="w-20 h-20 text-muted-foreground mx-auto mb-4" />
        <h1 className="text-6xl font-bold mb-4">{t('notFound.title')}</h1>
        <h2 className="text-2xl font-semibold mb-2">{t('notFound.heading')}</h2>
        <p className="text-muted-foreground mb-6">
          {t('notFound.description')}
        </p>
        <Link to="/">
          <Button>
            <Home className="w-4 h-4 mr-2" />
            {t('notFound.goHome')}
          </Button>
        </Link>
      </GlassCard>
    </div>
  )
}

