/**
 * CSV Distributor Presets & Detection
 * 
 * This file contains:
 * - Pre-built column mappings for known distributors
 * - Auto-detection algorithms
 * - Category synonym matching
 */

// Standard field names in our system
export const STANDARD_FIELDS = {
  sku: 'sku',
  name: 'name',
  description: 'description',
  category: 'category',
  subcategory: 'subcategory',
  manufacturer: 'manufacturer',
  model: 'model',
  retail_price: 'retail_price',
  wholesale_price: 'wholesale_price',
  stock: 'stock',
  moq: 'moq',
  weight: 'weight',
  transportational_weight: 'transportational_weight',
  availability: 'availability',
  main_image: 'main_image',
  images: 'images',
  date_expected: 'date_expected',
} as const

export type StandardField = keyof typeof STANDARD_FIELDS

// Required fields for a valid import
export const REQUIRED_FIELDS: StandardField[] = ['sku', 'name']

// Optional but recommended fields
export const RECOMMENDED_FIELDS: StandardField[] = ['wholesale_price', 'category', 'stock', 'main_image', 'description']

// Column name patterns for auto-detection (case-insensitive)
export const COLUMN_PATTERNS: Record<StandardField, string[]> = {
  sku: [
    'sku', 'artikelnummer', 'artnr', 'productcode', 'product_code', 'item_code', 
    'itemcode', 'article_number', 'article', 'artno', 'code', 'product_id',
    'productnumber', 'partnumber', 'part_number', 'barcode', 'barcodemain'
  ],
  name: [
    'name', 'productname', 'product_name', 'titel', 'title', 'bezeichnung',
    'product', 'item_name', 'itemname', 'description_short', 'produktname'
  ],
  description: [
    'description', 'beschreibung', 'desc', 'extended_description', 'extendeddescription',
    'product_description', 'details', 'long_description', 'longdescription', 'text'
  ],
  category: [
    'category', 'kategorie', 'cat', 'product_category', 'productcategory',
    'category_name', 'main_category', 'maincategory', 'categories',
    'categories/category/0/__text', 'category_level_1'
  ],
  subcategory: [
    'subcategory', 'unterkategorie', 'sub_category', 'subcategory_name',
    'categories/category/1/__text', 'category_level_2'
  ],
  manufacturer: [
    'manufacturer', 'hersteller', 'brand', 'marke', 'producer', 'vendor',
    'supplier', 'brand_name', 'brandname', 'mfg', 'mfr'
  ],
  model: [
    'model', 'modell', 'model_number', 'modelnumber', 'model_name',
    'productcode', 'product_code'
  ],
  retail_price: [
    'retail_price', 'retailprice', 'listprice', 'list_price', 'msrp', 'rrp',
    'uvp', 'market_price', 'marketprice', 'retailcurrentprice', 'suggested_price'
  ],
  wholesale_price: [
    'wholesale_price', 'wholesaleprice', 'weboffer_price', 'webofferprice',
    'price', 'preis', 'verkaufspreis', 'unit_price', 'unitprice',
    'zonefourunitprice', 'buy_price', 'buyprice', 'cost', 'dealer_price',
    'net_price', 'netprice', 'trade_price'
  ],
  stock: [
    'stock', 'quantity', 'qty', 'lagerbestand', 'bestand', 'inventory',
    'available', 'in_stock', 'instock', 'on_hand', 'onhand', 'amount'
  ],
  moq: [
    'moq', 'minquantity', 'min_quantity', 'minimum_order', 'minimumorder',
    'min_qty', 'minqty', 'minimum_quantity'
  ],
  weight: [
    'weight', 'gewicht', 'kg', 'weight_kg', 'product_weight', 'productweight',
    'gross_weight', 'net_weight', 'netweight'
  ],
  transportational_weight: [
    'transportational_weight', 'shipping_weight', 'volumetric_weight',
    'volumetricweight', 'dim_weight', 'dimensional_weight'
  ],
  availability: [
    'availability', 'verfügbarkeit', 'status', 'stock_status', 'stockstatus',
    'availabilitytypename', 'in_stock', 'available'
  ],
  main_image: [
    'main_image', 'mainimage', 'image', 'bild', 'product_image', 'productimage',
    'primary_image', 'primaryimage', 'thumbnail', 'picture', 'photo',
    'imageslocation/image/0', 'image_url', 'imageurl', 'bild_url'
  ],
  images: [
    'images', 'additional_images', 'gallery', 'more_images', 'image1', 'image2',
    'imageslocation/image/1', 'imageslocation/image/2', 'imageslocation/image/3',
    'imageslocation/image/4', 'imageslocation/image/5', 'imageslocation/image/6',
    'imageslocation/image/7', 'imageslocation/image/8', 'imageslocation/image/9',
    'imageslocation/image/10'
  ],
  date_expected: [
    'date_expected', 'expected_date', 'arrival_date', 'delivery_date',
    'deliverydate', 'eta', 'restock_date'
  ],
}

