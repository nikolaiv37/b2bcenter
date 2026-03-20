import { useState, useRef, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Check, ChevronDown, Globe } from 'lucide-react'
import { cn } from '@/lib/utils'

export function LanguageSwitcher() {
  const { i18n, t } = useTranslation()
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  
  const languages = [
    {
      code: 'en',
      name: t('language.englishName'),
      icon: Globe,
      nativeName: t('language.en'),
    },
    {
      code: 'bg',
      name: t('language.bulgarianName'),
      icon: Globe,
      nativeName: t('language.bg'),
    },
  ]

  const currentLang = i18n.language || 'en'
  const currentLanguage = languages.find(lang => lang.code === currentLang) || languages[0]

  const changeLanguage = (langCode: string) => {
    i18n.changeLanguage(langCode)
    setIsOpen(false)
  }

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => {
        document.removeEventListener('mousedown', handleClickOutside)
      }
    }
  }, [isOpen])

  return (
    <div className="relative">
      {/* Trigger Button */}
      <button
        ref={buttonRef}
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          'group relative flex items-center gap-2.5 px-3.5 py-2',
          'rounded-lg transition-all duration-300 ease-out',
          'backdrop-blur-md bg-white/40 dark:bg-black/40',
          'border border-white/30 dark:border-white/10',
          'shadow-sm hover:shadow-md',
          'hover:bg-white/50 dark:hover:bg-black/50',
          'hover:border-white/40 dark:hover:border-white/15',
          'active:scale-[0.98]',
          'focus:outline-none focus:ring-2 focus:ring-primary/20 focus:ring-offset-2 focus:ring-offset-transparent',
          isOpen && 'bg-white/60 dark:bg-black/60 border-white/50 dark:border-white/20 shadow-md'
        )}
        aria-label={t('language.changeLanguage')}
        aria-expanded={isOpen}
        aria-haspopup="true"
      >
        {/* Globe Icon */}
        <currentLanguage.icon className="h-4 w-4 text-gray-600 dark:text-gray-300 transition-transform duration-200 group-hover:scale-110" />
        
        {/* Language Code - Only show when menu is open */}
        {isOpen && (
          <span className="hidden sm:inline-block text-sm font-semibold text-gray-700 dark:text-gray-200 transition-colors">
            {currentLanguage.code.toUpperCase()}
          </span>
        )}
        
        {/* Chevron Icon */}
        <ChevronDown
          className={cn(
            'h-3.5 w-3.5 text-gray-500 dark:text-gray-400 transition-all duration-300',
            isOpen && 'rotate-180'
          )}
        />
      </button>

      {/* Dropdown Menu */}
      <div
        ref={dropdownRef}
        className={cn(
          'absolute left-0 top-full mt-2 z-50 sm:left-auto sm:right-0',
          'w-[min(220px,calc(100vw-1rem))] rounded-xl',
          'backdrop-blur-xl bg-white/80 dark:bg-gray-900/80',
          'border border-white/40 dark:border-white/20',
          'shadow-2xl shadow-black/10 dark:shadow-black/30',
          'overflow-hidden',
          'transition-all duration-200 ease-out',
          isOpen 
            ? 'opacity-100 translate-y-0 pointer-events-auto' 
            : 'opacity-0 -translate-y-2 pointer-events-none'
        )}
        role="menu"
        aria-orientation="vertical"
      >
          {/* Dropdown Content */}
          <div className="p-1.5">
            {languages.map((lang) => {
              const isActive = currentLang === lang.code
              return (
                <button
                  key={lang.code}
                  onClick={() => changeLanguage(lang.code)}
                  className={cn(
                    'w-full flex items-center gap-3 px-4 py-3 rounded-lg',
                    'text-left transition-all duration-200',
                    'hover:bg-white/60 dark:hover:bg-gray-800/60',
                    'active:scale-[0.98]',
                    'group/item',
                    isActive && 'bg-primary/10 dark:bg-primary/20'
                  )}
                  role="menuitem"
                >
                  {/* Globe */}
                  <lang.icon className="h-5 w-5 text-gray-500 dark:text-gray-400 flex-shrink-0" />
                  
                  {/* Language Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={cn(
                        'text-sm font-semibold',
                        isActive 
                          ? 'text-primary dark:text-primary' 
                          : 'text-gray-700 dark:text-gray-200'
                      )}>
                        {lang.nativeName}
                      </span>
                      {isActive && (
                        <Check className="h-4 w-4 text-primary dark:text-primary flex-shrink-0 animate-in fade-in zoom-in-50 duration-200" />
                      )}
                    </div>
                    <span className="text-xs text-gray-500 dark:text-gray-400 block mt-0.5">
                      {lang.name}
                    </span>
                  </div>
                </button>
              )
            })}
          </div>
        </div>
    </div>
  )
}
