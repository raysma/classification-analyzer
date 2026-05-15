import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { resolveScraperMode, scrape } from './scrapers'

const originalFetch = globalThis.fetch
const originalScrapingAntKey = process.env['SCRAPINGANT_API_KEY']
const originalZyteDevKey = process.env['ZYTE_API_KEY_DEV']

beforeEach(() => {
  process.env['SCRAPINGANT_API_KEY'] = 'sa-key'
  process.env['ZYTE_API_KEY_DEV'] = 'zyte-dev-key'
})

afterEach(() => {
  globalThis.fetch = originalFetch
  if (originalScrapingAntKey === undefined) delete process.env['SCRAPINGANT_API_KEY']
  else process.env['SCRAPINGANT_API_KEY'] = originalScrapingAntKey
  if (originalZyteDevKey === undefined) delete process.env['ZYTE_API_KEY_DEV']
  else process.env['ZYTE_API_KEY_DEV'] = originalZyteDevKey
  vi.restoreAllMocks()
})

describe('resolveScraperMode', () => {
  it('defaults to scrapingant when unset', () => {
    expect(resolveScraperMode(undefined)).toBe('scrapingant')
    expect(resolveScraperMode('')).toBe('scrapingant')
    expect(resolveScraperMode('bogus')).toBe('scrapingant')
  })

  it('accepts zyte and fallback', () => {
    expect(resolveScraperMode('zyte')).toBe('zyte')
    expect(resolveScraperMode('fallback')).toBe('fallback')
  })
})

function responseFor(url: Parameters<typeof fetch>[0]): 'scrapingant' | 'zyte' {
  return String(url).startsWith('https://api.scrapingant.com') ? 'scrapingant' : 'zyte'
}

describe('scrape() dispatch', () => {
  it('zyte mode calls zyte and never scrapingant', async () => {
    const calls: string[] = []
    globalThis.fetch = vi.fn<typeof fetch>(async (url) => {
      calls.push(responseFor(url))
      return new Response(JSON.stringify({ browserHtml: '<html/>', statusCode: 200 }), {
        status: 200,
      })
    })

    const r = await scrape('zyte', 'https://uspsa.org/classification/A1')
    expect(calls).toEqual(['zyte'])
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.provider).toBe('zyte')
  })

  it('scrapingant mode calls only scrapingant', async () => {
    const calls: string[] = []
    globalThis.fetch = vi.fn<typeof fetch>(async (url) => {
      calls.push(responseFor(url))
      return new Response('<html/>', {
        status: 200,
        headers: { 'ant-status-code': '200' },
      })
    })

    const r = await scrape('scrapingant', 'https://uspsa.org/classification/A1')
    expect(calls).toEqual(['scrapingant'])
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.provider).toBe('scrapingant')
  })

  it('fallback mode: ScrapingAnt success returns directly, no Zyte call', async () => {
    const calls: string[] = []
    globalThis.fetch = vi.fn<typeof fetch>(async (url) => {
      calls.push(responseFor(url))
      return new Response('<html/>', {
        status: 200,
        headers: { 'ant-status-code': '200' },
      })
    })

    const r = await scrape('fallback', 'https://uspsa.org/classification/A1')
    expect(calls).toEqual(['scrapingant'])
    expect(r.ok).toBe(true)
  })

  it('fallback mode: ScrapingAnt 409 triggers exactly one Zyte call', async () => {
    const calls: string[] = []
    globalThis.fetch = vi.fn<typeof fetch>(async (url) => {
      const provider = responseFor(url)
      calls.push(provider)
      if (provider === 'scrapingant') {
        return new Response('busy', { status: 409 })
      }
      return new Response(JSON.stringify({ browserHtml: '<html>fb</html>', statusCode: 200 }), {
        status: 200,
      })
    })

    const r = await scrape('fallback', 'https://uspsa.org/classification/A1')
    expect(calls).toEqual(['scrapingant', 'zyte'])
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.provider).toBe('zyte')
      expect(r.html).toBe('<html>fb</html>')
    }
  })

  it('fallback mode: non-409 ScrapingAnt failure does NOT trigger Zyte', async () => {
    const calls: string[] = []
    globalThis.fetch = vi.fn<typeof fetch>(async (url) => {
      calls.push(responseFor(url))
      return new Response('boom', { status: 500 })
    })

    const r = await scrape('fallback', 'https://uspsa.org/classification/A1')
    expect(calls).toEqual(['scrapingant'])
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.reason).toBe('other')
      expect(r.provider).toBe('scrapingant')
    }
  })

  it('fallback mode: ScrapingAnt auth failure does NOT trigger Zyte', async () => {
    const calls: string[] = []
    globalThis.fetch = vi.fn<typeof fetch>(async (url) => {
      calls.push(responseFor(url))
      return new Response('nope', { status: 401 })
    })

    const r = await scrape('fallback', 'https://uspsa.org/classification/A1')
    expect(calls).toEqual(['scrapingant'])
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.reason).toBe('auth')
  })

  it('fallback mode: ScrapingAnt timeout does NOT trigger Zyte (v1 scope)', async () => {
    const calls: string[] = []
    globalThis.fetch = vi.fn<typeof fetch>(async (url) => {
      calls.push(responseFor(url))
      const err = new Error('aborted')
      err.name = 'AbortError'
      throw err
    })

    const r = await scrape('fallback', 'https://uspsa.org/classification/A1')
    expect(calls).toEqual(['scrapingant'])
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.reason).toBe('timeout')
  })
})
