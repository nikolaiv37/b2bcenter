import { HttpError } from './http.ts'

export type EcontEnvironment = 'demo' | 'prod'
export type EcontPayer = 'SENDER' | 'RECEIVER'

export interface EcontCredentials {
  username: string
  password: string
}

export interface EcontAddressInput {
  countryCode3?: string
  city: string
  postCode?: string
  quarter?: string
  street?: string
  streetNum?: string
  other?: string
}

export interface ShipmentDestinationInput {
  type: 'office' | 'address'
  officeCode?: string
  address?: EcontAddressInput
}

export interface ShipmentReceiverInput {
  name: string
  phone: string
  email?: string | null
}

export interface ShipmentSnapshotInput {
  quoteId?: number | null
  receiver: ShipmentReceiverInput
  destination: ShipmentDestinationInput
  parcelsCount: number
  weightKg: number
  codAmount?: number | null
  declaredValue?: number | null
  payer?: EcontPayer | null
  description?: string | null
}

export interface EcontIntegrationDefaults {
  sender?: {
    name?: string
    phone?: string
    email?: string | null
    officeCode?: string | null
    address?: EcontAddressInput | null
  }
  default_weight_kg?: number
  default_parcels_count?: number
  default_payer?: EcontPayer
  default_cod_enabled?: boolean
  default_declared_value_enabled?: boolean
  tracking_throttle_minutes?: number
  [key: string]: unknown
}

export interface TenantIntegrationRow {
  id: string
  tenant_id: string
  provider: string
  enabled: boolean
  environment: EcontEnvironment
  credentials: Record<string, unknown>
  defaults: EcontIntegrationDefaults
}

export interface ShipmentRow {
  id: string
  tenant_id: string
  quote_id: number | null
  carrier: string
  receiver: Record<string, unknown>
  destination: Record<string, unknown>
  parcels_count: number
  weight_kg: number
  cod_amount: number | null
  declared_value: number | null
  price_amount: number | null
  currency: string | null
  econt_waybill_number: string | null
  econt_label_data: Record<string, unknown> | null
  status: string
  tracking_last_requested_at: string | null
  last_synced_at: string | null
}

export const ECONT_PROVIDER = 'econt'
export const ECONT_BASE_URLS: Record<EcontEnvironment, string> = {
  demo: 'https://demo.econt.com/ee/services/',
  prod: 'https://ee.econt.com/services/',
}

const OFFICES_CACHE_TTL_MS = 30 * 60 * 1000
const econtOfficesCache = new Map<string, { expiresAt: number; offices: Array<Record<string, unknown>> }>()

const DEMO_CREDENTIALS: EcontCredentials = {
  username: 'iasp-dev',
  password: '1Asp-dev',
}

function toBase64(bytes: Uint8Array): string {
  let binary = ''
  for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i])
  return btoa(binary)
}

function fromBase64(value: string): Uint8Array {
  const binary = atob(value)
  const out = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) out[i] = binary.charCodeAt(i)
  return out
}

async function getEncryptionKey() {
  const secret = Deno.env.get('ECONT_CREDENTIALS_ENCRYPTION_KEY')
  if (!secret) {
    throw new HttpError(500, 'Missing server encryption key for Econt credentials')
  }
  const secretBytes = new TextEncoder().encode(secret)
  const hash = await crypto.subtle.digest('SHA-256', secretBytes)
  return crypto.subtle.importKey('raw', hash, 'AES-GCM', false, ['encrypt', 'decrypt'])
}

export async function encryptEcontCredentials(credentials: EcontCredentials) {
  const key = await getEncryptionKey()
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const plaintext = new TextEncoder().encode(JSON.stringify(credentials))
  const ciphertext = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await key, plaintext))
  return {
    v: 1,
    alg: 'AES-GCM',
    iv: toBase64(iv),
    ct: toBase64(ciphertext),
  }
}

export async function decryptEcontCredentials(stored: unknown): Promise<EcontCredentials | null> {
  if (!stored || typeof stored !== 'object') return null
  const record = stored as Record<string, unknown>

  // Backward-compatible plain JSON support (not recommended, but avoids breaking existing rows)
  if (typeof record.username === 'string' && typeof record.password === 'string') {
    return { username: record.username, password: record.password }
  }

  if (typeof record.iv !== 'string' || typeof record.ct !== 'string') return null

  const key = await getEncryptionKey()
  const iv = fromBase64(record.iv)
  const ct = fromBase64(record.ct)
  let plaintext: ArrayBuffer
  try {
    plaintext = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, await key, ct)
  } catch {
    throw new HttpError(500, 'Failed to decrypt Econt credentials')
  }

  try {
    const decoded = JSON.parse(new TextDecoder().decode(plaintext)) as Record<string, unknown>
    if (typeof decoded.username !== 'string' || typeof decoded.password !== 'string') {
      throw new Error('Invalid credentials payload')
    }
    return { username: decoded.username, password: decoded.password }
  } catch {
    throw new HttpError(500, 'Invalid decrypted Econt credentials payload')
  }
}

