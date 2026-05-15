import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { fetchViaScrapingAnt } from './scrapingAntClient'

const originalFetch = globalThis.fetch
const originalKey = process.env['SCRAPINGANT_API_KEY']

function mockFetch(impl: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>) {
  globalThis.fetch = vi.fn(impl) as unknown as typeof fetch
}

beforeEach(() => {
  process.env['SCRAPINGANT_API_KEY'] = 'test-key'
})

afterEach(() => {
  globalThis.fetch = originalFetch
  if (originalKey === undefined) delete process.env['SCRAPINGANT_API_KEY']
  else process.env['SCRAPINGANT_API_KEY'] = originalKey
  vi.restoreAllMocks()
})

describe('fetchViaScrapingAnt', () => {
  it('returns not_configured when API key missing', async () => {
    delete process.env['SCRAPINGANT_API_KEY']
    const r = await fetchViaScrapingAnt('https://uspsa.org/classification/A1')
    expect(r).toEqual({ ok: false, reason: 'not_configured', provider: 'scrapingant' })
  })

  it('returns ok with html and upstream status on success', async () => {
    mockFetch(async () =>
      new Response('<html>ok</html>', {
        status: 200,
        headers: { 'ant-status-code': '200' },
      }),
    )
    const r = await fetchViaScrapingAnt('https://uspsa.org/classification/A1')
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.html).toBe('<html>ok</html>')
      expect(r.upstreamStatus).toBe(200)
      expect(r.provider).toBe('scrapingant')
    }
  })

  it('passes browser=true and url query params and x-api-key header', async () => {
    const fetchSpy = vi.fn(async () =>
      new Response('<html/>', { status: 200, headers: { 'ant-status-code': '200' } }),
    )
    globalThis.fetch = fetchSpy as unknown as typeof fetch
    await fetchViaScrapingAnt('https://uspsa.org/classification/A1')
    const [url, init] = fetchSpy.mock.calls[0]!
    const parsed = new URL(String(url))
    expect(parsed.origin + parsed.pathname).toBe('https://api.scrapingant.com/v2/general')
    expect(parsed.searchParams.get('browser')).toBe('true')
    expect(parsed.searchParams.get('url')).toBe('https://uspsa.org/classification/A1')
    expect((init?.headers as Record<string, string>)['x-api-key']).toBe('test-key')
  })

  it('maps 409 to concurrency', async () => {
    mockFetch(async () => new Response('busy', { status: 409 }))
    const r = await fetchViaScrapingAnt('https://uspsa.org/classification/A1')
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.reason).toBe('concurrency')
      expect(r.httpStatus).toBe(409)
    }
  })

  it('maps 401 to auth', async () => {
    mockFetch(async () => new Response('nope', { status: 401 }))
    const r = await fetchViaScrapingAnt('https://uspsa.org/classification/A1')
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.reason).toBe('auth')
  })

  it('maps upstream ant-status-code 404 to upstream_404', async () => {
    mockFetch(async () =>
      new Response('not found page', {
        status: 200,
        headers: { 'ant-status-code': '404' },
      }),
    )
    const r = await fetchViaScrapingAnt('https://uspsa.org/classification/A1')
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.reason).toBe('upstream_404')
  })

  it('maps AbortError to timeout', async () => {
    mockFetch(async () => {
      const err = new Error('aborted')
      err.name = 'AbortError'
      throw err
    })
    const r = await fetchViaScrapingAnt('https://uspsa.org/classification/A1')
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.reason).toBe('timeout')
  })

  it('maps generic non-2xx to other', async () => {
    mockFetch(async () => new Response('boom', { status: 500 }))
    const r = await fetchViaScrapingAnt('https://uspsa.org/classification/A1')
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.reason).toBe('other')
      expect(r.httpStatus).toBe(500)
    }
  })
})
