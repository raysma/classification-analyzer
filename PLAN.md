# Implementation Plan

The plan is broken into phases. Each phase ends in a working, deployable preview on Vercel. Sonnet should execute phases in order; do not start a phase before the prior one is merged.

## Phase 0 — Scaffolding and infra

**Deliverable**: empty React app deploys to Vercel; CI green.

- [ ] `pnpm create vite@latest classification-analyzer -- --template react-ts` into the repo root (manually merge with existing `README.md` / `.git`).
- [ ] Configure Tailwind (`tailwindcss`, `postcss`, `autoprefixer`); add base styles + dark-mode class strategy.
- [ ] Add ESLint (typescript-eslint, react-hooks, jsx-a11y), Prettier, `lint-staged` + `husky` pre-commit (optional).
- [ ] Add Vitest + React Testing Library; one smoke test.
- [ ] Add Playwright with a single homepage smoke test (run in CI on Linux).
- [ ] GitHub Actions workflow: `install → typecheck → lint → test → build` on PRs and `main`.
- [ ] Vercel project setup: `vercel.json` if needed; Node 20 runtime for functions; preview deploys on every branch.
- [ ] Replace placeholder `README.md` with a short user-facing description + link to PLAN.md / CLAUDE.md.

Acceptance: PR opens a Vercel preview, CI is green, root page renders "Classification Analyzer".

## Phase 1 — USPSA fetch proxy + parser

**Deliverable**: `GET /api/classification?member=A12345` returns typed JSON for any valid member number.

- [ ] Create `api/classification.ts` Vercel Function:
  - Validate `member` matches `^(A|TY|FY|L)\d+$`; return 400 otherwise.
  - Fetch `https://uspsa.org/classification/<member>` with a polite UA: `classification-analyzer/0.1 (+github.com/raysma/classification-analyzer)`.
  - Pass status through (404 → 404, etc).
  - Cache-Control: `public, s-maxage=900, stale-while-revalidate=3600`.
- [ ] Add `src/uspsa/parser.ts` using `linkedom` (works in both Node and tests):
  - Parse shooter header (name, membership type, member number).
  - Parse current-class blocks per division (letter + %).
  - Parse classifier tables per division: date, classifier code, classifier name, hit factor, %, flag, source (club vs major match).
- [ ] Add `src/uspsa/types.ts` matching the data shape in `CLAUDE.md`.
- [ ] Capture **3 sanitized HTML fixtures** under `tests/fixtures/uspsa/` (different membership types, varied flag distributions, multi-division). Snapshot-test the parser against each.
- [ ] Wire `api/classification.ts` to call the parser and return JSON.
- [ ] Add a thin client `src/api/classification.ts` returning a typed promise.

Acceptance: hitting `/api/classification?member=<known>` on the Vercel preview returns the parsed JSON; parser tests pass.

## Phase 2 — Lookup UX + record display

**Deliverable**: user can enter a member number, see all classifiers grouped by division, pick a division.

- [ ] Lookup form: input with mask hint ("e.g. A12345 / TY53124 / L5727"); inline validation; submit triggers query.
- [ ] TanStack Query wrapping `/api/classification` with key `[member]`; 5-minute stale time; visible loading + error states (404 → "no member found").
- [ ] Division selector chips/tabs showing only divisions with data; remember last-selected via `localStorage`.
- [ ] Records table for the selected division: columns date, classifier code, name, HF, %, flag; sortable; default newest-first; show flag legend on hover.
- [ ] Shareable URL: `/<memberNumber>/<division>` deep-links to a view (React Router).
- [ ] Empty / unclassified states ("only 2 of 4 classifiers in this division — needs N more").

Acceptance: enter `L5727`, see divisions, pick one, see the table; reload URL restores state.

## Phase 3 — Current class display + history graph

**Deliverable**: big visual summary for the selected division with a trended history chart.

- [ ] Summary card: class letter (e.g. "A"), current %, next-class threshold, gap-to-next, count of valid scores in window.
- [ ] Implement `src/uspsa/rules.ts`:
  - `computeWindow(classifiers)` → returns the most-recent-8 valid scores honoring `S`/`M`/`A`/`I`/`X`/`Q`/`N` flags.
  - `bestSixOfEight(window)` → 6 scores used + 2 dropped.
  - `currentPercent(classifiers)` → average of best 6.
  - `classFor(percent)` → `ClassLetter`.
  - Unit-test against the brackets and the published flag semantics.
