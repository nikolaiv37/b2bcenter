import { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { usePriceVisibilityStore } from '@/stores/priceVisibilityStore'

interface PriceDisplayProps {
  /** The already-formatted price node to show when prices are visible. */
  children: ReactNode
  /** Placeholder shown when prices are hidden. Defaults to a neutral dotted mask. */
  placeholder?: string
}

/**
 * Renders the given formatted price when the user has prices visible,
 * otherwise shows a neutral placeholder. Purely visual — the underlying
 * price value passed by the caller is unchanged.
 */
export function PriceDisplay({ children, placeholder }: PriceDisplayProps) {
  const showPrices = usePriceVisibilityStore((s) => s.showPrices)
  const { t } = useTranslation()

  if (showPrices) {
    return <>{children}</>
  }

  return (
    <span aria-label={t('header.pricesHidden')} title={t('header.pricesHidden')}>
      {placeholder ?? '••••'}
    </span>
  )
}
