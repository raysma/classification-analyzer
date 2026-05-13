import type { VercelRequest, VercelResponse } from '@vercel/node'
import { parseClassificationHtml } from '../src/lib/parser.js'
import { ShooterRecordSchema } from '../src/lib/validation.js'

const MEMBER_RE = /^[A-Z]{1,3}\d+$/

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), ms)),
  ])
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const member = typeof req.query['member'] === 'string' ? req.query['member'] : ''

  if (!member || !MEMBER_RE.test(member)) {
    res.status(400).json({ error: 'invalid_member_number' })
    return
  }

  const apiKey = process.env['SCRAPINGANT_API_KEY'] ?? ''
  if (!apiKey) {
    res.status(500).json({ error: 'scraping_not_configured' })
    return
  }

  const targetUrl = `https://uspsa.org/classification/${encodeURIComponent(member)}`
  const endpoint = new URL('https://api.scrapingant.com/v2/general')
  endpoint.searchParams.set('url', targetUrl)
  endpoint.searchParams.set('browser', 'true')

  let html: string
  try {
    const response = await withTimeout(
      fetch(endpoint.toString(), {
        headers: { 'x-api-key': apiKey },
      }),
      60_000,
    )

    if (!response.ok) {
      let detail: string | undefined
      try {
        detail = (await response.text()).slice(0, 500)
      } catch {
        // ignore
      }
      console.error('[classification] ScrapingAnt error:', response.status, detail)
      if (response.status === 401) {
        res.status(500).json({ error: 'scraping_auth_failed' })
        return
      }
      res.status(502).json({ error: 'fetch_failed', status: response.status })
      return
    }

    const originStatus = parseInt(response.headers.get('ant-status-code') ?? '200', 10)
    if (originStatus === 404) {
      res.status(404).json({ error: 'member_not_found' })
      return
    }

    html = await response.text()
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    if (message === 'timeout') {
      res.status(504).json({ error: 'upstream_timeout' })
      return
    }
    console.error('[classification] fetch error:', message)
    res.status(502).json({ error: 'fetch_failed' })
    return
  }

  const parsed = parseClassificationHtml(html)

  if (!parsed.ok) {
    if (parsed.error === 'record_not_viewable') {
      res.status(404).json({ error: 'record_not_viewable' })
      return
    }
    res.status(502).json({ error: parsed.error })
    return
  }

  const validated = ShooterRecordSchema.safeParse(parsed.doc)
  if (!validated.success) {
    console.error('[classification] zod validation failed:', validated.error.message)
    res.status(502).json({ error: 'validation_failed', issues: validated.error.issues })
    return
  }

  res.setHeader('Cache-Control', 'public, s-maxage=900, stale-while-revalidate=3600')
  res.status(200).json({ ...validated.data, warnings: parsed.warnings })
}