- [ ] Highlight rows in the Phase-2 table for scores currently in the window vs dropped.
- [ ] Recharts line chart: x = date, y = %, dot per classifier; shaded class-band backgrounds (D/C/B/A/M/GM); optional linear regression trend line over the visible scores.
- [ ] Toggle "show all" vs "only scores in current window".

Acceptance: summary card matches the % shown on `uspsa.org` for the same member; chart renders; rules unit tests pass.

## Phase 4 — Class-up insights

**Deliverable**: card that tells the shooter, for N = 1..5 upcoming classifiers, the average % they'd need to class up.

- [ ] In `src/uspsa/projection.ts`, implement `requiredAverageToClassUp(record, division, N)` that:
  - Reads the current most-recent-8 window.
  - Simulates K identical new scores at `X%` being appended (each evicts the oldest of the rolling-8 window after sorting by date desc).
  - Binary-searches the smallest `X` such that `bestSixOfEight` of the new window ≥ next class threshold.
  - Returns `{ minAvgPercent, feasible: boolean, scoresInWindow }`.
- [ ] Render a row of N = 1..5 cards: each shows the required average %, plus a colored badge (green = feasible at ≤110%, red = mathematically impossible within N scores).
- [ ] Tooltip explaining "this assumes you keep ≥X% on each of the next N classifiers".
- [ ] Handle pre-classified case (<4 scores): show how many more are needed first.

Acceptance: unit tests cover representative shooters (A-class shooter near M, B-class shooter, fresh shooter with 0/2 scores). Numbers reconcile with hand-calculated examples.

## Phase 5 — What-if simulator

**Deliverable**: interactive panel to project a new class % under user-defined scenarios.

- [ ] Scenario state in Zustand: `{ includedExisting: Set<scoreId>, hypothetical: HypotheticalScore[] }`.
- [ ] Existing-scores list with checkboxes (default = current window) — unchecking simulates "what if this hadn't counted".
- [ ] "Add hypothetical score" form: % (0–110) and a synthetic date (default = today, editable for ordering).
- [ ] Compute projected class + % live as state changes; show delta vs current.
- [ ] Side-by-side comparison: actual vs projected (mini chart + numbers).
- [ ] Reset button.
- [ ] URL serialization of the scenario so it can be shared.

Acceptance: removing the lowest in-window score raises the %; adding a 95% score moves an A-class shooter into the M band when expected.

## Phase 6 — Polish

- [ ] Mobile breakpoints (lookup → table → chart stacks vertically).
- [ ] Dark mode toggle, system preference default.
- [ ] Accessibility pass: keyboard navigation through table + chart legend; axe-core in Playwright.
- [ ] Error boundary with friendly fallback + "report" link.
- [ ] About page: explain rules, brackets, flag legend, source link.
- [ ] Privacy note: we fetch publicly available data; we don't store member numbers server-side beyond function cache.
- [ ] Optional: Plausible / Vercel Analytics (privacy-friendly) — gate behind env var.

Acceptance: Lighthouse ≥90 perf/a11y/best-practices on the production deploy.

## Cross-cutting

- **Testing**: unit tests for parser, rules, projection; component tests for lookup form, table, what-if panel; one Playwright smoke that hits a mocked API.
- **Mocking**: tests should never hit `uspsa.org`. The proxy is mocked at the fetch layer; the parser is exercised against committed fixtures.
- **Observability**: log parser failures with the failing element selector (Vercel logs). Capture a structured event when the parser falls back to defaults.
- **Throttling**: if we see USPSA pushback, add a 1 req/s/IP limiter to the function.

## Open questions before execution

1. Vite SPA vs Next.js App Router? Plan currently assumes Vite + React SPA + a single Vercel Function.
2. Is `recharts` acceptable, or do you prefer `visx` / `chart.js` / native SVG?
3. Should historical fixtures be your own real records (with permission) or fully synthetic?
4. Any branding (colors, logo) you want from the start, or defer to Phase 6?
5. Is `practiscore-editor` public and meant to be cloned for scaffolding (it returned 404 when fetched anonymously)? If yes, share the actual structure / `package.json` and Phase 0 can mirror it instead of starting from `create-vite`.