function normalizeEnvironment(value: unknown): EcontEnvironment {
  return value === 'prod' ? 'prod' : 'demo'
}

function cleanNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

export function clampTrackingThrottleMinutes(value: unknown): number {
  const parsed = Math.round(Number(value))
  if (!Number.isFinite(parsed)) return 10
  return Math.min(15, Math.max(5, parsed))
}

export function normalizeDefaults(input: unknown): EcontIntegrationDefaults {
  const src = input && typeof input === 'object' ? (input as Record<string, unknown>) : {}
  const senderSrc = src.sender && typeof src.sender === 'object' ? (src.sender as Record<string, unknown>) : {}
  const senderAddressSrc = senderSrc.address && typeof senderSrc.address === 'object'
    ? (senderSrc.address as Record<string, unknown>)
    : null

  const defaults: EcontIntegrationDefaults = {
    sender: {
      name: asString(senderSrc.name) ?? undefined,
      phone: asString(senderSrc.phone) ?? undefined,
      email: asString(senderSrc.email),
      officeCode: asString(senderSrc.officeCode),
      address: senderAddressSrc
        ? {
            countryCode3: asString(senderAddressSrc.countryCode3) ?? 'BGR',
            city: asString(senderAddressSrc.city) ?? '',
            postCode: asString(senderAddressSrc.postCode) ?? undefined,
            quarter: asString(senderAddressSrc.quarter) ?? undefined,
            street: asString(senderAddressSrc.street) ?? undefined,
            streetNum: asString(senderAddressSrc.streetNum) ?? undefined,
            other: asString(senderAddressSrc.other) ?? undefined,
          }
        : null,
    },
    default_weight_kg: cleanNumber(src.default_weight_kg) ?? 1,
    default_parcels_count: Math.max(1, Math.round(cleanNumber(src.default_parcels_count) ?? 1)),
    default_payer: src.default_payer === 'RECEIVER' ? 'RECEIVER' : 'SENDER',
    default_cod_enabled: Boolean(src.default_cod_enabled),
    default_declared_value_enabled: Boolean(src.default_declared_value_enabled),
    tracking_throttle_minutes: clampTrackingThrottleMinutes(src.tracking_throttle_minutes),
  }

  return defaults
}

