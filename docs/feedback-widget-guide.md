# How to add an in-app feedback widget that files GitHub Issues

This is a self-contained recipe for adding a "Feedback" widget to any web app you maintain. Users open a small modal in your app, pick a category (Bug / Feature request / Other), type a title and description, hit Submit, and a labeled GitHub Issue is opened on your repo with auto-attached debug context (app version, current URL, browser, viewport). The GitHub PAT lives only on the server — the browser never sees it.

It was originally built for [`raysma/classification-analyzer`](https://github.com/raysma/classification-analyzer). The patterns assume **Vite + React + TypeScript + Tailwind + Zod + Vercel Functions**, with optional Zustand and Sentry. Adapt freely if your stack differs — the shape of the endpoint, the validation schema, the issue template, and the modal contract are the parts that matter.

---

## What you're building

```
[Browser]  ── POST /api/feedback {type, title, description, context}
                                 │
                                 ▼
                  [Vercel Function /api/feedback]
                  ├─ method check (POST only)
                  ├─ per-IP rate limit (5 / 10 min)
                  ├─ Zod-validate request body
                  ├─ read GITHUB_TOKEN from env (server-only)
                  ├─ POST to GitHub Issues API with PAT
                  └─ return {ok, issueUrl, issueNumber}
                                 │
                                 ▼
              [GitHub] ── new issue with label + auto-context
```

Token never leaves the server. Same-origin requests only — no `Access-Control-Allow-Origin`.

---

## Step 0: prerequisites

1. A GitHub repository where issues should land (you can override this per-env with a `FEEDBACK_REPO` var).
2. A **fine-grained personal access token** scoped to that one repo with `Issues: read and write` only:
   - Settings → Developer settings → Personal access tokens → Fine-grained tokens → Generate new token.
   - Resource owner: yourself or the org that owns the repo.
   - Repository access: only the target repo.
   - Permissions: `Issues: Read and write` (this is the only required permission).
   - Save the token; you'll add it as `GITHUB_TOKEN` in your hosting provider's env vars later.
3. A serverless function runtime (Vercel Functions in this guide; the patterns transfer to Netlify / Cloudflare Workers / AWS Lambda with minor edits).

---

## Step 1: define the Zod schemas

Put these next to your existing validation schemas. They are the trust boundary on both the client and the server.

```ts
// src/lib/validation.ts
import { z } from 'zod'

export const FeedbackTypeSchema = z.enum(['bug', 'feature_request', 'other'])

export const FeedbackContextSchema = z.object({
  appSha: z.string().max(64).nullable(),
  url: z.string().url().max(2048),
  // Replace `string().max(20).nullable()` with whatever app-specific
  // identifier is useful for triage, or remove this field entirely.
  memberNumber: z.string().max(20).nullable(),
  // Replace with whatever sub-section / division / route slug applies
  // to your app, or remove.
  division: z.string().max(40).nullable(),
  userAgent: z.string().max(500),
  viewport: z.string().regex(/^\d+x\d+$/),
  timestamp: z.string().min(1).max(40),
})

export const FeedbackInputSchema = z.object({
  type: FeedbackTypeSchema,
  title: z.string().trim().min(3).max(120),
  description: z.string().trim().min(10).max(4000),
  context: FeedbackContextSchema,
})

export const FeedbackResponseSchema = z.object({
  ok: z.literal(true),
  issueUrl: z.string().url(),
  issueNumber: z.number().int().positive(),
})

export type FeedbackType = z.infer<typeof FeedbackTypeSchema>
export type FeedbackContext = z.infer<typeof FeedbackContextSchema>
export type FeedbackInput = z.infer<typeof FeedbackInputSchema>
```

**Tune for your app**: trim or rename context fields. The key invariants are: limit every string length (the rendered issue body grows linearly with input size, and you don't want spam abusing your GitHub API quota), and make every field server-validated.

---

## Step 2: build the serverless endpoint

This is the only part of the system that holds the GitHub PAT. Keep it lean — fetch, validate, forward, return.

```ts
// api/feedback.ts
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createHash } from 'node:crypto'
import { FeedbackInputSchema, type FeedbackInput } from '../src/lib/validation.js'

const IS_PROD = process.env['NODE_ENV'] === 'production'
const DEFAULT_REPO = 'YOUR_ORG/YOUR_REPO' // ← change this
const GITHUB_TIMEOUT_MS = 10_000

// In-memory per-IP rate limit. Imperfect across cold-start instances of the
// function but enough to stop a single bad actor from burst-spamming Issues.
// If you outgrow this, swap in Vercel KV / Upstash Redis / Cloudflare KV.
const rateLimitStore = new Map<string, { count: number; resetAt: number }>()
const RATE_LIMIT_WINDOW_MS = 10 * 60_000
const RATE_LIMIT_MAX = 5

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

function normalizeMultiline(s: string): string {
  return s.replace(/\r\n/g, '\n').trim()
}

function buildIssueBody(input: FeedbackInput): string {
  const typeLabel =
    input.type === 'bug' ? 'Bug' :
    input.type === 'feature_request' ? 'Feature request' : 'Other'
  const desc = normalizeMultiline(input.description)
  const ctx = input.context
  return `**Type:** ${typeLabel}

${desc}

---

<details>
<summary>Auto-attached context</summary>

- **App version:** ${ctx.appSha ? `\`${ctx.appSha.slice(0, 7)}\`` : '`unknown`'}
- **URL:** ${ctx.url}
- **Section:** ${ctx.division ?? 'none'}
- **Viewport:** ${ctx.viewport}
- **User agent:** \`${stripBackticks(ctx.userAgent)}\`
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

  const ip =
    (typeof req.headers['x-forwarded-for'] === 'string'
      ? req.headers['x-forwarded-for'].split(',')[0]
      : req.socket.remoteAddress) ?? 'unknown'

  if (!checkRateLimit(ip)) {
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
    res.status(500).json({ error: 'feedback_not_configured' })
    return
  }
  const repo = process.env['FEEDBACK_REPO'] || DEFAULT_REPO

  const title = `${TITLE_PREFIX_BY_TYPE[input.type]} ${stripBackticks(input.title).trim()}`.slice(0, 250)
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
        'User-Agent': 'feedback-widget',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ title, body, labels }),
      signal: AbortSignal.timeout(GITHUB_TIMEOUT_MS),
    })
  } catch (err) {
    const isTimeout = err instanceof Error && err.name === 'TimeoutError'
    res.status(isTimeout ? 504 : 502).json({
      error: isTimeout ? 'upstream_timeout' : 'github_unavailable',
    })
    return
  }

  if (upstream.status === 201) {
    const json = (await upstream.json().catch(() => ({}))) as {
      html_url?: unknown
      number?: unknown
    }
    if (typeof json.html_url !== 'string' || typeof json.number !== 'number') {
      res.status(502).json({ error: 'github_unavailable' })
      return
    }
    res.status(200).json({ ok: true, issueUrl: json.html_url, issueNumber: json.number })
    return
  }

  // Upstream error mapping
  const rateLimitRemaining = upstream.headers.get('x-ratelimit-remaining')
  if (upstream.status === 401 || upstream.status === 403) {
    if (upstream.status === 403 && rateLimitRemaining === '0') {
      res.status(503).json({ error: 'github_rate_limited' })
      return
    }
    res.status(500).json({ error: 'github_auth_failed' })
    return
  }
  if (upstream.status === 422) {
    res.status(400).json({ error: 'github_rejected' })
    return
  }
  res.status(502).json({ error: 'github_unavailable' })
}
```

**Why no Octokit?** GitHub's REST API is a one-line `fetch` call. Pulling in `@octokit/rest` would bloat your deps for a single endpoint. Skip it.

**Why hash the IP?** If you forward errors to Sentry / Datadog / wherever, you can include `hashIp(ip)` as context for spam triage without storing PII. (The reference implementation does this; the example above omits Sentry for brevity.)

---

## Step 3: build the client wrapper

This file isolates the network call and the error handling so the modal stays focused on UI.

```ts
// src/api/feedback.ts
import { FeedbackResponseSchema, type FeedbackInput } from '../lib/validation'

export class FeedbackError extends Error {
  constructor(public readonly code: string, message: string) {
    super(message)
    this.name = 'FeedbackError'
  }
}

export async function submitFeedback(
  input: FeedbackInput,
): Promise<{ issueUrl: string; issueNumber: number }> {
  let response: Response
  try {
    response = await fetch('/api/feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    })
  } catch (err) {
    throw new FeedbackError('network_error', err instanceof Error ? err.message : 'Network error')
  }

  if (!response.ok) {
    let code = 'unknown_error'
    try {
      const body = (await response.json()) as { error?: unknown }
      if (typeof body.error === 'string') code = body.error
    } catch {
      // ignore
    }
    throw new FeedbackError(code, `Feedback request failed: ${response.status} ${code}`)
  }

  const raw: unknown = await response.json()
  const validated = FeedbackResponseSchema.safeParse(raw)
  if (!validated.success) {
    throw new FeedbackError('validation_failed', 'Response failed schema validation')
  }
  return { issueUrl: validated.data.issueUrl, issueNumber: validated.data.issueNumber }
}
```

---

## Step 4: build the modal

The modal does five things: collect the form, validate locally, build the auto-context, call `submitFeedback`, and render either an error banner or a success pane with the issue link. The privacy notice is **non-optional** — users must know that what they type ends up public.

Key UX requirements:

- **Mount via `createPortal(...)` on `document.body`** so the modal isn't clipped by parent overflow/transform.
- **Disable Submit until both fields meet their minimums.** Length counters under each field reduce surprise.
- **After success, replace the form with a confirmation pane** that links to the new issue. Don't auto-close — users want the receipt.
- **Privacy banner above Submit** in an amber/yellow callout.
- **All inputs disabled while submitting**; spinner on the Submit button.
- **Friendly error mapper**: map each error code from your endpoint to plain English. Surface unknown codes verbatim only as a fallback.

A minimal but complete version (Tailwind classes shown, adapt to your design system):

```tsx
// src/components/FeedbackModal.tsx
import { useState, type FormEvent } from 'react'
import { createPortal } from 'react-dom'
import { submitFeedback, FeedbackError } from '../api/feedback'
import type { FeedbackInput, FeedbackType } from '../lib/validation'

const TITLE_MIN = 3, TITLE_MAX = 120, DESC_MIN = 10, DESC_MAX = 4000

const TYPES: Array<{ value: FeedbackType; label: string }> = [
  { value: 'bug', label: 'Bug' },
  { value: 'feature_request', label: 'Feature request' },
  { value: 'other', label: 'Other' },
]

function friendlyError(code: string): string {
  switch (code) {
    case 'feedback_not_configured': return 'Feedback is temporarily unavailable.'
    case 'rate_limited':            return 'You’ve submitted several reports recently. Please wait a few minutes.'
    case 'github_rate_limited':     return 'GitHub is rate-limiting us. Please try again shortly.'
    case 'github_auth_failed':      return 'Couldn’t authenticate with GitHub. We’ve been notified.'
    case 'github_rejected':         return 'GitHub rejected the submission. Try shorter text.'
    case 'github_unavailable':      return 'GitHub is unavailable right now. Please try again.'
    case 'upstream_timeout':        return 'The request timed out. Please try again.'
    case 'invalid_input':           return 'Some fields didn’t pass validation.'
    case 'network_error':           return 'Network error. Check your connection and try again.'
    default:                        return `Something went wrong (${code}).`
  }
}

function buildContext(): FeedbackInput['context'] {
  // Replace these with calls into your own state store as needed.
  const sha = (import.meta.env['VITE_APP_SHA'] as string | undefined) ?? null
  return {
    appSha: sha,
    url: window.location.href,
    memberNumber: null,   // app-specific; pull from your store
    division: null,       // app-specific; pull from your store
    userAgent: navigator.userAgent.slice(0, 500),
    viewport: `${window.innerWidth}x${window.innerHeight}`,
    timestamp: new Date().toISOString(),
  }
}

export default function FeedbackModal({ onClose }: { onClose: () => void }) {
  const [type, setType] = useState<FeedbackType>('bug')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [errorCode, setErrorCode] = useState<string | null>(null)
  const [success, setSuccess] = useState<{ issueUrl: string; issueNumber: number } | null>(null)

  const tt = title.trim(), td = description.trim()
  const formValid =
    tt.length >= TITLE_MIN && tt.length <= TITLE_MAX &&
    td.length >= DESC_MIN && td.length <= DESC_MAX

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!formValid || submitting) return
    setSubmitting(true); setErrorCode(null)
    try {
      const result = await submitFeedback({
        type, title: tt, description: td, context: buildContext(),
      })
      setSuccess(result)
    } catch (err) {
      setErrorCode(err instanceof FeedbackError ? err.code : 'unknown_error')
    } finally {
      setSubmitting(false)
    }
  }

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        className="relative w-full max-w-lg max-h-[80vh] overflow-y-auto rounded-lg bg-white shadow-xl"
      >
        {/* header with title + close X */}
        {/* if success: show "Thanks — opened issue #N" linking to issueUrl + Close button */}
        {/* else: render the form (type select, title input, description textarea, */}
        {/*       length counters, amber privacy notice, error alert, Cancel + Submit) */}
      </div>
    </div>,
    document.body,
  )
}
```

(The reference implementation in this repo, `src/components/FeedbackModal.tsx`, has the full markup including dark-mode classes, spinner button, and counters. Copy from there if your styling baseline is close.)

---

## Step 5: wire it into your app shell

Two changes only:

```tsx
// App.tsx
import { useState } from 'react'
import FeedbackModal from './components/FeedbackModal'

// inside your top-level component:
const [showFeedback, setShowFeedback] = useState(false)

// inside your footer (or wherever):
<button type="button" onClick={() => setShowFeedback(true)}>
  Feedback
</button>

// at the end of the layout:
{showFeedback && <FeedbackModal onClose={() => setShowFeedback(false)} />}
```

**Keep open/close state local**, not in a global store. A modal is transient UI.

---

## Step 6: expose the commit SHA to the client

The endpoint already accepts an `appSha` in the context. To populate it, expose your build's commit SHA as a Vite env var at build time:

```ts
// vite.config.ts
export default defineConfig({
  // ...
  define: {
    'import.meta.env.VITE_APP_SHA': JSON.stringify(
      process.env['VERCEL_GIT_COMMIT_SHA'] ??   // Vercel
      process.env['COMMIT_REF'] ??              // Netlify
      process.env['CF_PAGES_COMMIT_SHA'] ??     // Cloudflare Pages
      process.env['GITHUB_SHA'] ??              // GitHub Actions
      null,
    ),
  },
})
```

If your hosting provider doesn't set one of these automatically, just leave it `null` — the issue body will print `unknown` instead of a SHA.

---

## Step 7: configure env vars on your host

Set in your hosting provider's project settings:

| Var | Required | Value |
|---|---|---|
| `GITHUB_TOKEN` | **yes** | The fine-grained PAT from Step 0. |
| `FEEDBACK_REPO` | no | Override the default repo. Useful if you want a test repo for non-prod environments. |

For local development, put them in a `.env.local` file at the project root (Vercel CLI reads it automatically).

---

## Step 8: write tests

Two tests cover the bulk of the risk:

### Endpoint test (`api/feedback.test.ts`)

Mock `globalThis.fetch`. Cover:

1. `GET /api/feedback` → 405.
2. Empty/invalid body → 400 with `error: 'invalid_input'`.
3. `GITHUB_TOKEN` unset → 500 with `error: 'feedback_not_configured'`.
4. Happy path (mock GitHub 201) → 200 with `{ ok, issueUrl, issueNumber }`.
5. Inspect the outgoing `fetch` call: verify the `Authorization: Bearer ...` header, the title prefix, the labels array, and that the body contains the auto-context block.
6. GitHub 5xx → 502.
7. GitHub 403 + `X-RateLimit-Remaining: 0` → 503.
8. GitHub 401 → 500 `github_auth_failed`.
9. GitHub 422 → 400 `github_rejected`.
10. Six requests from the same IP within a window → 6th gets 429.
11. Title with backticks → backticks stripped in the outgoing title.

### Modal test (`src/components/FeedbackModal.test.tsx`)

Use Testing Library. Cover:

1. Submit button disabled below min length.
2. On server error (mock 429), the error banner appears with the friendly message.
3. On success (mock 200 with valid body), the success pane renders with a link to the new issue.

Both test patterns are in the reference repo — copy `api/feedback.test.ts` and `src/components/FeedbackModal.test.tsx` as your starting point.

---

## Step 9: manual end-to-end verification

The most important step — automated tests can miss issues with auth or markdown rendering.

1. Create a throwaway repo `your-org/feedback-test` and generate a fine-grained PAT scoped only to it with `issues:write`.
2. Set `GITHUB_TOKEN=<that token>` and `FEEDBACK_REPO=your-org/feedback-test` in `.env.local`.
3. Run your dev server and the function host (`pnpm dev` + `pnpm dev:api` on Vercel).
4. Open the app, click your Feedback button, file one issue per category. Verify:
   - Each appears in `feedback-test` with the right label (`bug`, `enhancement`, `question`).
   - Title is prefixed with `[Bug]` / `[Feature request]` / `[Feedback]`.
   - The `<details>` block collapses cleanly on GitHub.
   - The user-agent in backticks renders as inline code, not as Markdown.
5. Failure paths to spot-check:
   - Unset `GITHUB_TOKEN` → expect 500 + "feedback not configured" banner.
   - Bad PAT → expect 500 + auth failure banner.
   - Submit 6× rapidly → 6th hits the rate limit banner.
   - `curl -X POST /api/feedback -d '{}'` → 400 with Zod issues (in non-prod).
   - `curl -X GET /api/feedback` → 405.
6. Switch `FEEDBACK_REPO` back to your real repo (or unset it so the default kicks in), deploy a preview build, and file one happy-path issue against production. Close it immediately if it's noise.

---

## Things to skip (and why)

- **Optional contact email field.** You'd have to render it cleanly in a public issue while making clear it'll be public. Easier to skip; users who want a reply will mention their handle in the description.
- **Captcha / hCaptcha / Turnstile.** Not worth the friction at v1. Rate limit + length cap is enough. Re-evaluate if real spam appears.
- **Profanity filter.** Same reason. You can always close abusive issues by hand.
- **Storing submissions in a database.** GitHub is your database. Adding KV/Redis only makes sense if you outgrow GitHub's API quotas, which won't happen at v1 traffic.
- **Octokit.** Bloat for a single endpoint. Plain `fetch` is fine.
- **GitHub App auth.** A fine-grained PAT is fine for a single-repo widget. The setup tax for an App (registration, private key, JWT signing) doesn't pay off until you're serving multiple installs.
- **Cross-origin support.** Don't set `Access-Control-Allow-Origin`. Same-origin only — keeps you off the public-API hook.

---

## Adapt to a non-Vercel host

The function code uses two things that aren't strictly Vercel-specific:

- `import type { VercelRequest, VercelResponse } from '@vercel/node'` — replace with your host's request/response types (Netlify's `Handler`, Cloudflare's `Request`/`Response`, AWS Lambda's `APIGatewayProxyHandler`, etc.).
- `req.headers['x-forwarded-for']` and `req.socket.remoteAddress` — most hosts expose the client IP under one of these or a similar header (e.g. Cloudflare's `cf-connecting-ip`). Use whichever is canonical.

The rest is plain Node 18+ (`fetch`, `AbortSignal.timeout`, `crypto.createHash`).

---

## Summary

You'll create three new files and modify three existing ones:

**New**:
- `api/feedback.ts` — serverless endpoint.
- `src/api/feedback.ts` — client wrapper.
- `src/components/FeedbackModal.tsx` — UI.

**Modify**:
- `src/lib/validation.ts` — add the four schemas + types.
- `src/App.tsx` (or your shell) — add the button + modal mount.
- `vite.config.ts` — expose the commit SHA as `VITE_APP_SHA`.

Plus tests for the endpoint and the modal, plus a README env-var entry for `GITHUB_TOKEN`.

Total surface: ~400 lines of code and ~250 lines of tests. End-to-end you should be done in under an hour once the PAT is in hand.
