import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import handler from './feedback'

const originalFetch = globalThis.fetch
const originalToken = process.env['GITHUB_TOKEN']
const originalRepo = process.env['FEEDBACK_REPO']

interface MockRes {
  statusCode: number
  body: unknown
  status: (n: number) => MockRes
  json: (b: unknown) => MockRes
  setHeader: (k: string, v: string) => void
}

function makeRes(): MockRes {
  const res: MockRes = {
    statusCode: 0,
    body: undefined,
    status(n) {
      this.statusCode = n
      return this
    },
    json(b) {
      this.body = b
      return this
    },
    setHeader() {},
  }
  return res
}

interface MockReq {
  method: string
  body: unknown
  headers: Record<string, string>
  socket: { remoteAddress: string }
  query: Record<string, string>
}

function makeReq(overrides: Partial<MockReq> = {}, ip = '1.2.3.4'): MockReq {
  return {
    method: 'POST',
    body: validBody(),
    headers: { 'x-forwarded-for': ip },
    socket: { remoteAddress: ip },
    query: {},
    ...overrides,
  }
}

function validBody() {
  return {
    type: 'bug',
    title: 'Something is broken',
    description: 'When I do X then Y happens but Z was expected.',
    context: {
      appSha: 'abc1234',
      url: 'https://example.com/?member=A12345',
      memberNumber: 'A12345',
      division: 'CarryOptics',
      userAgent: 'Mozilla/5.0',
      viewport: '1440x900',
      timestamp: '2026-05-25T14:33:01.123Z',
    },
  }
}

beforeEach(() => {
  process.env['GITHUB_TOKEN'] = 'test-token'
  process.env['FEEDBACK_REPO'] = 'test-org/test-repo'
})

afterEach(() => {
  globalThis.fetch = originalFetch
  if (originalToken === undefined) delete process.env['GITHUB_TOKEN']
  else process.env['GITHUB_TOKEN'] = originalToken
  if (originalRepo === undefined) delete process.env['FEEDBACK_REPO']
  else process.env['FEEDBACK_REPO'] = originalRepo
  vi.restoreAllMocks()
})