export function parseShipmentInput(body: unknown, defaults?: EcontIntegrationDefaults): ShipmentSnapshotInput {
  const src = body && typeof body === 'object' ? (body as Record<string, unknown>) : null
  if (!src) throw new HttpError(400, 'Request body must be an object')

  const receiver = src.receiver && typeof src.receiver === 'object' ? (src.receiver as Record<string, unknown>) : null
  if (!receiver) throw new HttpError(400, 'receiver is required')

  const destination = src.destination && typeof src.destination === 'object'
    ? (src.destination as Record<string, unknown>)
    : null
  if (!destination) throw new HttpError(400, 'destination is required')

  const destinationType = destination.type === 'office' ? 'office' : destination.type === 'address' ? 'address' : null
  if (!destinationType) throw new HttpError(400, 'destination.type must be office or address')

  let parsedDestination: ShipmentDestinationInput
  if (destinationType === 'office') {
    const officeCode = asString(destination.officeCode)
    if (!officeCode) throw new HttpError(400, 'destination.officeCode is required for office delivery')
    parsedDestination = { type: 'office', officeCode }
  } else {
    const addrSrc = destination.address && typeof destination.address === 'object'
      ? (destination.address as Record<string, unknown>)
      : null
    if (!addrSrc) throw new HttpError(400, 'destination.address is required for address delivery')
    const city = asString(addrSrc.city)
    if (!city) throw new HttpError(400, 'destination.address.city is required')
    parsedDestination = {
      type: 'address',
      address: {
        countryCode3: asString(addrSrc.countryCode3) ?? 'BGR',
        city,
        postCode: asString(addrSrc.postCode) ?? undefined,
        quarter: asString(addrSrc.quarter) ?? undefined,
        street: asString(addrSrc.street) ?? undefined,
        streetNum: asString(addrSrc.streetNum) ?? undefined,
        other: asString(addrSrc.other) ?? undefined,
      },
    }
  }

  const receiverName = asString(receiver.name)
  const receiverPhone = asString(receiver.phone)
  if (!receiverName || !receiverPhone) {
    throw new HttpError(400, 'receiver.name and receiver.phone are required')
  }

  const defaultWeight = cleanNumber(defaults?.default_weight_kg) ?? 1
  const defaultParcels = Math.max(1, Math.round(cleanNumber(defaults?.default_parcels_count) ?? 1))

  const weightKg = cleanNumber(src.weightKg ?? src.weight_kg) ?? defaultWeight
  if (!(weightKg > 0)) throw new HttpError(400, 'weightKg must be > 0')

  const parcelsCount = Math.round(cleanNumber(src.parcelsCount ?? src.parcels_count) ?? defaultParcels)
  if (!(parcelsCount > 0)) throw new HttpError(400, 'parcelsCount must be > 0')

  const payerRaw = src.payer === 'RECEIVER' ? 'RECEIVER' : src.payer === 'SENDER' ? 'SENDER' : null
  const payer = payerRaw ?? defaults?.default_payer ?? 'SENDER'

  const quoteId = src.quoteId ?? src.quote_id
  const parsedQuoteId = quoteId === null || quoteId === undefined || quoteId === '' ? null : Math.trunc(Number(quoteId))
  if (parsedQuoteId !== null && !Number.isFinite(parsedQuoteId)) {
    throw new HttpError(400, 'quoteId must be a number')
  }

  const codAmount = cleanNumber(src.codAmount ?? src.cod_amount)
  const declaredValue = cleanNumber(src.declaredValue ?? src.declared_value)

  return {
    quoteId: parsedQuoteId,
    receiver: {
      name: receiverName,
      phone: receiverPhone,
      email: asString(receiver.email),
    },
    destination: parsedDestination,
    parcelsCount,
    weightKg,
    codAmount: codAmount && codAmount > 0 ? codAmount : null,
    declaredValue: declaredValue && declaredValue > 0 ? declaredValue : null,
    payer,
    description: asString(src.description) ?? null,
  }
}

export function mergeShipmentInput(base: ShipmentSnapshotInput, overrides: Partial<ShipmentSnapshotInput> | null | undefined): ShipmentSnapshotInput {
  if (!overrides) return base
  return {
    ...base,
    ...overrides,
    receiver: overrides.receiver ? { ...base.receiver, ...overrides.receiver } : base.receiver,
    destination: overrides.destination ? { ...base.destination, ...overrides.destination } as ShipmentDestinationInput : base.destination,
  }
}

export function shipmentRowToInput(row: ShipmentRow): ShipmentSnapshotInput {
  const rawPayer = (row.econt_label_data as Record<string, unknown> | null)?.shipment_payer
  const payer =
    typeof rawPayer === 'string'
      ? rawPayer
      : rawPayer && typeof rawPayer === 'object' && typeof (rawPayer as Record<string, unknown>).payer === 'string'
        ? (rawPayer as Record<string, unknown>).payer
        : null

  return {
    quoteId: row.quote_id,
    receiver: row.receiver as unknown as ShipmentReceiverInput,
    destination: row.destination as unknown as ShipmentDestinationInput,
    parcelsCount: Number(row.parcels_count),
    weightKg: Number(row.weight_kg),
    codAmount: row.cod_amount === null ? null : Number(row.cod_amount),
    declaredValue: row.declared_value === null ? null : Number(row.declared_value),
    payer: (payer === 'SENDER' || payer === 'RECEIVER' ? payer : null),
    description: ((row.econt_label_data as Record<string, unknown> | null)?.shipment_description as string | null) || null,
  }
}

function buildAddress(address: EcontAddressInput) {
  return {
    city: {
      country: { code3: address.countryCode3 || 'BGR' },
      name: address.city,
      ...(address.postCode ? { postCode: address.postCode } : {}),
    },
    ...(address.quarter ? { quarter: address.quarter } : {}),
    ...(address.street ? { street: address.street } : {}),
    ...(address.streetNum ? { num: address.streetNum } : {}),
    ...(address.other ? { other: address.other } : {}),
  }
}

