import { loadStripe, Stripe } from '@stripe/stripe-js'

const STRIPE_PUBLISHABLE_KEY = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY

let stripePromise: Promise<Stripe | null> | null = null

export function getStripe(): Promise<Stripe | null> {
  if (!stripePromise) {
    stripePromise = loadStripe(STRIPE_PUBLISHABLE_KEY)
  }
  return stripePromise
}

export async function createCheckoutSession(orderId: string, items: unknown[], total: number) {
  // This would typically call your backend/Supabase Edge Function
  // that creates a Stripe checkout session
  const response = await fetch('/api/create-checkout-session', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      orderId,
      items,
      total,
    }),
  })

  if (!response.ok) {
    throw new Error('Failed to create checkout session')
  }

  const { sessionId } = await response.json()
  return sessionId
}

export async function redirectToCheckout(sessionId: string) {
  const stripe = await getStripe()
  if (!stripe) {
    throw new Error('Stripe failed to load')
  }

  const { error } = await stripe.redirectToCheckout({ sessionId })
  
  if (error) {
    throw error
  }
}
