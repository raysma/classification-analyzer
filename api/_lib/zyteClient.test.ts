import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { fetchViaZyte } from './zyteClient'

const originalFetch = globalThis.fetch
const originalKey = process.env['ZYTE_API_KEY']

function mockFetch(impl: typeof fetch) {
  globalThis.fetch = vi.fn<typeof fetch>(impl)
}

beforeEach(() => {
  process.env['ZYTE_API_KEY'] = 'test-key'
})

afterEach(() => {
  globalThis.fetch = originalFetch
  if (originalKey === undefined) delete process.env['ZYTE_API_KEY']
  else process.env['ZYTE_API_KEY'] = originalKey
  vi.restoreAllMocks()
})

describe('fetchViaZyte', () => {
  it('returns not_configured when ZYTE_API_KEY is unset', async () => {
    delete process.env['ZYTE_API_KEY']
    const r = await fetchViaZyte('https://uspsa.org/classification/A1')
    expect(r).toEqual({ ok: false, reason: 'not_configured' })
  })

  it('posts JSON with browserHtml: true and url, with Basic auth', async () => {
    const fetchSpy = vi.fn<typeof fetch>(
      async () =>
        new Response(JSON.stringify({ browserHtml: '<html>ok</html>', statusCode: 200 }), {
          status: 200,
        }),
    )
    globalThis.fetch = fetchSpy
    await fetchViaZyte('https://uspsa.org/classification/A1')
    const [url, init] = fetchSpy.mock.calls[0]!
    expect(String(url)).toBe('https://api.zyte.com/v1/extract')
    expect(init?.method).toBe('POST')
    const headers = init?.headers as Record<string, string>
    expect(headers['Content-Type']).toBe('application/json')
    expect(headers['Authorization']).toMatch(/^Basic /)
    const decoded = Buffer.from(headers['Authorization']!.replace('Basic ', ''), 'base64').toString(
      'utf8',
    )
    expect(decoded).toBe('test-key:')
    const body = JSON.parse(String(init?.body))
    expect(body).toEqual({ url: 'https://uspsa.org/classification/A1', browserHtml: true })
  })

  it('returns ok with html and upstream status on success', async () => {
    mockFetch(async () =>
      new Response(JSON.stringify({ browserHtml: '<html>ok</html>', statusCode: 200 }), {
        status: 200,
      }),
    )
    const r = await fetchViaZyte('https://uspsa.org/classification/A1')
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.html).toBe('<html>ok</html>')
      expect(r.upstreamStatus).toBe(200)
    }
  })

  it('maps body.statusCode 404 to upstream_404', async () => {
    mockFetch(async () =>
      new Response(JSON.stringify({ browserHtml: '<html/>', statusCode: 404 }), { status: 200 }),
    )
    const r = await fetchViaZyte('https://uspsa.org/classification/A1')
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.reason).toBe('upstream_404')
  })

  it('maps 429 to concurrency', async () => {
    mockFetch(async () => new Response('rate', { status: 429 }))
    const r = await fetchViaZyte('https://uspsa.org/classification/A1')
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.reason).toBe('concurrency')
      expect(r.httpStatus).toBe(429)
    }
  })

  it('maps 503 to concurrency', async () => {
    mockFetch(async () => new Response('busy', { status: 503 }))
    const r = await fetchViaZyte('https://uspsa.org/classification/A1')
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.reason).toBe('concurrency')
  })

  it('maps 401/403 to auth', async () => {
    mockFetch(async () => new Response('nope', { status: 401 }))
    const r1 = await fetchViaZyte('https://uspsa.org/classification/A1')
    expect(r1.ok).toBe(false)
    if (!r1.ok) expect(r1.reason).toBe('auth')

    mockFetch(async () => new Response('nope', { status: 403 }))
    const r2 = await fetchViaZyte('https://uspsa.org/classification/A1')
    expect(r2.ok).toBe(false)
    if (!r2.ok) expect(r2.reason).toBe('auth')
  })

  it('maps AbortError to timeout', async () => {
    mockFetch(async () => {
      const err = new Error('aborted')
      err.name = 'AbortError'
      throw err
    })
    const r = await fetchViaZyte('https://uspsa.org/classification/A1')
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.reason).toBe('timeout')
  })

  it('maps response with missing browserHtml field to other', async () => {
    mockFetch(async () =>
      new Response(JSON.stringify({ statusCode: 200 }), { status: 200 }),
    )
    const r = await fetchViaZyte('https://uspsa.org/classification/A1')
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.reason).toBe('other')
  })

  it('maps generic non-2xx to other', async () => {
    mockFetch(async () => new Response('boom', { status: 400 }))
    const r = await fetchViaZyte('https://uspsa.org/classification/A1')
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.reason).toBe('other')
      expect(r.httpStatus).toBe(400)
    }
  })
})