function buildClient(name: string, phone: string, email?: string | null) {
  return {
    name,
    // Econt requires an authorized/contact person for legal entities.
    // For MVP, use the provided receiver/sender name as fallback contact person.
    namePerson: name,
    // Econt JSON expects an array of phone strings, not objects.
    phones: [phone],
    ...(email ? { email } : {}),
  }
}

function isLikelyNumericOfficeCode(value: string) {
  return /^\d+$/.test(value.trim())
}

function normalizeOfficeText(value: string): string {
  return value
    .toLocaleLowerCase('bg')
    .normalize('NFKD')
    .replace(/\s+/g, ' ')
    .replace(/[–—]/g, '-')
    .replace(/[.,/#!$%^&*;:{}=\-_`~()'"!?@+[\]\\]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

const CYR_TO_LAT_MULTI: Array<[string, string]> = [
  ['щ', 'sht'],
  ['ш', 'sh'],
  ['ч', 'ch'],
  ['ц', 'ts'],
  ['ю', 'yu'],
  ['я', 'ya'],
  ['ж', 'zh'],
]

const CYR_TO_LAT_SINGLE: Record<string, string> = {
  а: 'a',
  б: 'b',
  в: 'v',
  г: 'g',
  д: 'd',
  е: 'e',
  ё: 'e',
  ж: 'zh',
  з: 'z',
  и: 'i',
  й: 'y',
  к: 'k',
  л: 'l',
  м: 'm',
  н: 'n',
  о: 'o',
  п: 'p',
  р: 'r',
  с: 's',
  т: 't',
  у: 'u',
  ф: 'f',
  х: 'h',
  ц: 'ts',
  ч: 'ch',
  ш: 'sh',
  щ: 'sht',
  ъ: 'a',
  ь: '',
  ю: 'yu',
  я: 'ya',
}

function transliterateCyrToLat(value: string): string {
  let out = normalizeOfficeText(value)
  for (const [from, to] of CYR_TO_LAT_MULTI) {
    out = out.split(from).join(to)
  }
  let mapped = ''
  for (const ch of out) {
    mapped += CYR_TO_LAT_SINGLE[ch] ?? ch
  }
  return normalizeOfficeText(mapped)
}

function officeSearchTokens(value: string) {
  const normalized = normalizeOfficeText(value)
  return {
    normalized,
    latinized: transliterateCyrToLat(normalized),
  }
}

function officeTextMatches(input: string, target: string) {
  const a = officeSearchTokens(input)
  const b = officeSearchTokens(target)

  if (!a.normalized || !b.normalized) return false
  if (a.normalized === b.normalized) return true
  if (a.latinized === b.latinized) return true
  if (b.normalized.startsWith(a.normalized)) return true
  if (b.latinized.startsWith(a.latinized)) return true
  if (b.normalized.includes(a.normalized)) return true
  if (b.latinized.includes(a.latinized)) return true
  return false
}

function asObjectArray(value: unknown): Array<Record<string, unknown>> {
  if (!Array.isArray(value)) return []
  return value.filter((v): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v))
}

async function getAllEcontOffices(integration: TenantIntegrationRow): Promise<Array<Record<string, unknown>>> {
  const cacheKey = `${integration.environment}:BGR`
  const now = Date.now()
  const cached = econtOfficesCache.get(cacheKey)
  if (cached && cached.expiresAt > now) return cached.offices

  const response = await econtPost(
    'Nomenclatures/NomenclaturesService.getOffices.json',
    { countryCode: 'BGR' },
    integration,
  )
  const root = response && typeof response === 'object' ? (response as Record<string, unknown>) : {}
  const offices = asObjectArray(root.offices)
  econtOfficesCache.set(cacheKey, { expiresAt: now + OFFICES_CACHE_TTL_MS, offices })
  return offices
}

function officeRowName(office: Record<string, unknown>): string | null {
  if (typeof office.name === 'string' && office.name.trim()) return office.name.trim()
  return null
}

function officeRowCode(office: Record<string, unknown>): string | null {
  if (typeof office.code === 'string' && office.code.trim()) return office.code.trim()
  if (typeof office.code === 'number') return String(office.code)
  return null
}

function findOfficeByInput(offices: Array<Record<string, unknown>>, officeInput: string): Record<string, unknown> | null {
  const raw = officeInput.trim()
  if (!normalizeOfficeText(raw)) return null

  const exactCode = offices.find((office) => officeRowCode(office) === raw)
  if (exactCode) return exactCode

  const exactName = offices.find((office) => {
    const name = officeRowName(office)
    if (!name) return false
    const inputTokens = officeSearchTokens(raw)
    const nameTokens = officeSearchTokens(name)
    return inputTokens.normalized === nameTokens.normalized || inputTokens.latinized === nameTokens.latinized
  })
  if (exactName) return exactName

  const startsWithMatches = offices.filter((office) => {
    const name = officeRowName(office)
    if (!name) return false
    const inputTokens = officeSearchTokens(raw)
    const nameTokens = officeSearchTokens(name)
    return (
      nameTokens.normalized.startsWith(inputTokens.normalized) ||
      nameTokens.latinized.startsWith(inputTokens.latinized)
    )
  })
  if (startsWithMatches.length === 1) return startsWithMatches[0]

  const containsMatches = offices.filter((office) => {
    const name = officeRowName(office)
    return name ? officeTextMatches(raw, name) : false
  })
  if (containsMatches.length === 1) return containsMatches[0]

  return null
}

function suggestOfficesByInput(offices: Array<Record<string, unknown>>, officeInput: string): string[] {
  if (!normalizeOfficeText(officeInput)) return []
  const out: string[] = []
  for (const office of offices) {
    const name = officeRowName(office)
    if (!name) continue
    if (officeTextMatches(officeInput, name)) {
      out.push(name)
      if (out.length >= 20) break
    }
  }
  return Array.from(new Set(out))
}

function officeRowCity(office: Record<string, unknown>): string | null {
  const city = office.city
  if (city && typeof city === 'object' && typeof (city as Record<string, unknown>).name === 'string') {
    const value = ((city as Record<string, unknown>).name as string).trim()
    return value || null
  }
  if (typeof office.cityName === 'string' && office.cityName.trim()) return office.cityName.trim()
  return null
}

export async function listTenantEcontOffices(
  integration: TenantIntegrationRow,
  options?: { query?: string | null; limit?: number | null },
) {
  const offices = await getAllEcontOffices(integration)
  const query = (options?.query || '').trim()
  const limit = Math.max(1, Math.min(1000, Math.round(Number(options?.limit ?? 500))))

  let rows = offices
  if (query) {
    rows = offices.filter((office) => {
      const name = officeRowName(office)
      const code = officeRowCode(office)
      const city = officeRowCity(office)
      return (
        (name ? officeTextMatches(query, name) : false) ||
        (code ? normalizeOfficeText(code).startsWith(normalizeOfficeText(query)) : false) ||
        (city ? officeTextMatches(query, city) : false)
      )
    })
  }

  return rows
    .map((office) => ({
      code: officeRowCode(office),
      name: officeRowName(office),
      city: officeRowCity(office),
    }))
    .filter((office) => office.code && office.name)
    .slice(0, limit) as Array<{ code: string; name: string; city: string | null }>
}

export async function resolveOfficeDestinationCode(
  destination: ShipmentDestinationInput,
  integration: TenantIntegrationRow,
): Promise<ShipmentDestinationInput> {
  if (destination.type !== 'office') return destination
  const officeInput = (destination.officeCode || '').trim()
  if (!officeInput) return destination
  if (isLikelyNumericOfficeCode(officeInput)) {
    return { ...destination, officeCode: officeInput }
  }

  const offices = await getAllEcontOffices(integration)
  const match = findOfficeByInput(offices, officeInput)
  if (!match) {
    throw new HttpError(400, 'Econt office name could not be resolved. Use an exact office name or office code.', {
      office_input: officeInput,
      suggestions: suggestOfficesByInput(offices, officeInput),
    })
  }

  const code = officeRowCode(match)
  if (!code) {
    throw new HttpError(400, 'Matched Econt office has no office code in response', {
      office_input: officeInput,
      office: match,
    })
  }

  return { ...destination, officeCode: code }
}

export async function resolveShipmentOfficeDestinations(
  snapshot: ShipmentSnapshotInput,
  integration: TenantIntegrationRow,
): Promise<ShipmentSnapshotInput> {
  if (snapshot.destination.type !== 'office') return snapshot
  const resolvedDestination = await resolveOfficeDestinationCode(snapshot.destination, integration)
  return { ...snapshot, destination: resolvedDestination }
}

export function buildEcontLabelPayload(input: ShipmentSnapshotInput, defaults: EcontIntegrationDefaults) {
  const sender = defaults.sender ?? {}
  const senderName = sender.name?.trim()
  const senderPhone = sender.phone?.trim()

  if (!senderName || !senderPhone) {
    throw new HttpError(400, 'Econt sender defaults are incomplete (sender name/phone required)')
  }

  const label: Record<string, unknown> = {
    senderClient: buildClient(senderName, senderPhone, sender.email),
    senderAgent: buildClient(senderName, senderPhone, sender.email),
    receiverClient: buildClient(input.receiver.name, input.receiver.phone, input.receiver.email),
    receiverAgent: buildClient(input.receiver.name, input.receiver.phone, input.receiver.email),
    packCount: input.parcelsCount,
    shipmentType: 'pack',
    weight: input.weightKg,
    shipmentDescription: input.description || `Shipment from platform`,
  }

  if (sender.officeCode) {
    label.senderOfficeCode = sender.officeCode
  } else if (sender.address?.city) {
    label.senderAddress = buildAddress(sender.address)
  } else {
    throw new HttpError(400, 'Econt sender defaults must include sender office code or sender address')
  }

  if (input.destination.type === 'office') {
    label.receiverOfficeCode = input.destination.officeCode
  } else if (input.destination.address) {
    label.receiverAddress = buildAddress(input.destination.address)
  }

  const services: Record<string, unknown> = {
    shipmentPayer: { payer: input.payer || defaults.default_payer || 'SENDER' },
  }
  if (input.codAmount && input.codAmount > 0) {
    services.cdAmount = Number(input.codAmount)
  }
  if (input.declaredValue && input.declaredValue > 0) {
    services.declaredValueAmount = Number(input.declaredValue)
  }

  label.services = services

  return { label }
}

export async function getTenantEcontIntegration(adminClient: any, tenantId: string, options?: { requireEnabled?: boolean }) {
  const { data, error } = await adminClient
    .from('tenant_integrations')
    .select('id, tenant_id, provider, enabled, environment, credentials, defaults')
    .eq('tenant_id', tenantId)
    .eq('provider', ECONT_PROVIDER)
    .maybeSingle()

  if (error) {
    throw new HttpError(500, 'Failed to load tenant Econt integration')
  }

  const row = data as TenantIntegrationRow | null
  if (!row) {
    throw new HttpError(404, 'Econt integration is not configured for this tenant')
  }
  if (options?.requireEnabled !== false && !row.enabled) {
    throw new HttpError(409, 'Econt integration is disabled for this tenant')
  }

  return {
    ...row,
    environment: normalizeEnvironment(row.environment),
    defaults: normalizeDefaults(row.defaults),
  }
}

export async function resolveEcontCredentials(integration: TenantIntegrationRow): Promise<EcontCredentials> {
  const decrypted = await decryptEcontCredentials(integration.credentials)
  if (decrypted?.username && decrypted?.password) {
    return decrypted
  }

  if (integration.environment === 'demo') {
    return DEMO_CREDENTIALS
  }

  throw new HttpError(409, 'Econt credentials are missing for production environment')
}

class EcontApiError extends Error {
  status: number
  details?: unknown

  constructor(message: string, status: number, details?: unknown) {
    super(message)
    this.name = 'EcontApiError'
    this.status = status
    this.details = details
  }
}

function isEcontValidationError(data: unknown): boolean {
  if (!data || typeof data !== 'object') return false
  const obj = data as Record<string, unknown>
  if (typeof obj.type === 'string' && obj.type.startsWith('ExInvalid')) return true
  if (Array.isArray(obj.innerErrors)) {
    return obj.innerErrors.some((child) => isEcontValidationError(child))
  }
  return false
}

function sanitizeEcontDetails(data: unknown) {
  if (!data || typeof data !== 'object') return data
  const clone = structuredClone(data as Record<string, unknown>) as Record<string, unknown>
  if (clone.request && typeof clone.request === 'object') {
    const req = clone.request as Record<string, unknown>
    if (req.username) req.username = '[redacted]'
    if (req.password) req.password = '[redacted]'
  }
  return clone
}

export async function econtPost(path: string, payload: unknown, integration: TenantIntegrationRow) {
  const creds = await resolveEcontCredentials(integration)
  const baseUrl = ECONT_BASE_URLS[integration.environment]
  const url = `${baseUrl}${path}`

  const authHeader = `Basic ${btoa(`${creds.username}:${creds.password}`)}`
  let res: Response
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Authorization: authHeader,
      },
      body: JSON.stringify(payload),
    })
  } catch (error) {
    throw new HttpError(502, 'Failed to reach Econt service', error instanceof Error ? error.message : String(error))
  }

  const text = await res.text()
  let data: unknown = null
  try {
    data = text ? JSON.parse(text) : null
  } catch {
    data = { raw: text }
  }

  const possibleError =
    (data && typeof data === 'object' && ((data as Record<string, unknown>).error || (data as Record<string, unknown>).errors)) ||
    null

  if (!res.ok || possibleError) {
    const validation = isEcontValidationError(data)
    const econtError = new EcontApiError(
      'Econt API request failed',
      res.status || 502,
      sanitizeEcontDetails(data),
    )
    console.error('[econt] request failed', { path, status: econtError.status, details: econtError.details })
    throw new HttpError(validation ? 422 : 502, 'Econt API request failed', {
      path,
      status: res.status,
      econt: econtError.details,
    })
  }

  return data
}

