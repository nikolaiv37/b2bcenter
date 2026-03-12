import posthog from 'posthog-js'

const POSTHOG_KEY = import.meta.env.VITE_POSTHOG_KEY
const POSTHOG_HOST = import.meta.env.VITE_POSTHOG_HOST

let initialized = false

export function initAnalytics() {
  if (initialized || !POSTHOG_KEY || POSTHOG_KEY === 'phc_placeholder') return

  try {
    posthog.init(POSTHOG_KEY, {
      api_host: POSTHOG_HOST || 'https://app.posthog.com',
      autocapture: true,
      capture_pageview: true,
      capture_pageleave: true,
    })
    initialized = true
  } catch (error) {
    console.log('Analytics disabled (placeholder key)')
  }
}

export function trackEvent(eventName: string, properties?: Record<string, unknown>) {
  if (!initialized) return
  posthog.capture(eventName, properties)
}

export function identifyUser(userId: string, traits?: Record<string, unknown>) {
  if (!initialized) return
  posthog.identify(userId, traits)
}

export function trackPageView(pageName: string, properties?: Record<string, unknown>) {
  if (!initialized) return
  posthog.capture('$pageview', { page: pageName, ...properties })
}

// Predefined events
export const AnalyticsEvents = {
  // Auth
  USER_SIGNED_UP: 'user_signed_up',
  USER_LOGGED_IN: 'user_logged_in',
  USER_LOGGED_OUT: 'user_logged_out',
  
  // Products
  PRODUCT_VIEWED: 'product_viewed',
  PRODUCT_ADDED_TO_CART: 'product_added_to_cart',
  PRODUCT_REMOVED_FROM_CART: 'product_removed_from_cart',
  
  // Quotes
  QUOTE_REQUESTED: 'quote_requested',
  QUOTE_APPROVED: 'quote_approved',
  QUOTE_REJECTED: 'quote_rejected',
  
  // Orders
  ORDER_PLACED: 'order_placed',
  ORDER_APPROVED: 'order_approved',
  ORDER_SHIPPED: 'order_shipped',
  
  // CSV
  CSV_IMPORT_STARTED: 'csv_import_started',
  CSV_IMPORT_COMPLETED: 'csv_import_completed',
  CSV_IMPORT_FAILED: 'csv_import_failed',
  
  // Dashboard
  DASHBOARD_VIEWED: 'dashboard_viewed',
  
}
