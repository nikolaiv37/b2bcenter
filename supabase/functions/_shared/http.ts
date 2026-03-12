import { corsHeaders } from './cors.ts'

export class HttpError extends Error {
  status: number
  details?: unknown

  constructor(status: number, message: string, details?: unknown) {
    super(message)
    this.name = 'HttpError'
    this.status = status
    this.details = details
  }
}

export function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

export function ok(body: Record<string, unknown>) {
  return json(body, 200)
}

export function errorResponse(error: unknown) {
  if (error instanceof HttpError) {
    return json(
      {
        error: error.message,
        ...(error.details !== undefined ? { details: error.details } : {}),
      },
      error.status,
    )
  }

  const message = error instanceof Error ? error.message : 'Internal server error'
  return json({ error: message }, 500)
}

export async function parseJson<T>(req: Request): Promise<T> {
  try {
    return (await req.json()) as T
  } catch {
    throw new HttpError(400, 'Invalid JSON body')
  }
}

export function requirePostOrOptions(req: Request) {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }
  if (req.method !== 'POST') {
    throw new HttpError(405, 'Method not allowed')
  }
  return null
}