function pickFirstNumberLike(...values: unknown[]): number | null {
  for (const value of values) {
    if (value === null || value === undefined) continue
    const n = Number(value)
    if (Number.isFinite(n)) return n
  }
  return null
}

function pickFirstString(...values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim()
  }
  return null
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

function asRecordArray(value: unknown): Array<Record<string, unknown>> {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is Record<string, unknown> => !!item && typeof item === 'object' && !Array.isArray(item))
}

export function normalizeCalculateResult(response: unknown) {
  const root = response && typeof response === 'object' ? (response as Record<string, unknown>) : {}
  const rootLabel =
    root.label && typeof root.label === 'object'
      ? (root.label as Record<string, unknown>)
      : undefined
  const priceBlock =
    (root.price as Record<string, unknown> | undefined) ||
    (rootLabel?.price as Record<string, unknown> | undefined)
  const labelServices = asRecordArray(rootLabel?.services)
  const firstService = labelServices[0]

  const total = pickFirstNumberLike(
    rootLabel?.totalPrice,
    rootLabel?.senderDueAmount,
    firstService?.price,
    priceBlock?.total,
    priceBlock?.totalPrice,
    root.total,
    root.totalPrice,
  )

  const currency = pickFirstString(
    rootLabel?.currency,
    firstService?.currency,
    priceBlock?.currency,
    root.currency,
    'BGN',
  )

  return {
    totalPrice: total,
    currency: currency || 'BGN',
    raw: response,
  }
}

