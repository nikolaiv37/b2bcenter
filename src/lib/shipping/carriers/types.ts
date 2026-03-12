export type CarrierCode = 'econt'

export type ShipmentDestinationType = 'office' | 'address'
export type ShipmentPayer = 'SENDER' | 'RECEIVER'

export interface ShipmentAddressInput {
  countryCode3?: string
  city: string
  postCode?: string
  quarter?: string
  street?: string
  streetNum?: string
  other?: string
}

export interface ShipmentDraftInput {
  quoteId?: number | null
  receiver: {
    name: string
    phone: string
    email?: string | null
  }
  destination: {
    type: ShipmentDestinationType
    officeCode?: string
    address?: ShipmentAddressInput
  }
  parcelsCount: number
  weightKg: number
  codAmount?: number | null
  declaredValue?: number | null
  payer?: ShipmentPayer | null
  description?: string | null
}

export interface CalculateInput {
  tenantId: string
  shipmentId?: string
  shipment: ShipmentDraftInput
}

export interface CalculateResult {
  shipment: any
  result: {
    carrier: CarrierCode
    total_price: number | null
    currency: string
  }
}

export interface CreateLabelInput {
  tenantId: string
  shipmentId?: string
  shipment?: ShipmentDraftInput
}

export interface CreateLabelResult {
  shipment: any
  result: {
    carrier: CarrierCode
    waybill_number: string
    label?: Record<string, unknown> | null
    total_price: number | null
    currency: string
  }
}

export interface TrackInput {
  tenantId: string
  shipmentId: string
}

export interface TrackResult {
  success: boolean
  throttled?: boolean
  retry_after_seconds?: number
  retry_after_minutes?: number
  next_allowed_at?: string
  throttle_minutes?: number
  shipment?: any
  result?: {
    carrier: CarrierCode
    status: string
    status_code?: string | null
    status_name?: string | null
    tracked_at?: string
  }
}

export interface DeleteLabelInput {
  tenantId: string
  shipmentId: string
  reason?: string
}

export interface CarrierAdapter {
  calculate(input: CalculateInput): Promise<CalculateResult>
  createLabel(input: CreateLabelInput): Promise<CreateLabelResult>
  track(input: TrackInput): Promise<TrackResult>
  deleteLabel?(input: DeleteLabelInput): Promise<void>
}
