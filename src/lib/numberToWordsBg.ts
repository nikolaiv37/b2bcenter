/**
 * Bulgarian Number to Words Converter
 * Converts numbers to Bulgarian words for invoice "Словом" field
 * 
 * Handles:
 * - Numbers 0 to 999,999,999,999 (billions)
 * - Decimal parts (cents/stotinki)
 * - Grammatical gender for Bulgarian (masculine/feminine)
 * - Currency formatting (евро/цента)
 */

// Basic numbers 0-19
const UNITS: string[] = [
  '', 'един', 'два', 'три', 'четири', 'пет', 'шест', 'седем', 'осем', 'девет',
  'десет', 'единадесет', 'дванадесет', 'тринадесет', 'четиринадесет',
  'петнадесет', 'шестнадесет', 'седемнадесет', 'осемнадесет', 'деветнадесет'
]

// Feminine forms for 1 and 2 (used with хиляди)
const UNITS_FEMININE: Record<number, string> = {
  1: 'една',
  2: 'две'
}

// Tens 20-90
const TENS: string[] = [
  '', '', 'двадесет', 'тридесет', 'четиридесет', 'петдесет',
  'шестдесет', 'седемдесет', 'осемдесет', 'деветдесет'
]

// Hundreds
const HUNDREDS: string[] = [
  '', 'сто', 'двеста', 'триста', 'четиристотин', 'петстотин',
  'шестстотин', 'седемстотин', 'осемстотин', 'деветстотин'
]

/**
 * Converts a number from 0-999 to Bulgarian words
 * @param n - Number to convert (0-999)
 * @param feminine - Whether to use feminine forms for 1/2
 */
function convertHundreds(n: number, feminine: boolean = false): string {
  if (n === 0) return ''
  
  const parts: string[] = []
  
  // Hundreds
  const hundreds = Math.floor(n / 100)
  if (hundreds > 0) {
    parts.push(HUNDREDS[hundreds])
  }
  
  // Remainder (0-99)
  const remainder = n % 100
  
  if (remainder > 0) {
    if (remainder < 20) {
      // Use feminine form if needed
      if (feminine && (remainder === 1 || remainder === 2)) {
        parts.push(UNITS_FEMININE[remainder])
      } else {
        parts.push(UNITS[remainder])
      }
    } else {
      // 20-99
      const tens = Math.floor(remainder / 10)
      const units = remainder % 10
      
      if (units === 0) {
        parts.push(TENS[tens])
      } else {
        // Use feminine form if needed
        let unitWord = UNITS[units]
        if (feminine && (units === 1 || units === 2)) {
          unitWord = UNITS_FEMININE[units]
        }
        parts.push(`${TENS[tens]} и ${unitWord}`)
      }
    }
  }
  
  // Join with "и" if we have hundreds and something else
  if (parts.length === 2) {
    return `${parts[0]} и ${parts[1]}`
  }
  
  return parts.join(' ')
}

/**
 * Converts a number from 0-999,999 to Bulgarian words
 * @param n - Number to convert
 */
function convertThousands(n: number): string {
  if (n === 0) return 'нула'
  if (n < 1000) return convertHundreds(n)
  
  const parts: string[] = []
  
  const thousands = Math.floor(n / 1000)
  const remainder = n % 1000
  
  if (thousands > 0) {
    if (thousands === 1) {
      parts.push('хиляда')
    } else if (thousands < 20) {
      // Use feminine forms for хиляди
      parts.push(`${convertHundreds(thousands, true)} хиляди`)
    } else {
      parts.push(`${convertHundreds(thousands, true)} хиляди`)
    }
  }
  
  if (remainder > 0) {
    const remainderWords = convertHundreds(remainder)
    if (parts.length > 0 && remainder < 100) {
      parts.push(`и ${remainderWords}`)
    } else if (parts.length > 0) {
      parts.push(remainderWords)
    } else {
      parts.push(remainderWords)
    }
  }
  
  return parts.join(' ')
}

/**
 * Converts a number from 0-999,999,999 to Bulgarian words
 * @param n - Number to convert
 */
function convertMillions(n: number): string {
  if (n === 0) return 'нула'
  if (n < 1000000) return convertThousands(n)
  
  const parts: string[] = []
  
  const millions = Math.floor(n / 1000000)
  const remainder = n % 1000000
  
  if (millions > 0) {
    if (millions === 1) {
      parts.push('един милион')
    } else {
      parts.push(`${convertThousands(millions)} милиона`)
    }
  }
  
  if (remainder > 0) {
    const remainderWords = convertThousands(remainder)
    if (parts.length > 0 && remainder < 1000) {
      parts.push(`и ${remainderWords}`)
    } else {
      parts.push(remainderWords)
    }
  }
  
  return parts.join(' ')
}

/**
 * Converts a number from 0 to billions to Bulgarian words
 * @param n - Number to convert
 */