// Distributor preset interface
export interface DistributorPreset {
  name: string
  displayName: string
  columnMappings: Record<string, StandardField | 'ignore'>
  categoryMappings: Record<string, string>
  detectionPatterns: {
    requiredColumns?: string[]
    delimiter?: string
    manufacturerHint?: string
    urlPattern?: string
    headerPatterns?: string[]
  }
  confidence: number // 0-100
  matchPercentage: {
    columns: number
    categories: number
  }
}

// Pre-built distributor presets
export const DISTRIBUTOR_PRESETS: DistributorPreset[] = [
  {
    name: 'megapap',
    displayName: 'Megapap',
    columnMappings: {
      id: 'ignore',
      model: 'model',
      sku: 'sku',
      retail_price: 'retail_price',
      weboffer_price: 'wholesale_price',
      name: 'name',
      category: 'category',
      manufacturer: 'manufacturer',
      description: 'description',
      availability: 'availability',
      quantity: 'stock',
      weight: 'weight',
      transportational_weight: 'transportational_weight',
      date_expected: 'date_expected',
      main_image: 'main_image',
      image1: 'images',
      image2: 'images',
      image3: 'images',
      image4: 'images',
      image5: 'images',
      image6: 'images',
      image7: 'images',
      image8: 'images',
      image9: 'images',
      image10: 'images',
    },
    categoryMappings: {},
    detectionPatterns: {
      requiredColumns: ['sku', 'weboffer_price', 'name'],
      delimiter: ';',
      manufacturerHint: 'MEGAPAP',
      urlPattern: 'megapap.com',
      headerPatterns: ['weboffer_price', 'transportational_weight', 'main_image'],
    },
    confidence: 100,
    matchPercentage: { columns: 100, categories: 98 },
  },
  {
    name: 'b2bmarkt',
    displayName: 'B2BMarkt',
    columnMappings: {
      // Lowercase versions (after parser normalization)
      productid: 'ignore',
      productcode: 'model',
      itemcode: 'sku',
      name: 'name',
      extendeddescription: 'description',
      'imageslocation/image/0': 'main_image',
      'imageslocation/image/1': 'images',
      'imageslocation/image/2': 'images',
      'imageslocation/image/3': 'images',
      'imageslocation/image/4': 'images',
      'imageslocation/image/5': 'images',
      'imageslocation/image/6': 'images',
      'imageslocation/image/7': 'images',
      'imageslocation/image/8': 'images',
      'imageslocation/image/9': 'images',
      'imageslocation/image/10': 'images',
      stock: 'stock',
      minquantity: 'moq',
      zonefourunitprice: 'wholesale_price',
      retailcurrentprice: 'retail_price',
      marketprice: 'ignore',
      weight: 'weight',
      volumetricweight: 'transportational_weight',
      'categories/category/0/__text': 'category',
      'categories/category/1/__text': 'subcategory',
      availabilitytypename: 'availability',
      barcodemain: 'sku', // Alternative SKU field
      // Ignore relationship columns
      'relatedcolors/relation/0/color/_id': 'ignore',
      'relatedcolors/relation/0/color/__text': 'ignore',
      'packs/_xsi:nil': 'ignore',
      'videoslocation/_xsi:nil': 'ignore',
      'pdfslocation/_xsi:nil': 'ignore',
      'deliverydate/_xsi:nil': 'ignore',
    },
    categoryMappings: {
      'Декорация': 'Decoration',
      'Щори-Завеси-Завесни пръчки-Комарници': 'Blinds & Curtains',
      'Градина и Тераса': 'Garden & Outdoor',
      'Мебели': 'Furniture',
      'Осветление': 'Lighting',
      'Текстил': 'Textiles',
    },
    detectionPatterns: {
      requiredColumns: ['productcode', 'name', 'zonefourunitprice'],
      delimiter: ',',
      urlPattern: 'b2bmarkt.gr',
      headerPatterns: ['zonefourunitprice', 'productcode', 'availabilitytypename', 'itemcode'],
    },
    confidence: 95,
    matchPercentage: { columns: 95, categories: 92 },
  },
  {
    name: 'ikea',
    displayName: 'IKEA',
    columnMappings: {
      product_id: 'sku',
      product_name: 'name',
      price: 'wholesale_price',
      original_price: 'retail_price',
      category: 'category',
      description: 'description',
      image_url: 'main_image',
      in_stock: 'availability',
      quantity: 'stock',
    },
    categoryMappings: {
      'Furniture': 'Furniture',
      'Storage & organisation': 'Storage',
      'Kitchen & dining': 'Kitchen',
      'Bedroom': 'Bedroom',
      'Living room': 'Living Room',
      'Bathroom': 'Bathroom',
      'Outdoor': 'Outdoor',
      'Office furniture': 'Office',
    },
    detectionPatterns: {
      requiredColumns: ['product_id', 'product_name', 'price'],
      headerPatterns: ['product_id', 'original_price'],
    },
    confidence: 88,
    matchPercentage: { columns: 88, categories: 85 },
  },
  {
    name: 'shopify',
    displayName: 'Shopify',
    columnMappings: {
      title: 'name',
      url_handle: 'ignore',
      description: 'description',
      vendor: 'manufacturer',
      product_category: 'category',
      type: 'subcategory',
      tags: 'ignore',
      published_on_online_store: 'ignore',
      status: 'availability',
      sku: 'sku',
      barcode: 'ignore',
      price: 'wholesale_price',
      'compare-at_price': 'retail_price',
      inventory_tracker: 'ignore',
      inventory_quantity: 'stock',
      continue_selling_when_out_of_stock: 'ignore',
      'weight_value_(grams)': 'weight',
      weight_unit_for_display: 'ignore',
      requires_shipping: 'ignore',
      fulfillment_service: 'ignore',
      product_image_url: 'main_image',
      image_position: 'ignore',
      image_alt_text: 'ignore',
      variant_image_url: 'images',
      gift_card: 'ignore',
      seo_title: 'ignore',
      seo_description: 'ignore',
    },
    categoryMappings: {},
    detectionPatterns: {
      requiredColumns: ['title', 'sku', 'product_image_url'],
      headerPatterns: ['url_handle', 'variant_image_url', 'inventory_quantity', 'image_position'],
      manufacturerHint: 'Shopify',
    },
    confidence: 96,
    matchPercentage: { columns: 94, categories: 80 },
  },
  {
    name: 'generic',
    displayName: 'Generic CSV',
    columnMappings: {},
    categoryMappings: {},
    detectionPatterns: {},
    confidence: 75,
    matchPercentage: { columns: 75, categories: 70 },
  },
]

