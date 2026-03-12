import { Document, Page, Text, View, StyleSheet, Font } from '@react-pdf/renderer'
import { amountToWordsBgEur } from '@/lib/numberToWordsBg'

// Register Open Sans font with Cyrillic support from jsDelivr CDN
// Open Sans has excellent Cyrillic glyph coverage
Font.register({
  family: 'OpenSans',
  fonts: [
    {
      src: 'https://cdn.jsdelivr.net/npm/open-sans-all@0.1.3/fonts/open-sans-regular.ttf',
      fontWeight: 'normal',
    },
    {
      src: 'https://cdn.jsdelivr.net/npm/open-sans-all@0.1.3/fonts/open-sans-600.ttf',
      fontWeight: 'semibold',
    },
    {
      src: 'https://cdn.jsdelivr.net/npm/open-sans-all@0.1.3/fonts/open-sans-700.ttf',
      fontWeight: 'bold',
    },
    {
      src: 'https://cdn.jsdelivr.net/npm/open-sans-all@0.1.3/fonts/open-sans-italic.ttf',
      fontWeight: 'normal',
      fontStyle: 'italic',
    },
  ],
})

// Color palette matching the target invoice
const colors = {
  primary: '#1a365d', // Dark blue for headers
  secondary: '#2d5a87', // Medium blue
  accent: '#4a90c2', // Light blue accent
  text: '#1a1a1a', // Near black for text
  textLight: '#4a4a4a', // Gray for labels
  border: '#cccccc', // Light gray borders
  borderDark: '#333333',
  background: '#ffffff',
  backgroundAlt: '#f8f9fa', // Light gray background
  highlight: '#e8f4fc', // Light blue highlight
}

