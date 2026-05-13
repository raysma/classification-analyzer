# ScrapingAnt Integration Guide

Patterns for scraping JS-rendered sites via ScrapingAnt on a Vercel + React + TanStack Query stack. Generic enough to apply to any project.

---

## 1. ScrapingAnt API call (serverless function)

The proxy function is the only server code. Keep it narrow: validate input → fetch via ScrapingAnt → return HTML or a typed error.

```typescript
// api/your-endpoint.ts (Vercel Function, Node 24)
import type { VercelRequest, VercelResponse } from '@vercel/node'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const id = typeof req.query['id'] === 'string' ? req.query['id'] : ''
  if (!id || !VALID_ID_RE.test(id)) {
    res.status(400).json({ error: 'invalid_id' })
    return
  }

  const apiKey = process.env['SCRAPINGANT_API_KEY'] ?? ''
  if (!apiKey) {
    res.status(500).json({ error: 'scraping_not_configured' })
    return
  }

  const targetUrl = `https://example.com/records/${encodeURIComponent(id)}`
  const endpoint = new URL('https://api.scrapingant.com/v2/general')
  endpoint.searchParams.set('url', targetUrl)
  endpoint.searchParams.set('browser', 'true')   // headless Chrome; required for JS-rendered content

  // Optional: wait for a specific element before ScrapingAnt returns HTML.
  // Use when the data you need loads asynchronously after the initial render.
  // endpoint.searchParams.set('wait_for_selector', '.your-data-container')

  // Optional: run JS in the page before returning (e.g. submit a form, click a tab).
  // Value must be base64-encoded.
  // const js = Buffer.from(`document.querySelector('button.load-more')?.click()`).toString('base64')
  // endpoint.searchParams.set('js_snippet', js)

  // AbortController is essential on ScrapingAnt's free plan.
  // Promise.race alone does NOT abort the underlying fetch — the ScrapingAnt
  // browser slot stays occupied until the request completes or times out on
  // their end, hitting the free plan's concurrency limit of 1.
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
      try { detail = (await response.text()).slice(0, 500) } catch { /* ignore */ }
      console.error(`[ScrapingAnt] ${response.status}:`, detail)
      if (response.status === 401) {
        res.status(500).json({ error: 'scraping_auth_failed' })
        return
      }
      // 409 = free plan concurrency limit hit (only 1 concurrent browser session allowed)
      res.status(502).json({ error: 'fetch_failed', status: response.status, responseSnippet: detail })
      return
    }

    // ant-status-code reflects the target site's HTTP status, not ScrapingAnt's
    const originStatus = parseInt(response.headers.get('ant-status-code') ?? '200', 10)
    if (originStatus === 404) {
      res.status(404).json({ error: 'record_not_found' })
      return
    }

    html = await response.text()
  } catch (err) {
    clearTimeout(timeoutId)
    if (err instanceof Error && err.name === 'AbortError') {
      res.status(504).json({ error: 'upstream_timeout' })
      return
    }
    console.error('[endpoint] fetch error:', err instanceof Error ? err.message : String(err))
    res.status(502).json({ error: 'fetch_failed' })
    return
  }

  // ... parse html, validate, return JSON
}
```

### Key parameter reference

| Parameter | When to use |
|---|---|
| `browser=true` | Always, if the target uses JavaScript to render content |
| `wait_for_selector=.foo` | When data loads asynchronously; ScrapingAnt holds until selector appears |
| `js_snippet=<base64>` | To click a button, submit a form, or dismiss a dialog before capture |
| `proxy_type=residential` | If the target actively blocks datacenter IPs (adds cost) |

### Free plan gotcha

ScrapingAnt's free plan allows only **1 concurrent browser session**. A 409 response means another request is in-flight. `browser=true` costs ~10 credits per call. The `AbortController` ensures the session is released when you time out on your end — without it, the slot stays occupied and every subsequent request gets a 409 until ScrapingAnt's own timeout fires.

---

## 2. Preventing concurrent requests (TanStack Query)

The biggest source of 409 errors is the query library sending duplicate or retry requests.

```typescript
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      gcTime: 60 * 60 * 1000,
      retry: 0,   // Never auto-retry. One failed attempt = one error, not three 409s.
    },
  },
})
```

To force a refetch when the user resubmits the same ID:

```typescript
function handleLookup(id: string) {
  setId(id)
  queryClient.invalidateQueries({ queryKey: ['record', id] })
}
```

Without `invalidateQueries`, TanStack Query serves the cached (possibly stale or error) result instead of re-fetching when the same ID is submitted again.

---

## 3. `isFetching` vs `isLoading` — which to use where

```typescript
const { data, isFetching, error } = useQuery({ ... })
```

| | `isLoading` | `isFetching` |
|---|---|---|
| First fetch (no cache) | `true` | `true` |
| Refetch with cached data | `false` | `true` |

**Always use `isFetching`** to gate the submit button and drive the loading state. Using `isLoading` causes the button to re-enable mid-refetch, which lets the user fire a second concurrent request and hit the 409 concurrency limit.

```tsx
<button disabled={isFetching || !input.trim()}>
  {isFetching ? 'Looking up…' : 'Look up'}