// German category synonyms for auto-matching
export const GERMAN_CATEGORY_SYNONYMS: Record<string, string[]> = {
  'Wardrobes': ['Kleiderschrank', 'Kleiderschränke', 'Garderobenschrank', 'Garderobe'],
  'Living Room': ['Wohnzimmer', 'Wohnbereich'],
  'Bedroom': ['Schlafzimmer', 'Schlafbereich'],
  'Kitchen Cabinets': ['Küchenschrank', 'Küchenschränke', 'Küchenzeile'],
  'Kitchen': ['Küche'],
  'Dining Room': ['Esszimmer', 'Essbereich', 'Esstisch'],
  'Office': ['Büro', 'Arbeitszimmer', 'Home Office', 'Homeoffice'],
  'Office Desks': ['Schreibtisch', 'Schreibtische', 'Bürotisch', 'Computertisch'],
  'Chairs': ['Stühle', 'Stuhl', 'Sessel', 'Sitzmöbel'],
  'Office Chairs': ['Bürostuhl', 'Bürostühle', 'Drehstuhl', 'Chefsessel'],
  'Sofas': ['Sofa', 'Sofas', 'Couch', 'Polstermöbel', 'Sitzgarnitur'],
  'Tables': ['Tisch', 'Tische'],
  'Coffee Tables': ['Couchtisch', 'Couchtische', 'Beistelltisch', 'Wohnzimmertisch'],
  'Dining Tables': ['Esstisch', 'Esstische', 'Esszimmertisch'],
  'Beds': ['Bett', 'Betten', 'Schlafmöbel'],
  'Bookcases': ['Bücherregal', 'Bücherregale', 'Bücherschrank'],
  'Shelves': ['Regal', 'Regale', 'Wandregal', 'Standregal'],
  'Shoe Cabinets': ['Schuhschrank', 'Schuhschränke', 'Schuhregal'],
  'TV Stands': ['TV-Schrank', 'TV-Möbel', 'Fernsehschrank', 'Medienmöbel'],
  'Bathroom': ['Badezimmer', 'Bad', 'Badmöbel'],
  'Outdoor': ['Außenbereich', 'Garten', 'Terrasse', 'Balkon'],
  'Garden Furniture': ['Gartenmöbel', 'Gartenstuhl', 'Gartentisch', 'Gartenliege'],
  'Storage': ['Aufbewahrung', 'Stauraum', 'Kommoden', 'Schrank'],
  'Decoration': ['Dekoration', 'Deko', 'Accessoires'],
}

