import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import LanguageDetector from 'i18next-browser-languagedetector'

// Import translation files
import enTranslations from '../locales/en.json'
import bgTranslations from '../locales/bg.json'

i18n
  // Detect user language
  .use(LanguageDetector)
  // Pass the i18n instance to react-i18next
  .use(initReactI18next)
  // Initialize i18next
  .init({
    // Fallback language
    fallbackLng: 'en',
    
    // Supported languages
    supportedLngs: ['en', 'bg'],
    
    // Default namespace
    defaultNS: 'common',
    ns: ['common'],
    
    // Resources (translations)
    resources: {
      en: {
        common: enTranslations.common,
      },
      bg: {
        common: bgTranslations.common,
      },
    },
    
    // Detection options
    detection: {
      // Order of detection methods
      order: ['localStorage', 'navigator', 'htmlTag'],
      // Cache user language
      caches: ['localStorage'],
      // Look for language in localStorage key
      lookupLocalStorage: 'i18nextLng',
    },
    
    // React i18next options
    react: {
      useSuspense: false, // Disable suspense for better performance
    },
    
    // Interpolation options
    interpolation: {
      escapeValue: false, // React already escapes values
    },
    
    // Performance: load translations synchronously (they're already imported)
    // This ensures zero performance impact - translations are bundled
    load: 'languageOnly', // Only load language, not region (en, not en-US)
    
    // Debug mode (only in development)
    debug: import.meta.env.DEV,
  })

// Update HTML lang attribute when language changes
i18n.on('languageChanged', (lng) => {
  document.documentElement.lang = lng
})

// Set initial HTML lang attribute
if (typeof document !== 'undefined') {
  document.documentElement.lang = i18n.language
}

export default i18n

