import { fetchViaScrapingAnt } from './scrapingAntClient.js'
import { fetchViaZyte } from './zyteClient.js'

export type ScraperProvider = 'scrapingant' | 'zyte'

export type ScrapeFailureReason =
  | 'concurrency'
  | 'auth'
  | 'timeout'
  | 'upstream_404'
  | 'not_configured'
  | 'other'

export type ScrapeResult =
  | { ok: true; html: string; upstreamStatus: number; provider: ScraperProvider }
  | {
      ok: false
      reason: ScrapeFailureReason
      httpStatus?: number
      detail?: string
      provider: ScraperProvider
    }

export type ScraperMode = 'scrapingant' | 'zyte' | 'fallback'

export function resolveScraperMode(raw: string | undefined): ScraperMode {
  if (raw === 'zyte' || raw === 'fallback') return raw
  return 'scrapingant'
}

export async function scrape(mode: ScraperMode, targetUrl: string): Promise<ScrapeResult> {
  if (mode === 'zyte') {
    return fetchViaZyte(targetUrl)
  }

  const primary = await fetchViaScrapingAnt(targetUrl)

  if (mode === 'fallback' && !primary.ok && primary.reason === 'concurrency') {
    return fetchViaZyte(targetUrl)
  }

  return primary
}
