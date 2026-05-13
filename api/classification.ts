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
  // USPSA now shows a lookup form on GET; submitting it (POST same URL) returns the record.
  // The form pre-fills from the URL, so we just need to submit it.
  const jsSnippet = Buffer.from(
    `(function(){` +
    `var f=document.querySelector('form[action="?"]')||` +
    `document.querySelector('input[name="number"]')?.closest('form');` +
    `if(f)f.submit();` +
    `})()`,
  ).toString('base64')
  endpoint.searchParams.set('js_snippet', jsSnippet)
  endpoint.searchParams.set('wait_for_selector', '.classifier-table')

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 60_000)

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
      // Find the body start to skip all the <head> CSS/JS boilerplate
      const bodyIdx = html.search(/<body[\s>]/i)
      const bodyStart = bodyIdx >= 0 ? bodyIdx : Math.floor(totalLen * 0.5)
      // Also extract all <form> tags to find the lookup form action + field names
      const formMatches: string[] = []
      const formRe = /<form[\s\S]{0,1000}?<\/form>/gi
      let fm: RegExpExecArray | null
      while ((fm = formRe.exec(html)) !== null && formMatches.length < 5) {
        formMatches.push(fm[0].slice(0, 400))
      }
      const responseSnippet = [
        `Page title: "${pageTitle}" | total length: ${totalLen} | body offset: ${bodyStart}`,
        `\n--- BODY START (${bodyStart}) to +3000 ---`,
        html.slice(bodyStart, bodyStart + 3000),
        `\n--- FORMS FOUND (${formMatches.length}) ---`,
        ...formMatches.map((f, i) => `\nForm ${i + 1}:\n${f}`),
      ].join('\n')
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
