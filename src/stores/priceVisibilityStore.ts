import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface PriceVisibilityState {
  showPrices: boolean
  toggleShowPrices: () => void
  setShowPrices: (value: boolean) => void
}

/**
 * Per-user visual preference for hiding prices in the UI.
 * This is display-only — it never affects cart totals, order payloads,
 * discounts, or any pricing calculation.
 */
export const usePriceVisibilityStore = create<PriceVisibilityState>()(
  persist(
    (set) => ({
      showPrices: true,
      toggleShowPrices: () => set((state) => ({ showPrices: !state.showPrices })),
      setShowPrices: (value) => set({ showPrices: value }),
    }),
    {
      name: 'price-visibility',
    },
  ),
)
