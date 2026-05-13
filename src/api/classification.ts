import { ShooterRecordSchema, type ValidatedShooterRecord } from '../lib/validation'

export class ClassificationError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly upstreamStatus?: number,
    public readonly upstreamStatusText?: string,
    public readonly responseSnippet?: string,
  ) {
    super(message)
    this.name = 'ClassificationError'
  }
}

export interface ClassificationResponse {
  record: ValidatedShooterRecord
  warnings: string[]
}

export async function fetchClassification(memberNumber: string): Promise<ClassificationResponse> {
  const url = `/api/classification?member=${encodeURIComponent(memberNumber)}`
  const response = await fetch(url)

  if (!response.ok) {
    let errorCode = 'unknown_error'
    let upstreamStatus: number | undefined
    let upstreamStatusText: string | undefined
    let responseSnippet: string | undefined
    try {
      const body = (await response.json()) as {
        error?: string
        status?: number
        statusText?: string
        responseSnippet?: string
      }
      if (typeof body.error === 'string') errorCode = body.error
      if (typeof body.status === 'number') upstreamStatus = body.status
      if (typeof body.statusText === 'string') upstreamStatusText = body.statusText
      if (typeof body.responseSnippet === 'string') responseSnippet = body.responseSnippet
    } catch {
      // ignore parse failure
    }
    throw new ClassificationError(
      errorCode,
      `Classification request failed: ${response.status} ${errorCode}`,
      upstreamStatus,
      upstreamStatusText,
      responseSnippet,
    )
  }

  const raw: unknown = await response.json()
  const { warnings, ...rest } = raw as { warnings?: unknown } & Record<string, unknown>

  const validated = ShooterRecordSchema.safeParse(rest)
  if (!validated.success) {
    throw new ClassificationError('validation_failed', 'Response failed schema validation')
  }

  return {
    record: validated.data,
    warnings: Array.isArray(warnings) ? (warnings as string[]) : [],
  }
}
