import { EcontCarrierAdapter } from './econt'
import type { CarrierAdapter, CarrierCode } from './types'

export function getCarrierAdapter(_tenantId: string, carrierCode: CarrierCode): CarrierAdapter {
  switch (carrierCode) {
    case 'econt':
      return new EcontCarrierAdapter()
    default:
      throw new Error(`Unsupported carrier: ${carrierCode}`)
  }
}
