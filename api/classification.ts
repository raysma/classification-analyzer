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

      // Find interesting anchors in the HTML to show relevant context
      const ANCHORS = ['member-info', 'division-block', 'classifier-table', 'current-class']
      const snippets: string[] = [
        `Page title: "${pageTitle}" | total length: ${totalLen}`,
      ]
      for (const anchor of ANCHORS) {
        const idx = html.toLowerCase().indexOf(anchor)
        if (idx >= 0) {
          const start = Math.max(0, idx - 100)
          snippets.push(`\n--- "${anchor}" found at offset ${idx} ---\n${html.slice(start, idx + 600)}`)
        } else {
          snippets.push(`\n--- "${anchor}" NOT FOUND IN PAGE ---`)
        }
      }
      // Show 3000 chars from the midpoint of the page (skips navigation, hits content)
      const midIdx = Math.floor(totalLen * 0.5)
      snippets.push(`\n--- MIDPOINT (offset ${midIdx}) ---\n${html.slice(midIdx, midIdx + 3000)}`)
      // Also look for the member form and show what follows it
      const formIdx = html.toLowerCase().indexOf('name="number"')
      if (formIdx >= 0) {
        const afterForm = html.indexOf('</form>', formIdx)
        const showFrom = afterForm >= 0 ? afterForm : formIdx + 200
        snippets.push(`\n--- AFTER MEMBER FORM (offset ${showFrom}) ---\n${html.slice(showFrom, showFrom + 3000)}`)
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
