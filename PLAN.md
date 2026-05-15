# Implementation Plan

All phases are complete. The app is deployed to production on Vercel.

See `CLAUDE.md` for the architecture, tech-stack non-negotiables, branch strategy, and coding conventions.

---

## Completed phases

### Phase 0 — Scaffolding and infra
Vite + React + TS + Tailwind + Zustand + TanStack Query + Recharts project. Vercel connected; `develop` and `main` branches both have live preview URLs.

### Phase 1 — USPSA fetch proxy + parser
`GET /api/classification?member=<number>` returns typed JSON. Proxy fetches USPSA via Zyte (browser rendering), parses HTML with `node-html-parser`, Zod-validates the response. Handles private records, timeouts, partial-parse warnings.

### Phase 2 — Lookup UX + record display
Member number input with inline validation, TanStack Query fetch with loading/error states, division tabs, sortable classifier history table, URL state via `URLSearchParams`.

### Phase 3 — Current class display + history chart
`src/lib/rules.ts` rolling window (best-6-of-8, MRO dedup), classification summary card, Recharts progress chart with class threshold reference lines.

### Phase 4 — Manual paste input
`src/lib/textParser.ts` parses pasted USPSA table text (both 6-column and 8-column 2025+ formats, 2-digit year dates). `ManualPastePanel.tsx` collapsed disclosure with division selector and textarea.

### Phase 5 — Class-up insights
`src/lib/projection.ts` binary-search projection. `ClassUpInsights.tsx` shows required average % for K = 1..5 upcoming classifiers, with feasibility color coding.

### Phase 6 — What-if simulator
Zustand scenario slice. `WhatIfPanel.tsx` with per-score Y/F badge indicators, strikethrough for pushed-out scores, live projected class/% delta.

### Phase 7 — Polish
Dark mode (light/auto/dark toggle, OS-aware, persisted), color-coded percent column, all-time-best display in summary card, division name formatting with spaces.

---

## Decisions on record

- **Stack**: Vite + React SPA + one Vercel Function. No Next.js.
- **Node version**: `24.x` (pinned via `engines.node`).
- **Chart library**: Recharts. `ComposedChart` with `Scatter`, `Line`, and `ReferenceLine`.
- **Routing**: none. URL state via `URLSearchParams` + `history.replaceState`.
- **Classification window math**: doc-faithful per <https://uspsa.org/classification/about>. n=4 → mean of 4; n=5 → mean of 5; n=6 → mean of 6; n=7 → best 6 of 7; n≥8 → best 6 of recent 8.
- **Member number validation**: loose, `^[A-Z]{1,3}\d+$`.
- **Next-class-to-chase floor**: per-division all-time-best. USPSA's cross-division adjustment is already in the `currentClasses` we parse.
- **Dates**: TZ-naive `YYYY-MM-DD` strings throughout `lib/`. Convert to `Date` only at chart-rendering time.
- **Parser failure mode**: `{ ok: true; doc; warnings: string[] }` on partial parse; hard error only when zero rows parse.
- **TanStack Query persistence**: `persistQueryClient` + localStorage, scoped to classification keys only.
- **USPSA fetch**: via Zyte with `browserHtml: true` to handle bot-protected, JS-rendered pages. Replaced ScrapingAnt (2026-05-15) after parity testing — ScrapingAnt's free-tier 1-concurrent-request cap was returning HTTP 409 on overlapping lookups in production.