// Bulgarian category synonyms
export const BULGARIAN_CATEGORY_SYNONYMS: Record<string, string[]> = {
  'Decoration': ['Декорация'],
  'Blinds': ['Щори'],
  'Curtains': ['Завеси', 'Пердета'],
  'Garden': ['Градина', 'Градински'],
  'Outdoor': ['Външни', 'Тераса'],
  'Furniture': ['Мебели'],
  'Lighting': ['Осветление', 'Лампи'],
  'Textiles': ['Текстил'],
}

// Greek category synonyms  
export const GREEK_CATEGORY_SYNONYMS: Record<string, string[]> = {
  'Wardrobes': ['Ντουλάπες', 'Ντουλάπα'],
  'Living Room': ['Σαλόνι'],
  'Bedroom': ['Υπνοδωμάτιο', 'Κρεβατοκάμαρα'],
  'Kitchen': ['Κουζίνα'],
  'Office': ['Γραφείο'],
  'Chairs': ['Καρέκλες', 'Καρέκλα'],
  'Tables': ['Τραπέζια', 'Τραπέζι'],
  'Beds': ['Κρεβάτια', 'Κρεβάτι'],
  'Storage': ['Αποθήκευση'],
  'Shoe Racks': ['Παπουτσοθήκες', 'Παπουτσοθήκη'],
  'Outdoor': ['Εξωτερικός χώρος', 'Κήπος', 'Μπαλκόνι'],
  'Garden Furniture': ['Έπιπλα κήπου'],
}

