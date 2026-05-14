import type { VercelRequest, VercelResponse } from '@vercel/node'
import { parseClassificationHtml } from '../src/lib/parser.js'
import { ShooterRecordSchema } from '../src/lib/validation.js'

const MEMBER_RE = /^[A-Z]{1,3}\d+$/

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
      console.error(`[ScrapingAnt] ${response.status}:`, detail)
      if (response.status === 401) {
        res.status(500).json({ error: 'scraping_auth_failed' })
        return
      }
      res.status(502).json({ error: 'fetch_failed', status: response.status, responseSnippet: detail })
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

      const snippets: string[] = [
        `Page title: "${pageTitle}" | total length: ${totalLen}`,
      ]

      // Test the exact selectors the new parser relies on
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

      // Show 3000 chars starting from "Classifier Scores"
      const classifierScoresIdx = html.toLowerCase().indexOf('classifier scores')
      if (classifierScoresIdx >= 0) {
        snippets.push(`\n--- "Classifier Scores" at offset ${classifierScoresIdx} ---\n${html.slice(classifierScoresIdx, classifierScoresIdx + 3000)}`)
      } else {
        snippets.push('\n--- "Classifier Scores" NOT FOUND ---')
      }

      const responseSnippet = snippets.join('\n')
      console.error(`[classification] parse_failed for ${member} — title: "${pageTitle}" len: ${totalLen}`)
      res.status(502).json({ error: 'parse_failed', responseSnippet })
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
