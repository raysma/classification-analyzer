import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createHash } from 'node:crypto'
import { parseClassificationHtml } from '../src/lib/parser.js'
import { ShooterRecordSchema } from '../src/lib/validation.js'

const MEMBER_RE = /^[A-Z]{1,3}\d+$/
const IS_PROD = process.env['VERCEL_ENV'] === 'production'

// In-memory rate limit: 20 requests per IP per 60-second window.
// Imperfect across cold-start instances, but catches burst abuse on warm functions.
const rateLimitStore = new Map<string, { count: number; resetAt: number }>()
const RATE_LIMIT_WINDOW_MS = 60_000
const RATE_LIMIT_MAX = 20

function checkRateLimit(ip: string): boolean {
  const now = Date.now()
  const entry = rateLimitStore.get(ip)
  if (!entry || now >= entry.resetAt) {
    rateLimitStore.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS })
    return true
  }
  if (entry.count >= RATE_LIMIT_MAX) return false
  entry.count++
  return true
}

function hashMember(member: string): string {
  return createHash('sha256').update(member).digest('hex').slice(0, 8)
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.status(405).json({ error: 'method_not_allowed' })
    return
  }

  const member = typeof req.query['member'] === 'string' ? req.query['member'] : ''

  if (!member || !MEMBER_RE.test(member)) {
    res.status(400).json({ error: 'invalid_member_number' })
    return
  }

  const ip =
    (typeof req.headers['x-forwarded-for'] === 'string'
      ? req.headers['x-forwarded-for'].split(',')[0]
      : req.socket.remoteAddress) ?? 'unknown'
  if (!checkRateLimit(ip)) {
    res.status(429).json({ error: 'rate_limited' })
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

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 45_000)

  let html: string
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
        res.status(500).json({ error: 'scraping_auth_failed' })
        return
      }
      res.status(502).json({
        error: 'fetch_failed',
        status: response.status,
        ...(IS_PROD ? {} : { responseSnippet: detail }),
      })
      return
    }

    const originStatus = parseInt(response.headers.get('ant-status-code') ?? '200', 10)
    if (originStatus === 404) {
      res.status(404).json({ error: 'member_not_found' })
      return
    }

    html = await response.text()
  } catch (err) {
    clearTimeout(timeoutId)
    if (err instanceof Error && err.name === 'AbortError') {
      res.status(504).json({ error: 'upstream_timeout' })
      return
    }
    const message = err instanceof Error ? err.message : String(err)
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
    if (parsed.error === 'parse_failed') {
      const titleMatch = /<title[^>]*>([^<]*)<\/title>/i.exec(html)
      const pageTitle = titleMatch?.[1]?.trim() ?? '(no title)'
      const totalLen = html.length

      console.error(`[classification] parse_failed member=${hashMember(member)} title="${pageTitle}" len=${totalLen}`)

      let responseSnippet: string | undefined
      if (!IS_PROD) {
        const snippets: string[] = [
          `Page title: "${pageTitle}" | total length: ${totalLen}`,
        ]
        try {
          const { parse: parseHtml } = await import('node-html-parser')
          const doc = parseHtml(html)
          const divLinks = doc.querySelectorAll('a.divisionClick')
          const memberThs = doc.querySelectorAll('th[scope="row"]')
          const firstDivLink = divLinks[0]
          snippets.push(
            `\n--- DOM SELECTOR RESULTS ---` +
            `\na.divisionClick count: ${divLinks.length}` +
            `\nth[scope="row"] count: ${memberThs.length}` +
            (firstDivLink ? `\nfirst divisionClick data-division="${firstDivLink.getAttribute('data-division')}"` : '')
          )
        } catch (e) {
          snippets.push(`\n--- DOM parse error: ${e} ---`)
        }
        const classifierScoresIdx = html.toLowerCase().indexOf('classifier scores')
        if (classifierScoresIdx >= 0) {
          snippets.push(`\n--- "Classifier Scores" at offset ${classifierScoresIdx} ---\n${html.slice(classifierScoresIdx, classifierScoresIdx + 3000)}`)
        } else {
          snippets.push('\n--- "Classifier Scores" NOT FOUND ---')
        }
        responseSnippet = snippets.join('\n')
      }

      res.status(502).json({ error: 'parse_failed', ...(responseSnippet ? { responseSnippet } : {}) })
      return
    }
    res.status(502).json({ error: parsed.error })
    return
  }

  const validated = ShooterRecordSchema.safeParse(parsed.doc)
  if (!validated.success) {
    console.error('[classification] zod validation failed:', validated.error.message)
    res.status(502).json({
      error: 'validation_failed',
      ...(IS_PROD ? {} : { issues: validated.error.issues }),
    })
    return
  }

  res.setHeader('Cache-Control', 'private, max-age=0, s-maxage=900, stale-while-revalidate=3600')
  res.status(200).json({ ...validated.data, warnings: parsed.warnings })
}
