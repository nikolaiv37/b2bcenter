import DOMPurify from 'dompurify'
import { useMemo } from 'react'

interface HtmlContentProps {
  /** Raw HTML string (e.g. from product description, CSV import) */
  html: string
  /** Optional class name for the wrapper */
  className?: string
  /** Use prose styling for rich content (headings, lists, etc.) */
  prose?: boolean
}

/**
 * Safely renders HTML content with DOMPurify sanitization.
 * Use for product descriptions and other trusted HTML from CSV/catalog imports.
 * Strips scripts, event handlers, and dangerous tags while keeping formatting (h2, p, strong, ul, li, etc.)
 */
export function HtmlContent({ html, className = '', prose = true }: HtmlContentProps) {
  const sanitized = useMemo(() => {
    if (!html || typeof html !== 'string') return ''
    return DOMPurify.sanitize(html, {
      ALLOWED_TAGS: [
        'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
        'p', 'br', 'hr',
        'strong', 'b', 'em', 'i', 'u', 's',
        'ul', 'ol', 'li',
        'a', 'span', 'div',
        'table', 'thead', 'tbody', 'tr', 'th', 'td',
      ],
      ALLOWED_ATTR: ['href', 'target', 'rel'], // for links only; strip data-* etc.
    })
  }, [html])

  if (!sanitized) return null

  return (
    <div
      className={prose ? `prose prose-sm max-w-none text-muted-foreground dark:prose-invert ${className}` : className}
      dangerouslySetInnerHTML={{ __html: sanitized }}
    />
  )
}
