# Zyte experiment: parity test + ScrapingAnt 409 fallback

## Context

The Vercel function at `api/classification.ts` is the only server code in the repo and is the sole consumer of ScrapingAnt. We use ScrapingAnt's free tier, which limits concurrent requests to **1**, and ScrapingAnt returns **HTTP 409** when that limit is exceeded — so any time two USPSA lookups overlap in the wild, the second one fails. This branch evaluates Zyte as a candidate replacement for the scraping provider, and (if parity is good) wires up a "ScrapingAnt first → Zyte on 409" fallback so we keep paying ScrapingAnt's cheaper credits in the common case but absorb concurrency spikes on Zyte.

A dev/preview Vercel env var `ZYTE_API_KEY_DEV` is provisioned. This experiment runs on `feature/zyte-implementation` off `develop`; no production behavior changes until we PR it forward.

## What we use today vs. what Zyte offers

`api/classification.ts` calls ScrapingAnt's `https://api.scrapingant.com/v2/general` with `browser=true`, which spins up a fresh Headless Chrome, executes JS, and returns the rendered HTML (~10 credits/request). USPSA is JS-rendered and bot-protected, so the no-browser ScrapingAnt mode (`browser=false`, simple HTTP fetch) isn't viable.

Zyte's analog is the request body field `browserHtml: true` (full browser render) vs `httpResponseBody: true` (raw HTTP fetch). The toggle is implicit — you select the mode by asking for the corresponding response field, and the two are mutually exclusive. There is no `browser=true/false` query parameter.

| Capability | ScrapingAnt today | Zyte equivalent |
|---|---|---|
| Endpoint | `GET https://api.scrapingant.com/v2/general?url=…&browser=true` | `POST https://api.zyte.com/v1/extract` (JSON body) |
| Auth | `x-api-key` header | HTTP Basic, API key as username, empty password |
| JS rendering toggle | `browser=true` (query) / `browser=false` (default) | `browserHtml: true` (body) / `httpResponseBody: true` (body) — mutually exclusive |
| What we use | `browser=true` | `browserHtml: true` (parity) |
| Upstream status reported as | `ant-status-code` response header | `statusCode` field in JSON response body |
| Concurrency / rate-limit error | **HTTP 409** | **HTTP 429** (JSON `{"status":429,"type":"/limits/over-user-limit"}`); may also send 503 |
| Auth failure | HTTP 401 | HTTP 401 / 403 |

Implication: trigger from ScrapingAnt is **409**; from Zyte it would be 429. We encode this per-client as `reason: 'concurrency'` so the orchestrator stays provider-agnostic.

## Implementation

### Layout

```
api/
├── classification.ts            # orchestrator: validate → scrape → parse → Zod → respond
└── _lib/
    ├── scrapers.ts              # ScraperClient interface + dispatch / fallback
    ├── scrapingAntClient.ts     # existing logic, isolated; browser=true
    └── zyteClient.ts            # Zyte client; browserHtml: true
```

Shared result type:

```ts
type ScrapeResult =
  | { ok: true; html: string; upstreamStatus: number; provider: 'scrapingant' | 'zyte' }
  | { ok: false; reason: 'concurrency' | 'auth' | 'timeout' | 'upstream_404' | 'other';
      httpStatus?: number; detail?: string; provider: 'scrapingant' | 'zyte' }
```

`reason` mapping per client:
- ScrapingAnt **409** → `concurrency`; 401 → `auth`; `AbortError` → `timeout`; `ant-status-code: 404` → `upstream_404`; else → `other`
- Zyte **429** / **503** → `concurrency`; 401/403 → `auth`; `AbortError` → `timeout`; `statusCode === 404` in body → `upstream_404`; else → `other`

### Zyte client

- `POST https://api.zyte.com/v1/extract`
- Header: `Authorization: Basic ${base64(apiKey + ':')}`, `Content-Type: application/json`
- Body: `{ "url": targetUrl, "browserHtml": true }`
- 45s `AbortController` timeout (matches ScrapingAnt client).
- Parse JSON response; HTML in `body.browserHtml`; upstream status in `body.statusCode`.
- API key resolution: `process.env['ZYTE_API_KEY'] ?? process.env['ZYTE_API_KEY_DEV']`.

### Mode selection — `SCRAPER_MODE` env var

| Value | Behavior | Where |
|---|---|---|
| `scrapingant` | Today's behavior (default). | Prod stays here until promoted. |
| `zyte` | Pure Zyte. | Preview default for this branch — parity test. |
| `fallback` | ScrapingAnt first; on 409 retry once via Zyte. | Final target after parity verified. |

### Fallback logic (`SCRAPER_MODE=fallback`)

Fires **only on 409 from ScrapingAnt**:

1. Call ScrapingAnt.
2. `ok: true` → return.
3. `!ok && reason === 'concurrency'` → call Zyte, return its result.
4. Any other failure → return as-is. No timeout fallback in v1; measure first.

Observability: `X-Scraper-Provider: scrapingant|zyte` header on 2xx responses. Member numbers stay hashed (`hashMember()`).

### Tests

- `api/_lib/scrapingAntClient.test.ts` — per-`reason` mapping.
- `api/_lib/zyteClient.test.ts` — per-`reason` mapping; assert request body `browserHtml: true`; `statusCode: 404` → `upstream_404`.
- `api/_lib/scrapers.test.ts` — `fallback` mode: 409 triggers exactly one Zyte call; non-409 failures do not.

### Manual parity validation

With `SCRAPER_MODE=zyte` on preview:

1. Push branch → preview URL.
2. Walk reference records from `CLAUDE.md`:
    - `A154528` (multi-division annual)
    - `A86278` (annual)
    - `L4898` (lifetime, L prefix)
    - `A155617` (restricted — expect `record_not_viewable`)
3. Confirm `warnings: []`, summary card numbers and chart match production, and parser selectors hit on Zyte HTML.

Then flip preview to `SCRAPER_MODE=fallback` and force a 409 (invalid `SCRAPINGANT_API_KEY` or parallel lookups) to confirm `X-Scraper-Provider: zyte` on the fallback path.

## Risks

- **HTML divergence**: Zyte's browser fingerprint differs. The parser is defensive but selectors (`a.divisionClick`, `th[scope="row"]`) must hit. Halt and investigate if `warnings.length > 0`.
- **Cost**: parity test burns dev credits. `fallback` mode only pays Zyte on 409.
- **Env scope**: must hard-error `scraping_not_configured` when mode is `zyte`/`fallback` and no key resolvable, rather than silently 502.

## Verification

- `pnpm typecheck` clean.
- `pnpm test` green.
- `pnpm dev:api` sanity check with `SCRAPER_MODE=zyte` locally before pushing.
- Manual parity pass over reference records.
- `X-Scraper-Provider` observable in browser network tab.
- Forced 409 path verified end-to-end.

## Open follow-up

If parity is good and we promote, decide post-experiment whether to keep ScrapingAnt as primary + Zyte fallback (cost-optimal) or simplify to Zyte-only (one provider, less code).