// Bulgarian-compliant invoice styles matching target template
const styles = StyleSheet.create({
  page: {
    padding: 32,
    paddingTop: 26,
    paddingBottom: 40,
    fontSize: 8,
    fontFamily: 'OpenSans',
    backgroundColor: colors.background,
    color: colors.text,
  },

  // ===== HEADER SECTION =====
  headerContainer: {
    marginBottom: 20,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  headerLeft: {
    width: '50%',
  },
  headerRight: {
    width: '45%',
    alignItems: 'flex-end',
  },
  originalBadge: {
    fontSize: 8,
    color: colors.textLight,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 5,
  },
  invoiceTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.primary,
    marginBottom: 5,
  },
  invoiceNumber: {
    fontSize: 9,
    color: colors.textLight,
  },
  totalPreviewBox: {
    backgroundColor: colors.highlight,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 4,
    borderLeft: `3 solid ${colors.primary}`,
  },
  totalPreviewLabel: {
    fontSize: 9,
    color: colors.textLight,
    marginBottom: 4,
  },
  totalPreviewAmount: {
    fontSize: 14,
    fontWeight: 'bold',
    color: colors.primary,
  },
  headerDivider: {
    borderBottom: `1 solid ${colors.border}`,
    marginTop: 10,
  },

  // ===== PARTIES SECTION (Buyer & Supplier) =====
  partiesContainer: {
    flexDirection: 'row',
    marginTop: 14,
    marginBottom: 14,
  },
  partyBox: {
    width: '48%',
    padding: 10,
    backgroundColor: colors.backgroundAlt,
    borderRadius: 4,
    border: `1 solid ${colors.border}`,
  },
  partyBoxLeft: {
    marginRight: '2%',
  },
  partyBoxRight: {
    marginLeft: '2%',
  },
  partyTitle: {
    fontSize: 9,
    fontWeight: 'bold',
    color: colors.primary,
    marginBottom: 10,
    paddingBottom: 6,
    borderBottom: `1 solid ${colors.border}`,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  partyRow: {
    flexDirection: 'row',
    marginBottom: 3,
  },
  partyLabel: {
    width: '35%',
    fontSize: 7,
    color: colors.textLight,
  },
  partyValue: {
    width: '65%',
    fontSize: 8,
    fontWeight: 'semibold',
  },

  // ===== ITEMS TABLE =====
  tableContainer: {
    marginBottom: 10,
  },
  table: {
    border: `1 solid ${colors.borderDark}`,
    borderRadius: 4,
    overflow: 'hidden',
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: colors.primary,
    paddingVertical: 6,
    paddingHorizontal: 4,
  },
  tableHeaderCell: {
    color: '#ffffff',
    fontSize: 7,
    fontWeight: 'bold',
    textTransform: 'uppercase',
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 5,
    paddingHorizontal: 4,
    borderBottom: `0.5 solid ${colors.border}`,
    minHeight: 24,
    alignItems: 'center',
  },
  tableRowAlt: {
    backgroundColor: colors.backgroundAlt,
  },
  tableRowLast: {
    borderBottom: 'none',
  },
  tableCell: {
    fontSize: 7,
    paddingHorizontal: 4,
  },
  // Column widths
  colNo: { width: '5%', textAlign: 'center' },
  colName: { width: '32%' },
  colUnit: { width: '8%', textAlign: 'center' },
  colQty: { width: '8%', textAlign: 'center' },
  colPrice: { width: '12%', textAlign: 'right' },
  colBase: { width: '12%', textAlign: 'right' },
  colVat: { width: '10%', textAlign: 'center' },
  colTotal: { width: '13%', textAlign: 'right', fontWeight: 'bold' },
  productSku: {
    fontSize: 6,
    color: colors.textLight,
    marginTop: 2,
  },

  // ===== TOTALS SECTION =====
  totalsContainer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginBottom: 10,
  },
  totalsBox: {
    width: '38%',
    border: `1 solid ${colors.borderDark}`,
    borderRadius: 4,
    overflow: 'hidden',
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderBottom: `0.5 solid ${colors.border}`,
  },
  totalRowGrand: {
    backgroundColor: colors.primary,
    borderBottom: 'none',
  },
  totalLabel: {
    fontSize: 8,
    color: colors.text,
  },
  totalLabelGrand: {
    color: '#ffffff',
    fontWeight: 'bold',
  },
  totalValue: {
    fontSize: 8,
    fontWeight: 'bold',
    textAlign: 'right',
  },
  totalValueGrand: {
    color: '#ffffff',
    fontSize: 10,
  },

  // ===== SLOVOM (Amount in Words) =====
  slovomBox: {
    marginBottom: 10,
    padding: 8,
    backgroundColor: colors.backgroundAlt,
    borderRadius: 4,
    border: `1 solid ${colors.border}`,
  },
  slovomLabel: {
    fontSize: 8,
    fontWeight: 'bold',
    color: colors.textLight,
    marginBottom: 3,
  },
  slovomText: {
    fontSize: 8,
    fontStyle: 'italic',
  },

  // ===== DETAILS SECTION (Payment & Bank) =====
  detailsContainer: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  detailsBox: {
    width: '48%',
    padding: 8,
    border: `1 solid ${colors.border}`,
    borderRadius: 4,
  },
  detailsBoxLeft: {
    marginRight: '2%',
  },
  detailsBoxRight: {
    marginLeft: '2%',
  },
  detailsTitle: {
    fontSize: 8,
    fontWeight: 'bold',
    color: colors.primary,
    marginBottom: 8,
    paddingBottom: 4,
    borderBottom: `1 solid ${colors.border}`,
  },
  detailsRow: {
    flexDirection: 'row',
    marginBottom: 2,
  },
  detailsLabel: {
    width: '30%',
    fontSize: 7,
    color: colors.textLight,
  },
  detailsValue: {
    width: '70%',
    fontSize: 8,
    fontWeight: 'semibold',
  },
  paymentMethod: {
    fontSize: 9,
    fontWeight: 'semibold',
  },

  // ===== DATES SECTION =====
  datesContainer: {
    flexDirection: 'row',
    marginBottom: 14,
  },
  datesBox: {
    width: '48%',
  },
  datesBoxLeft: {
    marginRight: '2%',
  },
  datesBoxRight: {
    marginLeft: '2%',
  },
  dateRow: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  dateLabel: {
    fontSize: 7,
    color: colors.textLight,
    width: '55%',
  },
  dateValue: {
    fontSize: 8,
    fontWeight: 'semibold',
    width: '45%',
  },

  // ===== SIGNATURES SECTION =====
  signaturesContainer: {
    flexDirection: 'row',
    marginTop: 18,
    marginBottom: 14,
  },
  signatureBox: {
    width: '48%',
  },
  signatureBoxLeft: {
    marginRight: '2%',
  },
  signatureBoxRight: {
    marginLeft: '2%',
  },
  signatureLabel: {
    fontSize: 7,
    color: colors.textLight,
    marginBottom: 4,
  },
  signatureName: {
    fontSize: 9,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  signatureLine: {
    borderTop: `1 solid ${colors.borderDark}`,
    paddingTop: 4,
  },
  signatureLineText: {
    fontSize: 7,
    color: colors.textLight,
  },

  // ===== FOOTER =====
  footer: {
    position: 'absolute',
    bottom: 24,
    left: 32,
    right: 32,
  },
  footerDivider: {
    borderTop: `1 solid ${colors.border}`,
    marginBottom: 10,
  },
  footerNote: {
    fontSize: 6.5,
    color: colors.textLight,
    textAlign: 'center',
    lineHeight: 1.4,
  },
  proformaDisclaimer: {
    marginTop: 8,
    padding: 6,
    backgroundColor: '#fff8e1',
    border: '1 solid #ffcc02',
    borderRadius: 3,
    fontSize: 7,
    color: '#7a6000',
    textAlign: 'center',
  },
})

// Types
interface OrderItem {
  product_id?: string
  product_name: string
  sku: string
  quantity: number
  unit_price: number
  total: number
  image_url?: string
}

interface Order {
  id: number | string
  order_number: number
  company_name: string
  email: string
  phone: string | null
  address?: string | null
  items: OrderItem[]
  total: number
  created_at: string
}

interface SupplierInfo {
  name: string
  address: string
  city?: string
  phone?: string
  email?: string
  eik?: string
  vatNumber?: string
  mol?: string
  bankName?: string
  iban?: string
  bic?: string
}

interface BuyerInfo {
  companyName: string
  eik?: string
  vatNumber?: string
  address?: string
  city?: string
  email?: string
  phone?: string
  mol?: string
}

interface ProformaSettings {
  currency?: 'EUR' | 'BGN'
  vatRate?: number
  showOriginal?: boolean
  transactionPlace?: string
}

export interface ProformaInvoicePDFProps {
  order: Order
  supplier: SupplierInfo
  buyer?: BuyerInfo
  settings?: ProformaSettings
}

// Helper functions
function formatDateBG(dateString: string): string {
  const date = new Date(dateString)
  const day = date.getDate().toString().padStart(2, '0')
  const month = (date.getMonth() + 1).toString().padStart(2, '0')
  const year = date.getFullYear()
  return `${day}.${month}.${year} г.`
}

// Currency formatting is handled inline for better control

function parseCityFromAddress(address: string): { city: string; addressWithoutCity: string } {
  if (!address) return { city: '—', addressWithoutCity: '—' }
  const parts = address.split(',').map(p => p.trim())
  if (parts.length >= 2) {
    const cityIndex = parts.length >= 3 ? parts.length - 2 : parts.length - 1
    const city = parts[cityIndex]
    const addressWithoutCity = parts.filter((_, i) => i !== cityIndex).join(', ')
    return { city, addressWithoutCity }
  }
  return { city: '—', addressWithoutCity: address }
}

export function ProformaInvoicePDF({
  order,
  supplier,
  buyer,
  settings = {},
}: ProformaInvoicePDFProps) {
  // Ensure we always have a supplier object
  const safeSupplier: SupplierInfo = supplier || { name: '—', address: '' }

  const currency = settings.currency || 'EUR'
  const vatRate = settings.vatRate ?? 0.2
  const showOriginal = settings.showOriginal ?? true
  const transactionPlace = settings.transactionPlace || safeSupplier.city || 'София'

  // Calculate totals
  const subtotal = order.items.reduce((sum, item) => sum + item.total, 0)
  const vatAmount = subtotal * vatRate
  const grandTotal = subtotal + vatAmount

  // Parse supplier city
  const supplierParsed = safeSupplier.city
    ? { city: safeSupplier.city, addressWithoutCity: safeSupplier.address }
    : parseCityFromAddress(safeSupplier.address || '')

  // Parse buyer info
  const buyerInfo: BuyerInfo = buyer || {
    companyName: order.company_name,
    email: order.email,
    phone: order.phone || undefined,
    address: order.address || undefined,
  }

  const buyerParsed = buyerInfo.city
    ? { city: buyerInfo.city, addressWithoutCity: buyerInfo.address || '—' }
    : parseCityFromAddress(buyerInfo.address || '')

  // Amount in words
  const amountInWords = amountToWordsBgEur(grandTotal)

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* ===== HEADER ===== */}
        <View style={styles.headerContainer}>
          <View style={styles.headerTop}>
            <View style={styles.headerLeft}>
              {showOriginal && <Text style={styles.originalBadge}>Оригинал</Text>}
              <Text style={styles.invoiceTitle}>Фактура</Text>
              <Text style={styles.invoiceNumber}>No:{order.order_number}</Text>
            </View>
            <View style={styles.headerRight}>
              <View style={styles.totalPreviewBox}>
                <Text style={styles.totalPreviewLabel}>Сума за плащане:</Text>
                <Text style={styles.totalPreviewAmount}>
                  {grandTotal.toFixed(2)} {currency}
                </Text>
              </View>
            </View>
          </View>
          <View style={styles.headerDivider} />
        </View>

        {/* ===== PARTIES: Buyer & Supplier ===== */}
        <View style={styles.partiesContainer}>
          {/* Получател (Buyer) */}
          <View style={[styles.partyBox, styles.partyBoxLeft]}>
            <Text style={styles.partyTitle}>Получател</Text>
            <View style={styles.partyRow}>
              <Text style={styles.partyLabel}>Име на фирма:</Text>
              <Text style={styles.partyValue}>{buyerInfo.companyName}</Text>
            </View>
            <View style={styles.partyRow}>
              <Text style={styles.partyLabel}>ЕИК:</Text>
              <Text style={styles.partyValue}>{buyerInfo.eik || '—'}</Text>
            </View>
            <View style={styles.partyRow}>
              <Text style={styles.partyLabel}>ДДС No:</Text>
              <Text style={styles.partyValue}>{buyerInfo.vatNumber || '—'}</Text>
            </View>
            <View style={styles.partyRow}>
              <Text style={styles.partyLabel}>Град:</Text>
              <Text style={styles.partyValue}>{buyerParsed.city}</Text>
            </View>
            <View style={styles.partyRow}>
              <Text style={styles.partyLabel}>Адрес:</Text>
              <Text style={styles.partyValue}>{buyerParsed.addressWithoutCity}</Text>
            </View>
            <View style={styles.partyRow}>
              <Text style={styles.partyLabel}>МОЛ:</Text>
              <Text style={styles.partyValue}>{buyerInfo.mol || buyerInfo.companyName}</Text>
            </View>
          </View>

          {/* Доставчик (Supplier) */}
          <View style={[styles.partyBox, styles.partyBoxRight]}>
            <Text style={styles.partyTitle}>Доставчик</Text>
            <View style={styles.partyRow}>
              <Text style={styles.partyLabel}>Име на фирма:</Text>
              <Text style={styles.partyValue}>{safeSupplier.name}</Text>
            </View>
            <View style={styles.partyRow}>
              <Text style={styles.partyLabel}>ЕИК:</Text>
              <Text style={styles.partyValue}>{safeSupplier.eik || '—'}</Text>
            </View>
            <View style={styles.partyRow}>
              <Text style={styles.partyLabel}>ДДС No:</Text>
              <Text style={styles.partyValue}>{safeSupplier.vatNumber || '—'}</Text>
            </View>
            <View style={styles.partyRow}>
              <Text style={styles.partyLabel}>Град:</Text>
              <Text style={styles.partyValue}>{supplierParsed.city}</Text>
            </View>
            <View style={styles.partyRow}>
              <Text style={styles.partyLabel}>Адрес:</Text>
              <Text style={styles.partyValue}>{supplierParsed.addressWithoutCity}</Text>
            </View>
            <View style={styles.partyRow}>
              <Text style={styles.partyLabel}>МОЛ:</Text>
              <Text style={styles.partyValue}>{safeSupplier.mol || '—'}</Text>
            </View>
          </View>
        </View>

        {/* ===== ITEMS TABLE ===== */}
        <View style={styles.tableContainer}>
          <View style={styles.table}>
            {/* Table Header */}
            <View style={styles.tableHeader}>
              <Text style={[styles.tableHeaderCell, styles.colNo]}>No</Text>
              <Text style={[styles.tableHeaderCell, styles.colName]}>Име на стоката/услугата</Text>
              <Text style={[styles.tableHeaderCell, styles.colUnit]}>Мярка</Text>
              <Text style={[styles.tableHeaderCell, styles.colQty]}>К-во</Text>
              <Text style={[styles.tableHeaderCell, styles.colPrice]}>Ед. цена</Text>
              <Text style={[styles.tableHeaderCell, styles.colBase]}>Дан. основа</Text>
              <Text style={[styles.tableHeaderCell, styles.colVat]}>ДДС (%)</Text>
              <Text style={[styles.tableHeaderCell, styles.colTotal]}>Стойност</Text>
            </View>

            {/* Table Rows */}
            {order.items.map((item, index) => {
              const lineSubtotal = item.quantity * item.unit_price
              const lineVat = lineSubtotal * vatRate
              const lineTotal = lineSubtotal + lineVat
              const isLast = index === order.items.length - 1
              const isAlt = index % 2 === 1

              return (
                <View
                  key={index}
                  style={[
                    styles.tableRow,
                    isAlt ? styles.tableRowAlt : {},
                    isLast ? styles.tableRowLast : {},
                  ]}
                >
                  <Text style={[styles.tableCell, styles.colNo]}>{index + 1}</Text>
                  <View style={[styles.tableCell, styles.colName]}>
                    <Text>{item.product_name}</Text>
                    <Text style={styles.productSku}>SKU: {item.sku}</Text>
                  </View>
                  <Text style={[styles.tableCell, styles.colUnit]}>бр.</Text>
                  <Text style={[styles.tableCell, styles.colQty]}>{item.quantity}</Text>
                  <Text style={[styles.tableCell, styles.colPrice]}>
                    {item.unit_price.toFixed(2)}
                  </Text>
                  <Text style={[styles.tableCell, styles.colBase]}>{lineSubtotal.toFixed(2)}</Text>
                  <Text style={[styles.tableCell, styles.colVat]}>
                    {vatRate > 0 ? `${(vatRate * 100).toFixed(2)}%` : '—'}
                  </Text>
                  <Text style={[styles.tableCell, styles.colTotal]}>{lineTotal.toFixed(2)}</Text>
                </View>
              )
            })}
          </View>
        </View>

        {/* ===== TOTALS ===== */}
        <View style={styles.totalsContainer}>
          <View style={styles.totalsBox}>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Данъчна основа ({(vatRate * 100).toFixed(2)} %):</Text>
              <Text style={styles.totalValue}>{subtotal.toFixed(2)} {currency}</Text>
            </View>
            {vatRate > 0 && (
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Начислен ДДС ({(vatRate * 100).toFixed(2)} %):</Text>
                <Text style={styles.totalValue}>{vatAmount.toFixed(2)} {currency}</Text>
              </View>
            )}
            <View style={[styles.totalRow, styles.totalRowGrand]}>
              <Text style={[styles.totalLabel, styles.totalLabelGrand]}>Сума за плащане:</Text>
              <Text style={[styles.totalValue, styles.totalValueGrand]}>
                {grandTotal.toFixed(2)} {currency}
              </Text>
            </View>
          </View>
        </View>

        {/* ===== SLOVOM ===== */}
        <View style={styles.slovomBox}>
          <Text style={styles.slovomLabel}>Словом:</Text>
          <Text style={styles.slovomText}>{amountInWords}</Text>
        </View>

        {/* ===== PAYMENT & BANK DETAILS ===== */}
        <View style={styles.detailsContainer}>
          <View style={[styles.detailsBox, styles.detailsBoxLeft]}>
            <Text style={styles.detailsTitle}>Начин на плащане:</Text>
            <Text style={styles.paymentMethod}>Банков път</Text>
          </View>
          <View style={[styles.detailsBox, styles.detailsBoxRight]}>
            <Text style={styles.detailsTitle}>Банкови реквизити:</Text>
            <View style={styles.detailsRow}>
              <Text style={styles.detailsLabel}>Банка:</Text>
              <Text style={styles.detailsValue}>{safeSupplier.bankName || '—'}</Text>
            </View>
            <View style={styles.detailsRow}>
              <Text style={styles.detailsLabel}>BIC:</Text>
              <Text style={styles.detailsValue}>{safeSupplier.bic || '—'}</Text>
            </View>
            <View style={styles.detailsRow}>
              <Text style={styles.detailsLabel}>IBAN:</Text>
              <Text style={styles.detailsValue}>{safeSupplier.iban || '—'}</Text>
            </View>
          </View>
        </View>

        {/* ===== DATES ===== */}
        <View style={styles.datesContainer}>
          <View style={[styles.datesBox, styles.datesBoxLeft]}>
            <View style={styles.dateRow}>
              <Text style={styles.dateLabel}>Дата на издаване:</Text>
              <Text style={styles.dateValue}>{formatDateBG(order.created_at)}</Text>
            </View>
            <View style={styles.dateRow}>
              <Text style={styles.dateLabel}>Дата на дан. събитие:</Text>
              <Text style={styles.dateValue}>{formatDateBG(order.created_at)}</Text>
            </View>
            <View style={styles.dateRow}>
              <Text style={styles.dateLabel}>Място на сделката:</Text>
              <Text style={styles.dateValue}>{transactionPlace}</Text>
            </View>
          </View>
          <View style={[styles.datesBox, styles.datesBoxRight]}>
            <View style={styles.dateRow}>
              <Text style={styles.dateLabel}>Основание на сделка по ЗДДС:</Text>
              <Text style={styles.dateValue}></Text>
            </View>
          </View>
        </View>

        {/* ===== SIGNATURES ===== */}
        <View style={styles.signaturesContainer}>
          <View style={[styles.signatureBox, styles.signatureBoxLeft]}>
            <Text style={styles.signatureLabel}>Получател:</Text>
            <Text style={styles.signatureName}>{buyerInfo.mol || buyerInfo.companyName}</Text>
            <View style={styles.signatureLine}>
              <Text style={styles.signatureLineText}>Подпис: .................................................</Text>
            </View>
          </View>
          <View style={[styles.signatureBox, styles.signatureBoxRight]}>
            <Text style={styles.signatureLabel}>Съставил:</Text>
            <Text style={styles.signatureName}>{safeSupplier.mol || safeSupplier.name}</Text>
            <View style={styles.signatureLine}>
              <Text style={styles.signatureLineText}>Подпис: .................................................</Text>
            </View>
          </View>
        </View>

        {/* ===== FOOTER ===== */}
        <View style={styles.footer}>
          <View style={styles.footerDivider} />
          <Text style={styles.footerNote}>
            Съгласно чл.6, ал 1 от Закона за счетоводството, чл.114 от ЗДДС и чл.78 от ППЗДДС 
            печатът и подписът не са задължителни реквизити на фактурата.
          </Text>
          <View style={styles.proformaDisclaimer}>
            <Text>
              ПРОФОРМА ФАКТУРА – Този документ е проформа фактура и не представлява данъчен документ. 
              Цените и наличностите са примерни и могат да се променят. Валидна е 30 дни от датата на издаване.
            </Text>
          </View>
        </View>
      </Page>
    </Document>
  )
}