describe('feedback endpoint', () => {
  it('rejects non-POST with 405', async () => {
    const req = makeReq({ method: 'GET' }, '10.0.0.1')
    const res = makeRes()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await handler(req as any, res as any)
    expect(res.statusCode).toBe(405)
    expect(res.body).toEqual({ error: 'method_not_allowed' })
  })

  it('returns 400 on invalid input', async () => {
    const req = makeReq({ body: { type: 'bug', title: 'no', description: 'short' } }, '10.0.0.2')
    const res = makeRes()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await handler(req as any, res as any)
    expect(res.statusCode).toBe(400)
    expect((res.body as { error: string }).error).toBe('invalid_input')
  })

  it('returns 500 when GITHUB_TOKEN is unset', async () => {
    delete process.env['GITHUB_TOKEN']
    const req = makeReq({}, '10.0.0.3')
    const res = makeRes()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await handler(req as any, res as any)
    expect(res.statusCode).toBe(500)
    expect(res.body).toEqual({ error: 'feedback_not_configured' })
  })

  it('returns issue url on github 201', async () => {
    globalThis.fetch = vi.fn<typeof fetch>(
      async () =>
        new Response(
          JSON.stringify({ html_url: 'https://github.com/o/r/issues/42', number: 42 }),
          { status: 201 },
        ),
    )
    const req = makeReq({}, '10.0.0.4')
    const res = makeRes()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await handler(req as any, res as any)
    expect(res.statusCode).toBe(200)
    expect(res.body).toEqual({
      ok: true,
      issueUrl: 'https://github.com/o/r/issues/42',
      issueNumber: 42,
    })
  })

  it('sends correct headers and body to GitHub', async () => {
    const fetchSpy = vi.fn<typeof fetch>(
      async () =>
        new Response(
          JSON.stringify({ html_url: 'https://github.com/o/r/issues/1', number: 1 }),
          { status: 201 },
        ),
    )
    globalThis.fetch = fetchSpy
    const req = makeReq({}, '10.0.0.5')
    const res = makeRes()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await handler(req as any, res as any)
    const [url, init] = fetchSpy.mock.calls[0]!
    expect(String(url)).toBe('https://api.github.com/repos/test-org/test-repo/issues')
    const headers = init?.headers as Record<string, string>
    expect(headers['Authorization']).toBe('Bearer test-token')
    expect(headers['Accept']).toBe('application/vnd.github+json')
    expect(headers['X-GitHub-Api-Version']).toBe('2022-11-28')
    const body = JSON.parse(String(init?.body)) as { title: string; body: string; labels: string[] }
    expect(body.title).toBe('[Bug] Something is broken')
    expect(body.labels).toEqual(['bug'])
    expect(body.body).toContain('**Type:** Bug')
    expect(body.body).toContain('When I do X then Y happens')
    expect(body.body).toContain('<details>')
    expect(body.body).toContain('CarryOptics')
  })

  it('maps github 5xx to 502 github_unavailable', async () => {
    globalThis.fetch = vi.fn<typeof fetch>(
      async () => new Response('bad', { status: 503 }),
    )
    const req = makeReq({}, '10.0.0.6')
    const res = makeRes()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await handler(req as any, res as any)
    expect(res.statusCode).toBe(502)
    expect(res.body).toEqual({ error: 'github_unavailable' })
  })

  it('maps github 403 with rate-limit header to 503 github_rate_limited', async () => {
    globalThis.fetch = vi.fn<typeof fetch>(
      async () =>
        new Response('rate limited', {
          status: 403,
          headers: { 'x-ratelimit-remaining': '0' },
        }),
    )
    const req = makeReq({}, '10.0.0.7')
    const res = makeRes()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await handler(req as any, res as any)
    expect(res.statusCode).toBe(503)
    expect(res.body).toEqual({ error: 'github_rate_limited' })
  })

  it('maps github 401 to 500 github_auth_failed', async () => {
    globalThis.fetch = vi.fn<typeof fetch>(
      async () => new Response('unauthorized', { status: 401 }),
    )
    const req = makeReq({}, '10.0.0.8')
    const res = makeRes()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await handler(req as any, res as any)
    expect(res.statusCode).toBe(500)
    expect(res.body).toEqual({ error: 'github_auth_failed' })
  })

  it('maps github 422 to 400 github_rejected', async () => {
    globalThis.fetch = vi.fn<typeof fetch>(
      async () => new Response('validation', { status: 422 }),
    )
    const req = makeReq({}, '10.0.0.9')
    const res = makeRes()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await handler(req as any, res as any)
    expect(res.statusCode).toBe(400)
    expect(res.body).toEqual({ error: 'github_rejected' })
  })

  it('rate-limits the 6th request from the same IP', async () => {
    globalThis.fetch = vi.fn<typeof fetch>(
      async () =>
        new Response(
          JSON.stringify({ html_url: 'https://github.com/o/r/issues/1', number: 1 }),
          { status: 201 },
        ),
    )
    const ip = '10.0.0.99'
    for (let i = 0; i < 5; i++) {
      const res = makeRes()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await handler(makeReq({}, ip) as any, res as any)
      expect(res.statusCode).toBe(200)
    }
    const res6 = makeRes()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await handler(makeReq({}, ip) as any, res6 as any)
    expect(res6.statusCode).toBe(429)
    expect(res6.body).toEqual({ error: 'rate_limited' })
  })

  it('accepts a fully-null (anonymous) context and renders _redacted_', async () => {
    const fetchSpy = vi.fn<typeof fetch>(
      async () =>
        new Response(
          JSON.stringify({ html_url: 'https://github.com/o/r/issues/2', number: 2 }),
          { status: 201 },
        ),
    )
    globalThis.fetch = fetchSpy
    const body = {
      type: 'other' as const,
      title: 'Anonymous report',
      description: 'No telemetry attached please.',
      context: {
        appSha: null,
        url: null,
        memberNumber: null,
        division: null,
        userAgent: null,
        viewport: null,
        timestamp: '2026-05-25T14:33:01.123Z',
      },
    }
    const req = makeReq({ body }, '10.0.2.0')
    const res = makeRes()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await handler(req as any, res as any)
    expect(res.statusCode).toBe(200)
    const sent = JSON.parse(String(fetchSpy.mock.calls[0]![1]?.body)) as { body: string }
    expect(sent.body).toContain('**URL:** _redacted_')
    expect(sent.body).toContain('**App version:** _redacted_')
    expect(sent.body).toContain('**User agent:** _redacted_')
    expect(sent.body).toContain('**Viewport:** _redacted_')
  })

  it('neutralizes markdown/html injection in description and context', async () => {
    const fetchSpy = vi.fn<typeof fetch>(
      async () =>
        new Response(
          JSON.stringify({ html_url: 'https://github.com/o/r/issues/1', number: 1 }),
          { status: 201 },
        ),
    )
    globalThis.fetch = fetchSpy
    const body = validBody()
    body.description =
      'hi @maintainer </details> see [click](https://evil.example) <img src=x onerror=alert(1)>'
    body.context.memberNumber = 'A12345'
    const req = makeReq({ body }, '10.0.3.0')
    const res = makeRes()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await handler(req as any, res as any)
    const sent = JSON.parse(String(fetchSpy.mock.calls[0]![1]?.body)) as { body: string }
    // No raw mention, link syntax, or HTML from user input survives into the body.
    expect(sent.body).not.toContain('@maintainer')
    expect(sent.body).not.toContain('[click](')
    expect(sent.body).not.toContain('<img')
    expect(sent.body).toContain('&#64;maintainer')
    expect(sent.body).toContain('&lt;img')
    expect(sent.body).toContain('&lt;/details&gt;') // injected closing tag is escaped
    // The template's own legitimate <details> block is untouched.
    expect(sent.body).toContain('<summary>Auto-attached context</summary>')
  })

  it('strips backticks from title', async () => {
    const fetchSpy = vi.fn<typeof fetch>(
      async () =>
        new Response(
          JSON.stringify({ html_url: 'https://github.com/o/r/issues/1', number: 1 }),
          { status: 201 },
        ),
    )
    globalThis.fetch = fetchSpy
    const body = validBody()
    body.title = 'has `backticks` here'
    const req = makeReq({ body }, '10.0.1.0')
    const res = makeRes()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await handler(req as any, res as any)
    const sent = JSON.parse(String(fetchSpy.mock.calls[0]![1]?.body)) as { title: string }
    expect(sent.title).toBe('[Bug] has backticks here')
  })
})