// Combine all synonyms for lookup
export const ALL_CATEGORY_SYNONYMS = {
  ...GERMAN_CATEGORY_SYNONYMS,
  ...BULGARIAN_CATEGORY_SYNONYMS,
  ...GREEK_CATEGORY_SYNONYMS,
}

/**
 * Detect distributor from CSV headers
 */
export function detectDistributor(headers: string[]): {
  distributor: DistributorPreset
  confidence: number
  matchedPatterns: string[]
} {
  const normalizedHeaders = headers.map(h => h.toLowerCase().trim())
  let bestMatch: DistributorPreset = DISTRIBUTOR_PRESETS.find(p => p.name === 'generic')!
  let bestScore = 0
  let matchedPatterns: string[] = []

  for (const preset of DISTRIBUTOR_PRESETS) {
    if (preset.name === 'generic') continue

    let score = 0
    const matched: string[] = []
    const patterns = preset.detectionPatterns

    // Check required columns
    if (patterns.requiredColumns) {
      const requiredMatches = patterns.requiredColumns.filter(col =>
        normalizedHeaders.includes(col.toLowerCase())
      )
      if (requiredMatches.length === patterns.requiredColumns.length) {
        score += 50
        matched.push(...requiredMatches)
      } else if (requiredMatches.length > 0) {
        score += (requiredMatches.length / patterns.requiredColumns.length) * 30
        matched.push(...requiredMatches)
      }
    }

    // Check header patterns
    if (patterns.headerPatterns) {
      const headerMatches = patterns.headerPatterns.filter(pattern =>
        normalizedHeaders.some(h => h.includes(pattern.toLowerCase()))
      )
      if (headerMatches.length > 0) {
        score += (headerMatches.length / patterns.headerPatterns.length) * 30
        matched.push(...headerMatches)
      }
    }

    // Check column mapping matches
    const mappingKeys = Object.keys(preset.columnMappings).map(k => k.toLowerCase())
    const mappingMatches = mappingKeys.filter(key => normalizedHeaders.includes(key))
    if (mappingMatches.length > 0) {
      score += (mappingMatches.length / mappingKeys.length) * 20
    }

    if (score > bestScore) {
      bestScore = score
      bestMatch = preset
      matchedPatterns = matched
    }
  }

  // Calculate confidence percentage
  const confidence = Math.min(Math.round(bestScore), 100)

  return {
    distributor: bestMatch,
    confidence,
    matchedPatterns,
  }
}

/**
 * Auto-map columns from source CSV to standard fields
 */