export function extractWaybillNumber(response: unknown): string | null {
  const root = response && typeof response === 'object' ? (response as Record<string, unknown>) : {}
  const label = root.label && typeof root.label === 'object' ? (root.label as Record<string, unknown>) : null
  return pickFirstString(root.shipmentNum, root.shipmentNumber, label?.shipmentNum, label?.shipmentNumber)
}

export function normalizeCreateLabelResult(response: unknown) {
  const root = response && typeof response === 'object' ? (response as Record<string, unknown>) : {}
  const label = root.label && typeof root.label === 'object' ? (root.label as Record<string, unknown>) : {}
  const services = asRecordArray(label.services)
  const firstService = services[0]
  const waybillNumber = extractWaybillNumber(response)
  const price = normalizeCalculateResult(response)
  const expectedDeliveryDateMs = pickFirstNumberLike(label.expectedDeliveryDate)
  const expectedDeliveryAt =
    expectedDeliveryDateMs && expectedDeliveryDateMs > 0
      ? new Date(expectedDeliveryDateMs).toISOString()
      : null

  const printInfo = {
    pdfUrl: pickFirstString(root.pdfURL, root.pdfUrl, label.pdfURL, label.pdfUrl),
    printUrl: pickFirstString(root.printURL, root.printUrl, label.printURL, label.printUrl),
    shipmentNum: waybillNumber,
  }

  return {
    waybillNumber,
    price,
    labelData: {
      ...printInfo,
      shipment_payer:
        ((asRecord(label.services)?.shipmentPayer as Record<string, unknown> | undefined)?.payer) ||
        asRecord(label.services)?.shipmentPayer ||
        firstService?.paymentSide,
      shipment_description: pickFirstString(label.shipmentDescription, root.shipmentDescription),
      service_description: pickFirstString(firstService?.description),
      total_price: price.totalPrice,
      currency: price.currency,
      expected_delivery_at: expectedDeliveryAt,
      raw: response,
    },
    raw: response,
  }
}