function convertBillions(n: number): string {
  if (n === 0) return 'нула'
  if (n < 1000000000) return convertMillions(n)
  
  const parts: string[] = []
  
  const billions = Math.floor(n / 1000000000)
  const remainder = n % 1000000000
  
  if (billions > 0) {
    if (billions === 1) {
      parts.push('един милиард')
    } else {
      parts.push(`${convertThousands(billions)} милиарда`)
    }
  }
  
  if (remainder > 0) {
    parts.push(convertMillions(remainder))
  }
  
  return parts.join(' ')
}

/**
 * Main function to convert a number to Bulgarian words
 * @param n - Number to convert (can be decimal)
 */
export function numberToWordsBg(n: number): string {
  if (n < 0) {
    return `минус ${numberToWordsBg(Math.abs(n))}`
  }
  
  if (n === 0) return 'нула'
  
  // Handle very large numbers
  if (n >= 1000000000000) {
    return n.toString() // Return as-is for numbers too large
  }
  
  return convertBillions(Math.floor(n))
}

/**
 * Converts amount to Bulgarian words with EUR currency
 * Format: "Двеста седемдесет и девет евро и шейсет и пет цента"
 * 
 * @param amount - Amount in EUR (e.g., 279.65)
 * @returns Bulgarian words representation
 */
export function amountToWordsBgEur(amount: number): string {
  if (amount < 0) {
    return `минус ${amountToWordsBgEur(Math.abs(amount))}`
  }
  
  // Split into whole and decimal parts
  const wholePart = Math.floor(amount)
  const decimalPart = Math.round((amount - wholePart) * 100)
  
  const parts: string[] = []
  
  // Whole part (euros)
  if (wholePart === 0 && decimalPart === 0) {
    return 'нула евро'
  }
  
  if (wholePart > 0) {
    const wholeWords = numberToWordsBg(wholePart)
    // Capitalize first letter
    const capitalizedWholeWords = wholeWords.charAt(0).toUpperCase() + wholeWords.slice(1)
    
    // Choose singular or plural form for евро (евро is invariable in Bulgarian)
    parts.push(`${capitalizedWholeWords} евро`)
  }
  
  // Decimal part (cents)
  if (decimalPart > 0) {
    const decimalWords = numberToWordsBg(decimalPart)
    
    // Choose singular or plural form for цент/цента
    // In Bulgarian: 1 цент, 2-4 цента, 5+ цента
    let centWord = 'цента'
    if (decimalPart === 1) {
      centWord = 'цент'
    }
    
    if (parts.length > 0) {
      parts.push(`и ${decimalWords} ${centWord}`)
    } else {
      const capitalizedDecimalWords = decimalWords.charAt(0).toUpperCase() + decimalWords.slice(1)
      parts.push(`${capitalizedDecimalWords} ${centWord}`)
    }
  }
  
  return parts.join(' ')
}

/**
 * Converts amount to Bulgarian words with BGN currency
 * Format: "Двеста седемдесет и девет лева и шейсет и пет стотинки"
 * 
 * @param amount - Amount in BGN (e.g., 279.65)
 * @returns Bulgarian words representation
 */
export function amountToWordsBgBgn(amount: number): string {
  if (amount < 0) {
    return `минус ${amountToWordsBgBgn(Math.abs(amount))}`
  }
  
  // Split into whole and decimal parts
  const wholePart = Math.floor(amount)
  const decimalPart = Math.round((amount - wholePart) * 100)
  
  const parts: string[] = []
  
  // Whole part (leva)
  if (wholePart === 0 && decimalPart === 0) {
    return 'нула лева'
  }
  
  if (wholePart > 0) {
    const wholeWords = numberToWordsBg(wholePart)
    // Capitalize first letter
    const capitalizedWholeWords = wholeWords.charAt(0).toUpperCase() + wholeWords.slice(1)
    
    // Choose singular or plural form: 1 лев, 2+ лева
    const levWord = wholePart === 1 ? 'лев' : 'лева'
    parts.push(`${capitalizedWholeWords} ${levWord}`)
  }
  
  // Decimal part (stotinki)
  if (decimalPart > 0) {
    const decimalWords = numberToWordsBg(decimalPart)
    
    // Choose singular or plural form: 1 стотинка, 2-4 стотинки, 5+ стотинки
    let stotinkiWord = 'стотинки'
    if (decimalPart === 1) {
      stotinkiWord = 'стотинка'
    }
    
    if (parts.length > 0) {
      parts.push(`и ${decimalWords} ${stotinkiWord}`)
    } else {
      const capitalizedDecimalWords = decimalWords.charAt(0).toUpperCase() + decimalWords.slice(1)
      parts.push(`${capitalizedDecimalWords} ${stotinkiWord}`)
    }
  }
  
  return parts.join(' ')
}

// Export for testing
export { convertHundreds, convertThousands, convertMillions }