export function autoMapColumns(
  headers: string[],
  distributorPreset?: DistributorPreset
): Record<string, { field: StandardField | 'ignore' | null; confidence: number; autoMatched: boolean }> {
  const mappings: Record<string, { field: StandardField | 'ignore' | null; confidence: number; autoMatched: boolean }> = {}

  for (const header of headers) {
    const normalizedHeader = header.toLowerCase().trim().replace(/\s+/g, '_')
    let bestMatch: StandardField | 'ignore' | null = null
    let bestConfidence = 0
    let autoMatched = false

    // First, check if distributor preset has a mapping
    if (distributorPreset && distributorPreset.columnMappings[header]) {
      const presetMapping = distributorPreset.columnMappings[header]
      bestMatch = presetMapping
      bestConfidence = 95
      autoMatched = true
    } else if (distributorPreset && distributorPreset.columnMappings[normalizedHeader]) {
      const presetMapping = distributorPreset.columnMappings[normalizedHeader]
      bestMatch = presetMapping
      bestConfidence = 95
      autoMatched = true
    } else {
      // Fall back to pattern matching
      for (const [field, patterns] of Object.entries(COLUMN_PATTERNS)) {
        for (const pattern of patterns) {
          const normalizedPattern = pattern.toLowerCase()
          
          // Exact match
          if (normalizedHeader === normalizedPattern) {
            bestMatch = field as StandardField
            bestConfidence = 100
            autoMatched = true
            break
          }
          
          // Contains match
          if (normalizedHeader.includes(normalizedPattern) || normalizedPattern.includes(normalizedHeader)) {
            const matchScore = 70 + (Math.min(normalizedHeader.length, normalizedPattern.length) / 
                               Math.max(normalizedHeader.length, normalizedPattern.length)) * 25
            if (matchScore > bestConfidence) {
              bestMatch = field as StandardField
              bestConfidence = matchScore
              autoMatched = true
            }
          }
        }
        if (bestConfidence === 100) break
      }
    }

    // Check for image columns (image1, image2, etc.)
    if (!bestMatch && /^image\d+$/.test(normalizedHeader)) {
      bestMatch = 'images'
      bestConfidence = 95
      autoMatched = true
    }

    // Check for attribute columns (to ignore)
    if (!bestMatch && normalizedHeader.includes('attribute')) {
      bestMatch = 'ignore'
      bestConfidence = 90
      autoMatched = true
    }

    mappings[header] = {
      field: bestMatch,
      confidence: Math.round(bestConfidence),
      autoMatched,
    }
  }

  return mappings
}

/**
 * Match a foreign category name to standard categories
 */
export function matchCategory(
  foreignCategory: string,
  distributorCategoryMappings: Record<string, string> = {},
  customMappings: Record<string, string> = {}
): { standardCategory: string; confidence: number; method: 'exact' | 'saved' | 'synonym' | 'fuzzy' | 'manual' } {
  const trimmedCategory = foreignCategory.trim()
  
  // 1. Check exact match with standard category names
  const standardCategories = Object.keys(ALL_CATEGORY_SYNONYMS)
  for (const stdCat of standardCategories) {
    if (stdCat.toLowerCase() === trimmedCategory.toLowerCase()) {
      return { standardCategory: stdCat, confidence: 100, method: 'exact' }
    }
  }

  // 2. Check saved mappings for this distributor
  if (distributorCategoryMappings[trimmedCategory]) {
    return {
      standardCategory: distributorCategoryMappings[trimmedCategory],
      confidence: 98,
      method: 'saved',
    }
  }

  // 3. Check custom user mappings
  if (customMappings[trimmedCategory]) {
    return {
      standardCategory: customMappings[trimmedCategory],
      confidence: 97,
      method: 'saved',
    }
  }

  // 4. Check synonym matching
  for (const [stdCategory, synonyms] of Object.entries(ALL_CATEGORY_SYNONYMS)) {
    for (const synonym of synonyms) {
      if (synonym.toLowerCase() === trimmedCategory.toLowerCase()) {
        return { standardCategory: stdCategory, confidence: 95, method: 'synonym' }
      }
      // Partial match
      if (synonym.toLowerCase().includes(trimmedCategory.toLowerCase()) ||
          trimmedCategory.toLowerCase().includes(synonym.toLowerCase())) {
        return { standardCategory: stdCategory, confidence: 80, method: 'fuzzy' }
      }
    }
  }

  // 5. Fuzzy matching on category parts (split by > or /)
  const categoryParts = trimmedCategory.split(/[>/]/).map(p => p.trim())
  for (const part of categoryParts) {
    if (!part) continue
    for (const [stdCategory, synonyms] of Object.entries(ALL_CATEGORY_SYNONYMS)) {
      if (stdCategory.toLowerCase() === part.toLowerCase()) {
        return { standardCategory: stdCategory, confidence: 85, method: 'fuzzy' }
      }
      for (const synonym of synonyms) {
        if (synonym.toLowerCase() === part.toLowerCase()) {
          return { standardCategory: stdCategory, confidence: 80, method: 'fuzzy' }
        }
      }
    }
  }

  // 6. No match found - return as uncategorized for manual review
  return { standardCategory: 'Uncategorized', confidence: 0, method: 'manual' }
}

