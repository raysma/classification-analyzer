import { ShooterRecordSchema, type ValidatedShooterRecord } from '../lib/validation'

export class ClassificationError extends Error {
  constructor(
    public readonly code: string,
    message: string,
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
    try {
      const body = (await response.json()) as { error?: string }
      if (typeof body.error === 'string') errorCode = body.error
    } catch {
      // ignore parse failure
    }
    throw new ClassificationError(
      errorCode,
      `Classification request failed: ${response.status} ${errorCode}`,
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