function mapEcontStatusToInternal(statusCode: string | null, statusName: string | null): string {
  const code = `${statusCode || ''} ${statusName || ''}`.toLowerCase()
  if (code.includes('deliver')) return 'delivered'
  if (code.includes('cancel')) return 'cancelled'
  if (code.includes('return')) return 'returned'
  if (code.includes('transit') || code.includes('courier') || code.includes('office')) return 'in_transit'
  return 'created'
}

export function normalizeTrackResult(response: unknown) {
  const root = response && typeof response === 'object' ? (response as Record<string, unknown>) : {}
  const statuses =
    (Array.isArray(root.shipmentStatuses) ? root.shipmentStatuses : null) ||
    (Array.isArray(root.shipments) ? root.shipments : null) ||
    []
  const first = statuses[0] && typeof statuses[0] === 'object' ? (statuses[0] as Record<string, unknown>) : {}
  const statusObj = first.status && typeof first.status === 'object' ? (first.status as Record<string, unknown>) : {}

  const statusCode = pickFirstString(statusObj.code, statusObj.num, first.statusCode, first.code)
  const statusName = pickFirstString(statusObj.name, statusObj.description, first.statusName, first.description)
  const internalStatus = mapEcontStatusToInternal(statusCode, statusName)

  return {
    statusCode,
    statusName,
    status: internalStatus,
    trackedAt: new Date().toISOString(),
    raw: response,
  }
}

