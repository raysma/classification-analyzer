import { parseClassificationHtml } from '../src/lib/parser.js'
import { ShooterRecordSchema } from '../src/lib/validation.js'

export const config = { runtime: 'edge' }

const MEMBER_RE = /^[A-Z]{1,3}\d+$/

function json(body: unknown, status: number, extraHeaders?: Record<string, string>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...extraHeaders },
  })
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), ms)),
  ])
}

export default async function handler(request: Request): Promise<Response> {
  const { searchParams } = new URL(request.url)
  const member = searchParams.get('member') ?? ''

  if (!member || !MEMBER_RE.test(member)) {
    return json({ error: 'invalid_member_number' }, 400)
  }

  const url = `https://uspsa.org/classification/${encodeURIComponent(member)}`

  let html: string
  try {
    const response = await withTimeout(
      fetch(url, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          Accept:
            'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
          'Cache-Control': 'no-cache',
          Pragma: 'no-cache',
        },
      }),
      10_000,
    )

    if (response.status === 404) {
      return json({ error: 'member_not_found' }, 404)
    }

    if (!response.ok) {
      let responseSnippet: string | undefined
      try {
        responseSnippet = (await response.text()).slice(0, 1000)
      } catch {
        // ignore
      }
      console.error(
        '[classification] upstream error:',
        response.status,
        response.statusText,
        responseSnippet?.slice(0, 300),
      )
      return json(
        {
          error: 'upstream_error',
          status: response.status,
          statusText: response.statusText,
          responseSnippet,
        },
        502,
      )
    }

    html = await response.text()
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    if (message === 'timeout') {
      return json({ error: 'upstream_timeout' }, 504)
    }
    console.error('[classification] fetch error:', message)
    return json({ error: 'fetch_failed' }, 502)
  }

  const parsed = parseClassificationHtml(html)

  if (!parsed.ok) {
    if (parsed.error === 'record_not_viewable') {
      return json({ error: 'record_not_viewable' }, 404)
    }
    return json({ error: parsed.error }, 502)
  }

  const validated = ShooterRecordSchema.safeParse(parsed.doc)
  if (!validated.success) {
    console.error('[classification] zod validation failed:', validated.error.message)
    return json({ error: 'validation_failed', issues: validated.error.issues }, 502)
  }

  return json(
    { ...validated.data, warnings: parsed.warnings },
    200,
    { 'Cache-Control': 'public, s-maxage=900, stale-while-revalidate=3600' },
  )
}