</button>
```

---

## 4. Loading UX for 10–30 second waits

Browser-mode ScrapingAnt typically takes 10–30 seconds. A disabled button alone feels broken at that timescale. Show a spinner and an explicit status line:

```tsx
{isFetching && currentId && (
  <p className="text-sm text-gray-500 flex items-center gap-2">
    <svg className="animate-spin h-4 w-4 shrink-0" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
    </svg>
    Fetching {currentId} — may take up to 30 seconds…
  </p>
)}
```

Also show a spinner inside the button itself:

```tsx
<button type="submit" disabled={isFetching}>
  {isFetching && (
    <svg className="animate-spin h-4 w-4 shrink-0" /* same spinner svg */>
  )}
  {isFetching ? 'Looking up…' : 'Look up'}
</button>
```

Set user expectations explicitly. "May take up to 30 seconds" prevents rage-clicks that would cause concurrent requests, and prevents users from thinking the page is broken and refreshing (which resets the request entirely).

---

## 5. Defensive parser design

The parser should never throw — it should degrade gracefully and tell you *why* it failed.

```typescript
export type ParseResult =
  | { ok: true; doc: YourRecord; warnings: string[] }
  | { ok: false; error: string }

export function parseHtml(html: string): ParseResult {
  const document = parse(html)  // node-html-parser or linkedom

  // Detect wrong page first (bot challenge, redirect, login wall, etc.)
  // Check for at least one element that must exist on the target page.
  const hasExpectedContent = document.querySelector('.your-data-container') !== null
  if (!hasExpectedContent) {
    return { ok: false, error: 'parse_failed' }
  }

  const warnings: string[] = []

  // Parse defensively — push warnings for non-fatal misses rather than throwing.
  const nameEl = document.querySelector('.record-name')
  if (!nameEl) warnings.push('Could not find record name')

  const rows = document.querySelectorAll('table.data-table tbody tr')
  for (const row of Array.from(rows)) {
    const cells = Array.from(row.querySelectorAll('td'))
    if (cells.length < EXPECTED_COLUMN_COUNT) {
      warnings.push(`Skipping malformed row: only ${cells.length} cells`)
      continue
    }
    // ... parse cells
  }

  if (rows.length === 0) {
    return { ok: false, error: 'no_data_parsed' }
  }

  return { ok: true, doc: { /* ... */ }, warnings }
}
```

**Wrong-page detection is critical.** ScrapingAnt can return a Cloudflare challenge page, a login redirect, or any other intermediate page. If none of the structural elements you expect are present, return `parse_failed` immediately rather than trying to parse garbage.

---

## 6. Diagnosing `parse_failed` in production

When `parse_failed` fires, log enough HTML to diagnose remotely without pulling the full response:

```typescript
if (parsed.error === 'parse_failed') {
  const titleMatch = /<title[^>]*>([^<]*)<\/title>/i.exec(html)
  const pageTitle = titleMatch?.[1]?.trim() ?? '(no title)'
  // The first N chars are almost always <head> CSS/JS. Use the body offset instead.
  const bodyIdx = html.search(/<body[\s>]/i)
  const bodyStart = bodyIdx >= 0 ? bodyIdx : 0
  const snippet = html.slice(bodyStart, bodyStart + 500)
  console.error(`[api] parse_failed — title: "${pageTitle}" body[:500]: "${snippet}"`)
  res.status(502).json({
    error: 'parse_failed',
    responseSnippet: `Title: ${pageTitle}\n\n${snippet}`,
  })
  return
}
```

The page `<title>` alone usually tells you what went wrong:

| Title | Cause |
|---|---|
| Your expected title | CSS classes changed — update the parser |
| Generic site page (e.g. "Lookup - site.com") | Wrong URL, or page requires a form submission |
| "Just a moment…" / "Checking your browser" | Cloudflare challenge — try `proxy_type=residential` |
| "403 Forbidden" / "Sign in" | Bot detection or auth wall |

Surface the snippet in the API response body so your frontend's expandable error panel shows it during development without digging through server logs.

---

## 7. Client-side error handling

```typescript
// src/api/your-endpoint.ts
export class FetchError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly upstreamStatus?: number,
    public readonly responseSnippet?: string,
  ) {
    super(message)
    this.name = 'FetchError'
  }
}

