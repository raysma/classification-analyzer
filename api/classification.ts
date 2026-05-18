import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createHash } from 'node:crypto'
import * as Sentry from '@sentry/node'
import { parseClassificationHtml } from '../src/lib/parser.js'
import { ShooterRecordSchema } from '../src/lib/validation.js'
import { fetchViaZyte, ZYTE_TIMEOUT_MS } from './_lib/zyteClient.js'

const MEMBER_RE = /^[A-Z]{1,3}\d+$/
const IS_PROD = process.env['VERCEL_ENV'] === 'production'

const SENTRY_DSN = process.env['SENTRY_DSN']
if (SENTRY_DSN) {
  const release = process.env['VERCEL_GIT_COMMIT_SHA']
  Sentry.init({
    dsn: SENTRY_DSN,
    tracesSampleRate: 0,
    skipOpenTelemetrySetup: true,
    environment: process.env['VERCEL_ENV'] ?? 'development',
    ...(release ? { release } : {}),
  })
}

async function reportFailure(
  reason: string,
  message: string,
  context: Record<string, unknown>,
): Promise<void> {
  if (!SENTRY_DSN) return
  Sentry.withScope((scope) => {
    scope.setTag('reason', reason)
    scope.setContext('classification', context)
    Sentry.captureMessage(`${reason} — ${message}`, 'error')
  })
  await Sentry.flush(2000).catch(() => {})
}

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

  const targetUrl = `https://uspsa.org/classification/${encodeURIComponent(member)}`

  const result = await fetchViaZyte(targetUrl)

  if (!result.ok) {
    if (result.reason === 'not_configured') {
      res.status(500).json({ error: 'scraping_not_configured' })
      return
    }
    if (result.reason === 'upstream_404') {
      res.status(404).json({ error: 'member_not_found' })
      return
    }
    if (result.reason === 'auth') {
      await reportFailure('zyte_auth_failed', `zyte ${result.httpStatus ?? '?'}`, {
        member: hashMember(member),
        httpStatus: result.httpStatus,
        detail: result.detail?.slice(0, 500),
      })
      res.status(500).json({ error: 'scraping_auth_failed' })
      return
    }
    if (result.reason === 'timeout') {
      await reportFailure('upstream_timeout', `zyte timeout after ${ZYTE_TIMEOUT_MS}ms`, {
        member: hashMember(member),
      })
      res.status(504).json({ error: 'upstream_timeout' })
      return
    }
    await reportFailure('fetch_failed', `zyte ${result.reason} ${result.httpStatus ?? ''}`.trim(), {
      member: hashMember(member),
      zyteReason: result.reason,
      httpStatus: result.httpStatus,
      detail: result.detail?.slice(0, 500),
    })
    res.status(502).json({
      error: 'fetch_failed',
      ...(result.httpStatus ? { status: result.httpStatus } : {}),
      ...(IS_PROD ? {} : result.detail ? { responseSnippet: result.detail } : {}),
    })
    return
  }

  const html = result.html

  const parsed = parseClassificationHtml(html)

  if (!parsed.ok) {
    if (parsed.error === 'record_not_viewable') {
      res.status(404).json({ error: 'record_not_viewable' })
      return
    }
    if (parsed.error === 'member_not_found') {
      res.status(404).json({ error: 'member_not_found' })
      return
    }
    if (parsed.error === 'parse_failed') {
      const titleMatch = /<title[^>]*>([^<]*)<\/title>/i.exec(html)
      const pageTitle = titleMatch?.[1]?.trim() ?? '(no title)'
      const totalLen = html.length

      console.error(
        `[classification] parse_failed member=${hashMember(member)} title="${pageTitle}" len=${totalLen}`,
      )

      await reportFailure('parse_failed', `title="${pageTitle}" len=${totalLen}`, {
        member: hashMember(member),
        pageTitle,
        htmlLength: totalLen,
      })

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
              (firstDivLink
                ? `\nfirst divisionClick data-division="${firstDivLink.getAttribute('data-division')}"`
                : ''),
          )
        } catch (e) {
          snippets.push(`\n--- DOM parse error: ${e} ---`)
        }
        const classifierScoresIdx = html.toLowerCase().indexOf('classifier scores')
        if (classifierScoresIdx >= 0) {
          snippets.push(
            `\n--- "Classifier Scores" at offset ${classifierScoresIdx} ---\n${html.slice(classifierScoresIdx, classifierScoresIdx + 3000)}`,
          )
        } else {
          snippets.push('\n--- "Classifier Scores" NOT FOUND ---')
        }
        responseSnippet = snippets.join('\n')
      }

      res
        .status(502)
        .json({ error: 'parse_failed', ...(responseSnippet ? { responseSnippet } : {}) })
      return
    }
    res.status(502).json({ error: parsed.error })
    return
  }

  const validated = ShooterRecordSchema.safeParse(parsed.doc)
  if (!validated.success) {
    console.error('[classification] zod validation failed:', validated.error.message)
    await reportFailure('validation_failed', validated.error.message, {
      member: hashMember(member),
      issues: validated.error.issues.slice(0, 10),
    })
    res.status(502).json({
      error: 'validation_failed',
      ...(IS_PROD ? {} : { issues: validated.error.issues }),
    })
    return
  }

  if (parsed.warnings.length > 0) {
    console.warn(
      `[classification] ${parsed.warnings.length} warning(s) for member=${hashMember(member)}: ${parsed.warnings.slice(0, 5).join(' | ')}`,
    )
    const unknownFlags = new Set<string>()
    for (const w of parsed.warnings) {
      const m = /^Unrecognized flag "([^"]*)"/.exec(w)
      if (m && m[1] !== undefined) unknownFlags.add(m[1])
    }
    if (unknownFlags.size > 0) {
      console.warn(`[classification] FLAGS=[${[...unknownFlags].join(',')}]`)
    }
  }

  res.setHeader('Cache-Control', 'private, max-age=0, s-maxage=900, stale-while-revalidate=3600')
  res.status(200).json({ ...validated.data, warnings: parsed.warnings })
}
