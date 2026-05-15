export type ScrapeFailureReason =
  | 'concurrency'
  | 'auth'
  | 'timeout'
  | 'upstream_404'
  | 'not_configured'
  | 'other'

export type ScrapeResult =
  | { ok: true; html: string; upstreamStatus: number }
  | {
      ok: false
      reason: ScrapeFailureReason
      httpStatus?: number
      detail?: string
    }

const ZYTE_TIMEOUT_MS = 45_000
const ZYTE_ENDPOINT = 'https://api.zyte.com/v1/extract'

export async function fetchViaZyte(targetUrl: string): Promise<ScrapeResult> {
  const apiKey = process.env['ZYTE_API_KEY'] ?? ''
  if (!apiKey) {
    return { ok: false, reason: 'not_configured' }
  }

  const auth = Buffer.from(`${apiKey}:`).toString('base64')
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), ZYTE_TIMEOUT_MS)

  try {
    const response = await fetch(ZYTE_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ url: targetUrl, browserHtml: true }),
      signal: controller.signal,
    })
    clearTimeout(timeoutId)

    if (!response.ok) {
      let detail: string | undefined
      try {
        detail = (await response.text()).slice(0, 500)
      } catch {
        // ignore
      }
      console.error(`[Zyte] ${response.status}`)
      if (response.status === 401 || response.status === 403) {
        return {
          ok: false,
          reason: 'auth',
          httpStatus: response.status,
          ...(detail !== undefined ? { detail } : {}),
        }
      }
      if (response.status === 429 || response.status === 503) {
        return {
          ok: false,
          reason: 'concurrency',
          httpStatus: response.status,
          ...(detail !== undefined ? { detail } : {}),
        }
      }
      return {
        ok: false,
        reason: 'other',
        httpStatus: response.status,
        ...(detail !== undefined ? { detail } : {}),
      }
    }

    const body = (await response.json()) as { browserHtml?: unknown; statusCode?: unknown }
    const upstreamStatus = typeof body.statusCode === 'number' ? body.statusCode : 200
    if (upstreamStatus === 404) {
      return { ok: false, reason: 'upstream_404' }
    }

    const html = typeof body.browserHtml === 'string' ? body.browserHtml : ''
    if (!html) {
      return {
        ok: false,
        reason: 'other',
        detail: 'zyte response missing browserHtml',
      }
    }

    return { ok: true, html, upstreamStatus }
  } catch (err) {
    clearTimeout(timeoutId)
    if (err instanceof Error && err.name === 'AbortError') {
      return { ok: false, reason: 'timeout' }
    }
    const message = err instanceof Error ? err.message : String(err)
    console.error('[Zyte] fetch error:', message)
    return { ok: false, reason: 'other', detail: message }
  }
}