/**
 * Extract unique categories from CSV data and match them
 */
export function extractAndMatchCategories(
  data: Record<string, unknown>[],
  categoryColumn: string,
  distributorCategoryMappings: Record<string, string> = {},
  customMappings: Record<string, string> = {}
): Array<{
  sourceCategory: string
  standardCategory: string
  productCount: number
  confidence: number
  method: 'exact' | 'saved' | 'synonym' | 'fuzzy' | 'manual'
}> {
  // Count products per category
  const categoryCounts: Record<string, number> = {}
  
  for (const row of data) {
    const category = row[categoryColumn]
    if (typeof category === 'string' && category.trim()) {
      const trimmedCat = category.trim()
      categoryCounts[trimmedCat] = (categoryCounts[trimmedCat] || 0) + 1
    }
  }

  // Match each unique category
  const results: Array<{
    sourceCategory: string
    standardCategory: string
    productCount: number
    confidence: number
    method: 'exact' | 'saved' | 'synonym' | 'fuzzy' | 'manual'
  }> = []

  for (const [sourceCategory, count] of Object.entries(categoryCounts)) {
    const match = matchCategory(sourceCategory, distributorCategoryMappings, customMappings)
    results.push({
      sourceCategory,
      standardCategory: match.standardCategory,
      productCount: count,
      confidence: match.confidence,
      method: match.method,
    })
  }

  // Sort by product count (most products first)
  return results.sort((a, b) => b.productCount - a.productCount)
}

/**
 * Get validation status for column mappings
 */
export function validateColumnMappings(
  mappings: Record<string, { field: StandardField | 'ignore' | null; confidence: number; autoMatched: boolean }>
): {
  isValid: boolean
  missingRequired: StandardField[]
  missingRecommended: StandardField[]
  duplicateMappings: Array<{ field: StandardField; columns: string[] }>
  totalMapped: number
  totalColumns: number
} {
  const mappedFields = new Set<StandardField>()
  const fieldToColumns = new Map<StandardField, string[]>()
  let totalMapped = 0

  // Track which columns map to which fields
  for (const [column, mapping] of Object.entries(mappings)) {
    if (mapping.field && mapping.field !== 'ignore') {
      mappedFields.add(mapping.field as StandardField)
      totalMapped++
      
      // Track columns per field to detect duplicates
      if (!fieldToColumns.has(mapping.field as StandardField)) {
        fieldToColumns.set(mapping.field as StandardField, [])
      }
      fieldToColumns.get(mapping.field as StandardField)!.push(column)
    }
  }

  const missingRequired = REQUIRED_FIELDS.filter(f => !mappedFields.has(f))
  const missingRecommended = RECOMMENDED_FIELDS.filter(f => !mappedFields.has(f))
  
  // Find duplicate mappings (fields mapped to multiple columns)
  const duplicateMappings: Array<{ field: StandardField; columns: string[] }> = []
  for (const [field, columns] of fieldToColumns.entries()) {
    // Required fields and unique fields should only be mapped once
    if (REQUIRED_FIELDS.includes(field) || UNIQUE_FIELDS.includes(field)) {
      if (columns.length > 1) {
        duplicateMappings.push({ field, columns })
      }
    }
  }

  // Validation fails if:
  // 1. Required fields are missing
  // 2. Required/unique fields are mapped multiple times
  const isValid = missingRequired.length === 0 && duplicateMappings.length === 0

  return {
    isValid,
    missingRequired,
    missingRecommended,
    duplicateMappings,
    totalMapped,
    totalColumns: Object.keys(mappings).length,
  }
}

// Fields that should only be mapped once
export const UNIQUE_FIELDS: StandardField[] = ['sku', 'name', 'category', 'subcategory', 'wholesale_price', 'retail_price', 'main_image']
