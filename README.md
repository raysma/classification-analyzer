# Classification Analyzer

For USPSA competitors. Enter your member number to instantly see your full classifier history, track your classification percentage over time, and find out exactly what scores you need to reach the next class.

**Web**: [classification.rmshooting.com](https://classification.rmshooting.com) · **iOS**: TestFlight (see [`ios/README.md`](ios/README.md))  
**GitHub**: [github.com/raysma/classification-analyzer](https://github.com/raysma/classification-analyzer)

## Features

- **Automatic lookup** — enter any USPSA member number to fetch your full classifier history
- **Recent lookups** — last 10 successful lookups persist under the input; tap to re-run, swipe/trash to remove
- **Division tabs** — switch between divisions; each tab shows the classifier count
- **Classifier history table** — sortable, with flag descriptions on hover and color-coded Y/F rows
- **Classification summary** — current class letter, percentage, all-time best, and gap to the next class
- **Progress chart** — classification percentage plotted over time with class threshold lines; dark mode aware
- **Class-up insights** — "Journey to" any class: pick a target (GM–D) and see the average required across the next 1–5 classifiers, with direction-aware math (minimum required when going up, max allowed when dropping back down)
- **What-if simulator** — add hypothetical scores or exclude existing ones to project your classification percentage
- **Classifier calculator** — convert a hit factor into percent + class letter for any classifier code/division; send the result into What-If as a real-dated hypothetical
- **Manual paste** — paste your classifier table directly from USPSA.org when automatic lookup is unavailable
- **Feedback widget** — file bugs or feature requests in-app; routes to GitHub Issues with version + URL + browser auto-attached

## Platforms

- **Web** — React + Vite SPA on Vercel, [classification.rmshooting.com](https://classification.rmshooting.com).
- **iOS** — SwiftUI native app, iOS 18+, Liquid Glass on iOS 26. See [`ios/README.md`](ios/README.md) for the build/run/TestFlight workflow.

Both platforms share the same Vercel proxy and use a single port of the rules math (`src/lib/rules.ts` → `ios/Packages/USPSARules`).

## Quick start

```
pnpm install
pnpm dev          # Vite dev server (frontend only)
pnpm dev:api      # Vercel dev for the proxy function (separate terminal)
```

## Commands

| Command | Description |
|---|---|
| `pnpm dev` | Vite dev server |
| `pnpm dev:api` | Vercel dev (proxy function) |
| `pnpm build` | Production build |
| `pnpm test` | Vitest unit tests |
| `pnpm test:e2e` | Playwright smoke test |
| `pnpm lint` | ESLint |
| `pnpm format` | Prettier |
| `pnpm typecheck` | TypeScript check |

## Environment variables

The serverless functions read the following from Vercel project env vars:

| Variable | Required | Purpose |
|---|---|---|
| `ZYTE_API_KEY` | yes | Auth for the USPSA fetch proxy (`api/classification.ts`). |
| `SENTRY_DSN` | no | Server-side error reporting. When unset, errors are logged but not sent to Sentry. |
| `GITHUB_TOKEN` | yes (for feedback) | Fine-grained PAT scoped to `raysma/classification-analyzer` with `issues:write` only. Used by `api/feedback.ts` to file in-app feedback as GitHub Issues. |
| `FEEDBACK_REPO` | no | Override for the feedback issue target repo (default `raysma/classification-analyzer`). Useful for testing against a throwaway repo. |
| `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` | no | Durable rate-limit counters + a server-side cache in front of Zyte. When unset, rate limiting falls back to a per-instance in-memory counter and the cache is a no-op (every lookup hits Zyte). The Vercel KV integration's `KV_REST_API_URL` / `KV_REST_API_TOKEN` are also accepted. |

## Architecture

See [CLAUDE.md](CLAUDE.md) for full architecture, tech stack, and coding conventions.