export function getTrackingThrottleMinutes(defaults: EcontIntegrationDefaults): number {
  return clampTrackingThrottleMinutes(defaults.tracking_throttle_minutes)
}

export async function upsertShipmentDraft(adminClient: any, args: {
  tenantId: string
  shipmentId?: string | null
  snapshot: ShipmentSnapshotInput
  priceAmount?: number | null
  currency?: string | null
  status: string
  econtWaybillNumber?: string | null
  econtLabelData?: Record<string, unknown> | null
}) {
  const payload = {
    tenant_id: args.tenantId,
    quote_id: args.snapshot.quoteId ?? null,
    carrier: ECONT_PROVIDER,
    receiver: args.snapshot.receiver,
    destination: args.snapshot.destination,
    parcels_count: args.snapshot.parcelsCount,
    weight_kg: args.snapshot.weightKg,
    cod_amount: args.snapshot.codAmount ?? null,
    declared_value: args.snapshot.declaredValue ?? null,
    price_amount: args.priceAmount ?? null,
    currency: args.currency ?? 'BGN',
    econt_waybill_number: args.econtWaybillNumber ?? null,
    econt_label_data: args.econtLabelData ?? null,
    status: args.status,
    ...(args.status === 'created' || args.status === 'cancelled' ? { last_synced_at: new Date().toISOString() } : {}),
  }

  if (args.shipmentId) {
    const { data: existing, error: existingError } = await adminClient
      .from('shipments')
      .select('id')
      .eq('id', args.shipmentId)
      .eq('tenant_id', args.tenantId)
      .eq('carrier', ECONT_PROVIDER)
      .maybeSingle()

    if (existingError) throw new HttpError(500, 'Failed to verify shipment')
    if (!existing) throw new HttpError(404, 'Shipment not found')

    const { data, error } = await adminClient
      .from('shipments')
      .update(payload)
      .eq('id', args.shipmentId)
      .eq('tenant_id', args.tenantId)
      .select('*')
      .single()

    if (error) throw new HttpError(500, 'Failed to update shipment')
    return data as ShipmentRow
  }

  const { data, error } = await adminClient
    .from('shipments')
    .insert(payload)
    .select('*')
    .single()

  if (error) throw new HttpError(500, 'Failed to create shipment')
  return data as ShipmentRow
}

export async function getTenantShipment(adminClient: any, tenantId: string, shipmentId: string) {
  const { data, error } = await adminClient
    .from('shipments')
    .select('*')
    .eq('id', shipmentId)
    .eq('tenant_id', tenantId)
    .eq('carrier', ECONT_PROVIDER)
    .maybeSingle()

  if (error) throw new HttpError(500, 'Failed to load shipment')
  if (!data) throw new HttpError(404, 'Shipment not found')
  return data as ShipmentRow
}

export function getSettingsResponse(row: TenantIntegrationRow | null) {
  const defaults = normalizeDefaults(row?.defaults)
  return {
    provider: ECONT_PROVIDER,
    enabled: row?.enabled ?? false,
    environment: normalizeEnvironment(row?.environment),
    defaults,
    has_credentials: Boolean(row?.credentials && Object.keys(row.credentials || {}).length > 0),
  }
}
