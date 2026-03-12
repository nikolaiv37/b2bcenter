import { supabase } from '@/lib/supabase/client'
import type {
  CarrierAdapter,
  CalculateInput,
  CalculateResult,
  CreateLabelInput,
  CreateLabelResult,
  DeleteLabelInput,
  TrackInput,
  TrackResult,
} from './types'

function collectEcontMessages(node: unknown, out: string[]) {
  if (!node || typeof node !== 'object') return
  const obj = node as Record<string, unknown>
  if (typeof obj.message === 'string' && obj.message.trim()) {
    out.push(obj.message.trim())
  }
  if (Array.isArray(obj.innerErrors)) {
    for (const child of obj.innerErrors) collectEcontMessages(child, out)
  }
}

function buildReadableEcontErrorMessage(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object') return null
  const root = payload as Record<string, unknown>
  const details = root.details && typeof root.details === 'object' ? (root.details as Record<string, unknown>) : null
  const econt = details?.econt
  const messages: string[] = []
  collectEcontMessages(econt, messages)
  const unique = Array.from(new Set(messages.filter(Boolean)))
  if (unique.length === 0) return null
  return unique.join(' | ')
}

async function invoke<T>(fn: string, body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke(fn, { body })
  if (error) {
    const e = error as Error & { context?: Response; payload?: unknown }
    let payload: unknown = null
    if (e.context && typeof e.context.json === 'function') {
      try {
        payload = await e.context.clone().json()
      } catch {
        payload = null
      }
    }

    const readable = buildReadableEcontErrorMessage(payload)
    if (readable) {
      const wrapped = new Error(readable) as Error & { payload?: unknown }
      wrapped.payload = payload
      throw wrapped
    }

    if (payload) {
      e.payload = payload
    }
    throw error
  }
  return data as T
}

export class EcontCarrierAdapter implements CarrierAdapter {
  async calculate(input: CalculateInput): Promise<CalculateResult> {
    return invoke<CalculateResult>('econt-calculate', {
      tenant_id: input.tenantId,
      shipment_id: input.shipmentId,
      shipment: input.shipment,
    })
  }

  async createLabel(input: CreateLabelInput): Promise<CreateLabelResult> {
    return invoke<CreateLabelResult>('econt-create-label', {
      tenant_id: input.tenantId,
      shipment_id: input.shipmentId,
      ...(input.shipment ? { shipment: input.shipment } : {}),
    })
  }

  async track(input: TrackInput): Promise<TrackResult> {
    return invoke<TrackResult>('econt-track', {
      tenant_id: input.tenantId,
      shipment_id: input.shipmentId,
    })
  }

  async deleteLabel(input: DeleteLabelInput): Promise<void> {
    await invoke('econt-delete-label', {
      tenant_id: input.tenantId,
      shipment_id: input.shipmentId,
      reason: input.reason,
    })
  }
}
