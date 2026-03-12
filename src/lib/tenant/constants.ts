/** Marketing-only hosts — never run tenant resolution or auth here */
export const MARKETING_HOSTS = new Set([
  'centivon.com',
  'www.centivon.com',
])

/** App hosts — tenant resolution via /t/:slug pattern */
export const APP_HOSTS = new Set([
  'centivon.vercel.app',
  ...(import.meta.env.DEV ? ['platform.centivon.local', 'centivon.local', 'localhost'] : []),
])

/** All platform-owned hosts (union of marketing + app) */
export const PLATFORM_HOSTS = new Set([...MARKETING_HOSTS, ...APP_HOSTS])

export const PRIMARY_MAIN_HOST = 'centivon.com'
export const APP_HOST = 'centivon.vercel.app'
export const SUBDOMAIN_ROOT = 'centivon.com'

/** URL prefix for slug-based tenant access on the app host */
export const SLUG_PREFIX = '/t'

export const RESERVED_PATHS = new Set([
  'login',
  'signup',
  'auth',
  'dashboard',
  'api',
  'assets',
  'static',
  'favicon.ico',
  't',
])
