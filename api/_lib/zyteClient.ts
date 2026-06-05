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

export const ZYTE_TIMEOUT_MS = 45_000
const ZYTE_ENDPOINT = 'https://api.zyte.com/v1/extract'

export async function fetchViaZyte(targetUrl: string): Promise<ScrapeResult> {
  const apiKey = process.env['ZYTE_API_KEY'] ?? ''
  if (!apiKey) {
    return { ok: false, reason: 'not_configured' }
  }

  const auth = Buffer.from(`${apiKey}:`).toString('base64')
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), ZYTE_TIMEOUT_MS)
  const startedAt = Date.now()

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
    const elapsedMs = Date.now() - startedAt

    if (!response.ok) {
      let detail: string | undefined
      try {
        detail = (await response.text()).slice(0, 500)
      } catch {
        // ignore
      }
      console.error(`[Zyte] ${response.status} (${elapsedMs}ms)`)
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
    const upstreamStatus = typeof body.statusCode === 'number' ? body.statusCode : undefined

    if (upstreamStatus === 404) {
      return { ok: false, reason: 'upstream_404' }
    }
    // A non-2xx upstream page (bot-block, 5xx, login redirect) must not be handed
    // to the parser — that would mislabel it as a parse failure. Surface it as a
    // distinct fetch error instead.
    if (upstreamStatus !== undefined && upstreamStatus >= 400) {
      return {
        ok: false,
        reason: 'other',
        httpStatus: upstreamStatus,
        detail: `upstream ${upstreamStatus}`,
      }
    }

    const html = typeof body.browserHtml === 'string' ? body.browserHtml : ''
    if (!html) {
      // Previously a missing statusCode silently defaulted to 200; treat an empty
      // body as the error it is rather than guessing success.
      return {
        ok: false,
        reason: 'other',
        detail:
          upstreamStatus === undefined
            ? 'zyte response missing statusCode and browserHtml'
            : 'zyte response missing browserHtml',
      }
    }

    const resolvedStatus = upstreamStatus ?? 200
    console.log(`[Zyte] ok ${resolvedStatus} (${elapsedMs}ms, ${html.length}b)`)
    return { ok: true, html, upstreamStatus: resolvedStatus }
  } catch (err) {
    clearTimeout(timeoutId)
    const elapsedMs = Date.now() - startedAt
    if (err instanceof Error && err.name === 'AbortError') {
      console.error(`[Zyte] timeout after ${elapsedMs}ms`)
      return { ok: false, reason: 'timeout' }
    }
    const message = err instanceof Error ? err.message : String(err)
    console.error(`[Zyte] fetch error (${elapsedMs}ms):`, message)
    return { ok: false, reason: 'other', detail: message }
  }
}
