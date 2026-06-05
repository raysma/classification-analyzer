import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createHash } from 'node:crypto'
import * as Sentry from '@sentry/node'
import { FeedbackInputSchema, type FeedbackInput } from '../src/lib/validation.js'
import { getClientIp } from './_lib/clientIp.js'
import { checkRateLimit } from './_lib/rateLimit.js'

const IS_PROD = process.env['VERCEL_ENV'] === 'production'
const DEFAULT_REPO = 'raysma/classification-analyzer'
const GITHUB_TIMEOUT_MS = 10_000

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
    scope.setContext('feedback', context)
    Sentry.captureMessage(`${reason} — ${message}`, 'error')
  })
  await Sentry.flush(2000).catch(() => {})
}

// 5 submissions per IP per 10-minute window — tighter than classification's read
// endpoint because submissions become public GitHub Issues.
const RATE_LIMIT = { prefix: 'rl:feedback', max: 5, windowSeconds: 10 * 60 }

function hashIp(ip: string): string {
  return createHash('sha256').update(ip).digest('hex').slice(0, 8)
}

const LABEL_BY_TYPE: Record<FeedbackInput['type'], string> = {
  bug: 'bug',
  feature_request: 'enhancement',
  other: 'question',
}

const TITLE_PREFIX_BY_TYPE: Record<FeedbackInput['type'], string> = {
  bug: '[Bug]',
  feature_request: '[Feature request]',
  other: '[Feedback]',
}

function stripBackticks(s: string): string {
  return s.replace(/`+/g, '')
}

// Neutralize Markdown/HTML in free-form user text before it lands in a PUBLIC
// GitHub issue. Numeric HTML entities still render as the literal character, so
// prose stays readable while `@mentions`, `[phishing](links)`, raw HTML, and
// `</details>` breakout are all defanged.
function escapeIssueMarkdown(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/@/g, '&#64;')
    .replace(/`/g, '&#96;')
    .replace(/\[/g, '&#91;')
    .replace(/\]/g, '&#93;')
}

// Single-line context values are rendered as inline code spans, so backtick
// removal is enough to prevent breakout.
function codeSpan(s: string): string {
  return `\`${stripBackticks(s)}\``
}

function normalizeMultiline(s: string): string {
  return s.replace(/\r\n/g, '\n').trim()
}

function buildIssueBody(input: FeedbackInput): string {
  const typeLabel =
    input.type === 'bug' ? 'Bug' : input.type === 'feature_request' ? 'Feature request' : 'Other'
  const desc = normalizeMultiline(input.description)
  const ctx = input.context
  const redacted = '_redacted_'
  return `**Type:** ${typeLabel}

${escapeIssueMarkdown(desc)}

---

<details>
<summary>Auto-attached context</summary>

- **App version:** ${ctx.appSha ? `\`${ctx.appSha.slice(0, 7)}\`` : redacted}
- **URL:** ${ctx.url ? codeSpan(ctx.url) : redacted}
- **Member number:** ${ctx.memberNumber ? codeSpan(ctx.memberNumber) : redacted}
- **Division:** ${ctx.division ?? redacted}
- **Viewport:** ${ctx.viewport ?? redacted}
- **User agent:** ${ctx.userAgent ? `\`${stripBackticks(ctx.userAgent)}\`` : redacted}
- **Submitted:** ${ctx.timestamp}

</details>

<!-- Submitted via in-app feedback widget. -->
`
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'method_not_allowed' })
    return
  }

  const ip = getClientIp(req)

  if (!(await checkRateLimit(ip, RATE_LIMIT))) {
    res.status(429).json({ error: 'rate_limited' })
    return
  }

  const parsed = FeedbackInputSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({
      error: 'invalid_input',
      ...(IS_PROD ? {} : { issues: parsed.error.issues }),
    })
    return
  }
  const input = parsed.data

  const token = process.env['GITHUB_TOKEN']
  if (!token) {
    await reportFailure('github_token_missing', 'GITHUB_TOKEN not set', {
      ip: hashIp(ip),
    })
    res.status(500).json({ error: 'feedback_not_configured' })
    return
  }

  const repo = process.env['FEEDBACK_REPO'] || DEFAULT_REPO

  const title = `${TITLE_PREFIX_BY_TYPE[input.type]} ${stripBackticks(input.title).trim()}`.slice(
    0,
    250,
  )
  const body = buildIssueBody(input)
  const labels = [LABEL_BY_TYPE[input.type]]

  let upstream: Response
  try {
    upstream = await fetch(`https://api.github.com/repos/${repo}/issues`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'classification-analyzer-feedback',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ title, body, labels }),
      signal: AbortSignal.timeout(GITHUB_TIMEOUT_MS),
    })
  } catch (err) {
    const isTimeout = err instanceof Error && err.name === 'TimeoutError'
    await reportFailure(
      isTimeout ? 'github_timeout' : 'github_network_error',
      err instanceof Error ? err.message : String(err),
      { ip: hashIp(ip), repo },
    )
    res.status(isTimeout ? 504 : 502).json({
      error: isTimeout ? 'upstream_timeout' : 'github_unavailable',
    })
    return
  }

  if (upstream.status === 201) {
    let issueUrl = ''
    let issueNumber = 0
    try {
      const json = (await upstream.json()) as { html_url?: unknown; number?: unknown }
      if (typeof json.html_url === 'string') issueUrl = json.html_url
      if (typeof json.number === 'number') issueNumber = json.number
    } catch {
      // fall through to validation below
    }
    if (!issueUrl || !issueNumber) {
      await reportFailure('github_bad_response', 'missing html_url or number', {
        ip: hashIp(ip),
        repo,
      })
      res.status(502).json({ error: 'github_unavailable' })
      return
    }
    res.status(200).json({ ok: true, issueUrl, issueNumber })
    return
  }

  // Map upstream error statuses
  const upstreamStatus = upstream.status
  const detail = await upstream.text().catch(() => '')
  const rateLimitRemaining = upstream.headers.get('x-ratelimit-remaining')

  if (upstreamStatus === 401 || upstreamStatus === 403) {
    if (upstreamStatus === 403 && rateLimitRemaining === '0') {
      await reportFailure('github_rate_limited', 'github primary rate limit', {
        ip: hashIp(ip),
        repo,
      })
      res.status(503).json({ error: 'github_rate_limited' })
      return
    }
    await reportFailure('github_auth_failed', `github ${upstreamStatus}`, {
      ip: hashIp(ip),
      repo,
      detail: detail.slice(0, 500),
    })
    res.status(500).json({ error: 'github_auth_failed' })
    return
  }

  if (upstreamStatus === 422) {
    await reportFailure('github_rejected', 'github 422 validation failed', {
      ip: hashIp(ip),
      repo,
      detail: detail.slice(0, 500),
    })
    res.status(400).json({ error: 'github_rejected' })
    return
  }

  await reportFailure('github_unavailable', `github ${upstreamStatus}`, {
    ip: hashIp(ip),
    repo,
    detail: detail.slice(0, 500),
  })
  res.status(502).json({ error: 'github_unavailable' })
}
