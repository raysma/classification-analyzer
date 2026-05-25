import { FeedbackResponseSchema, type FeedbackInput } from '../lib/validation'

export class FeedbackError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message)
    this.name = 'FeedbackError'
  }
}

export interface FeedbackResult {
  issueUrl: string
  issueNumber: number
}

export async function submitFeedback(input: FeedbackInput): Promise<FeedbackResult> {
  let response: Response
  try {
    response = await fetch('/api/feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    })
  } catch (err) {
    throw new FeedbackError('network_error', err instanceof Error ? err.message : 'Network error')
  }

  if (!response.ok) {
    let errorCode = 'unknown_error'
    try {
      const body = (await response.json()) as { error?: unknown }
      if (typeof body.error === 'string') errorCode = body.error
    } catch {
      // ignore
    }
    throw new FeedbackError(errorCode, `Feedback request failed: ${response.status} ${errorCode}`)
  }

  const raw: unknown = await response.json()
  const validated = FeedbackResponseSchema.safeParse(raw)
  if (!validated.success) {
    throw new FeedbackError('validation_failed', 'Response failed schema validation')
  }
  return { issueUrl: validated.data.issueUrl, issueNumber: validated.data.issueNumber }
}
