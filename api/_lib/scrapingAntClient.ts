import type { ScrapeResult } from './scrapers.js'

const SCRAPINGANT_TIMEOUT_MS = 45_000

export async function fetchViaScrapingAnt(targetUrl: string): Promise<ScrapeResult> {
  const apiKey = process.env['SCRAPINGANT_API_KEY'] ?? ''
  if (!apiKey) {
    return { ok: false, reason: 'not_configured', provider: 'scrapingant' }
  }

  const endpoint = new URL('https://api.scrapingant.com/v2/general')
  endpoint.searchParams.set('url', targetUrl)
  endpoint.searchParams.set('browser', 'true')

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), SCRAPINGANT_TIMEOUT_MS)

  try {
    const response = await fetch(endpoint.toString(), {
      headers: { 'x-api-key': apiKey },
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
      console.error(`[ScrapingAnt] ${response.status}`)
      if (response.status === 401) {
        return {
          ok: false,
          reason: 'auth',
          httpStatus: 401,
          ...(detail !== undefined ? { detail } : {}),
          provider: 'scrapingant',
        }
      }
      if (response.status === 409) {
        return {
          ok: false,
          reason: 'concurrency',
          httpStatus: 409,
          ...(detail !== undefined ? { detail } : {}),
          provider: 'scrapingant',
        }
      }
      return {
        ok: false,
        reason: 'other',
        httpStatus: response.status,
        ...(detail !== undefined ? { detail } : {}),
        provider: 'scrapingant',
      }
    }

    const upstreamStatus = parseInt(response.headers.get('ant-status-code') ?? '200', 10)
    if (upstreamStatus === 404) {
      return { ok: false, reason: 'upstream_404', provider: 'scrapingant' }
    }

    const html = await response.text()
    return { ok: true, html, upstreamStatus, provider: 'scrapingant' }
  } catch (err) {
    clearTimeout(timeoutId)
    if (err instanceof Error && err.name === 'AbortError') {
      return { ok: false, reason: 'timeout', provider: 'scrapingant' }
    }
    const message = err instanceof Error ? err.message : String(err)
    console.error('[ScrapingAnt] fetch error:', message)
    return { ok: false, reason: 'other', detail: message, provider: 'scrapingant' }
  }
}