export async function fetchRecord(id: string): Promise<Record> {
  const response = await fetch(`/api/your-endpoint?id=${encodeURIComponent(id)}`)

  if (!response.ok) {
    let code = 'unknown_error'
    let upstreamStatus: number | undefined
    let responseSnippet: string | undefined
    try {
      const body = await response.json() as { error?: string; status?: number; responseSnippet?: string }
      if (typeof body.error === 'string') code = body.error
      if (typeof body.status === 'number') upstreamStatus = body.status
      if (typeof body.responseSnippet === 'string') responseSnippet = body.responseSnippet
    } catch { /* ignore */ }
    throw new FetchError(code, `Request failed: ${response.status} ${code}`, upstreamStatus, responseSnippet)
  }

  return response.json()
}
```

Map error codes to user-facing messages in the error banner component:

```tsx
function ErrorBanner({ error }: { error: unknown }) {
  if (!error) return null
  let message = 'An unexpected error occurred.'
  let snippet: string | undefined

  if (error instanceof FetchError) {
    if (error.code === 'record_not_found') message = 'No record found with that ID.'
    else if (error.code === 'upstream_timeout') message = 'Request timed out — try again.'
    else if (error.code === 'fetch_failed') {
      const status = error.upstreamStatus ? ` (HTTP ${error.upstreamStatus})` : ''
      message = `Fetch failed${status}. The scraping service may be unavailable — try again.`
      snippet = error.responseSnippet
    } else if (error.code === 'parse_failed') {
      message = 'Could not parse the page — the site may have changed. Try again or use manual input.'
      snippet = error.responseSnippet
    } else {
      message = `Error: ${error.code}`
    }
  }

  return (
    <div role="alert" className="rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-800">
      <p>{message}</p>
      {snippet && (
        <details className="mt-2">
          <summary className="cursor-pointer text-xs font-medium opacity-70 hover:opacity-100">
            Response details
          </summary>
          <pre className="mt-1 text-xs overflow-auto max-h-36 whitespace-pre-wrap break-all rounded bg-red-100 px-2 py-1">
            {snippet}
          </pre>
        </details>
      )}
    </div>
  )
}
```

---

## 8. Checklist

- [ ] `browser=true` on ScrapingAnt for JS-rendered pages
- [ ] `AbortController` with `signal` on the `fetch` call — not `Promise.race`
- [ ] `retry: 0` in TanStack Query defaults
- [ ] Button disabled on `isFetching` (not `isLoading`)
- [ ] Visible spinner + "may take 30 seconds" status line while fetching
- [ ] `queryClient.invalidateQueries` in the submit handler for force-refetch
- [ ] Parser returns `{ ok, warnings }` — never throws
- [ ] Wrong-page detection at the top of the parser
- [ ] `parse_failed` logs page title + body snippet for remote diagnosis
- [ ] `ant-status-code` header checked for target site's actual HTTP status
- [ ] `SCRAPINGANT_API_KEY` in environment variables — never committed to repo
