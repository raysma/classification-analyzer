# Implementation Plan

Phased plan. Each phase ends in a working, deployable preview on Vercel. Sonnet should execute phases in order; merge each phase via PR to `develop` (and eventually `develop` → `main`) before starting the next.

See `CLAUDE.md` for the architecture, tech-stack non-negotiables, branch strategy, and coding conventions referenced throughout this plan.

---

## Phase 0 — Scaffolding and infra

**Deliverable**: empty React app deploys to Vercel; `develop` and `main` branches both have live URLs; CI green on every PR.

- [ ] `pnpm create vite@latest classification-analyzer -- --template react-ts` into a temp dir, then merge files into the repo root preserving the existing `.git/`, `README.md`, `CLAUDE.md`, `PLAN.md`.
- [ ] Install runtime deps: `pnpm add zustand zod @tanstack/react-query recharts linkedom`.
  - `linkedom` is used by the Vercel Function and by parser tests in node.
- [ ] Install dev deps: `pnpm add -D tailwindcss postcss autoprefixer vitest @testing-library/react @testing-library/jest-dom jsdom @vitejs/plugin-react eslint prettier eslint-plugin-react-hooks eslint-plugin-jsx-a11y @typescript-eslint/parser @typescript-eslint/eslint-plugin @vercel/node @playwright/test`.
- [ ] `pnpm dlx tailwindcss init -p`. Set `content` to `['./index.html', './src/**/*.{js,ts,jsx,tsx}']`. Enable `darkMode: 'class'`.
- [ ] Replace `src/index.css` with `@tailwind base; @tailwind components; @tailwind utilities;`.
- [ ] `vite.config.ts`: include Vitest block (`environment: 'jsdom'`, `setupFiles` for testing-library).
- [ ] `vercel.json`: SPA rewrite `{ "rewrites": [{ "source": "/((?!api/).*)", "destination": "/index.html" }] }` (excluding `/api/*` from the rewrite so the function still routes).
- [ ] `package.json` pins: `"engines": { "node": "24.x" }`, `"packageManager": "pnpm@10.33.0"` (use the current pinned versions at execution time).
- [ ] `package.json` scripts: `dev`, `dev:api` (`vercel dev`), `build`, `test`, `test:watch`, `test:e2e`, `lint`, `format`, `typecheck`.
- [ ] `.gitattributes`: `* text=auto`.
- [ ] Strict `tsconfig.json` (`"strict": true`, `"noUncheckedIndexedAccess": true`, `"exactOptionalPropertyTypes": true`).
- [ ] ESLint config covering TS, React Hooks, JSX a11y.
- [ ] Prettier config (single quotes, no semis or with semis — pick one and pin).
- [ ] Skeleton files: `src/main.tsx`, `src/App.tsx` rendering "Classification Analyzer", `src/types/index.ts` (empty), `src/lib/.gitkeep`, `src/store/.gitkeep`, `src/components/.gitkeep`.
- [ ] GitHub Actions `ci.yml`: `pnpm install --frozen-lockfile → typecheck → lint → test → build`, run on PRs targeting `develop` and `main`.
- [ ] Vercel: connect repo; set `develop` as the preview environment; enable preview deployments for all branches; protect `main` (require PR, require CI).
- [ ] Initial PR from `claude/uspsa-classifier-analyzer-xBXXd` → `develop` once scaffolding is in.
- [ ] Replace top-level `README.md` with a short user-facing description + link to `PLAN.md` / `CLAUDE.md`.

**Acceptance**: PR opens a Vercel preview at the branch URL; `develop` has its own stable preview; CI is green; the deployed page renders "Classification Analyzer".

---

## Phase 1 — USPSA fetch proxy + parser

**Deliverable**: `GET /api/classification?member=A12345` returns typed JSON for any valid member number.

- [ ] `api/classification.ts` Vercel Function:
  - Validate `member` against `^(A|TY|FY|L)\d+$`; return 400 otherwise.
  - Fetch `https://uspsa.org/classification/<member>` with User-Agent `classification-analyzer/0.1 (+github.com/raysma/classification-analyzer)`.
  - Pass status through (404 → 404, etc).
  - Detect "private/restricted record" pages (the response is 200 with a marker rather than a record table) and return 404 with `{ error: "record_not_viewable" }`.
  - `Cache-Control: public, s-maxage=900, stale-while-revalidate=3600`.
  - Wrap the fetch in a 10s timeout; return 504 on timeout.
- [ ] `src/lib/parser.ts` using `linkedom`:
  - Parse shooter header (name, membership type, member number).
  - Parse current-class blocks per division (letter + %).
  - Parse classifier tables per division: date, classifier code, name, hit factor, %, flag, source (club vs major match), match name when present.
- [ ] `src/lib/validation.ts`: Zod schemas for `Classifier` and `ShooterRecord` matching the data shape in `CLAUDE.md`. Function returns `parseClassificationHtml(html: string): { ok: true; doc: ShooterRecord } | { ok: false; error: string }`.
- [ ] Capture sanitized HTML fixtures under `tests/fixtures/uspsa/`, derived from the reference records listed in `CLAUDE.md`:
  - `A154528.html` — annual, multi-division.
  - `A86278.html` — annual, second shape sample.
  - `L4898.html` — lifetime; exercises the `L` prefix path.
  - `A155617.html` — private / restricted record; exercises the "record not viewable" path.
  - Plus one optional `unclassified.html` fixture (synthesized) for a shooter with <4 scores in every division.
  - Anonymize member numbers and names in each committed fixture. Preserve structure, classifier codes, dates, percentages, flags.
- [ ] Snapshot tests in `src/lib/parser.test.ts` exercising every fixture, including the private-record case (parser returns the restricted-record sentinel rather than an empty record).
- [ ] `src/api/classification.ts` (client wrapper): typed promise returning `ShooterRecord`, including the Zod parse at the boundary.

**Acceptance**: hitting `/api/classification?member=<known>` on the Vercel preview returns parsed JSON; parser snapshot tests pass; Zod validation rejects a known-bad fixture.

---

## Phase 2 — Lookup UX + record display

**Deliverable**: user can enter a member number, see all classifiers grouped by division, pick a division.

- [ ] `LookupForm.tsx`: input with format hint ("e.g. A12345 / TY53124 / L5727"); inline regex validation; submit triggers a query.
- [ ] `src/store/useAppStore.ts` Zustand slice for lookup state: `{ memberNumber, selectedDivision, lastLookupAt }`. Selected division persisted to `localStorage` (small UI flag, allowed).
- [ ] TanStack Query wrapping `/api/classification` with key `['classification', memberNumber]`; 5-minute stale time; visible loading + error states (404 → "no member found", 504 → "timed out, try again").
- [ ] `DivisionTabs.tsx` showing only divisions present in the record; shows score count per division.
- [ ] `ClassifierTable.tsx` for the selected division: columns date, classifier code, name, HF, %, flag, source; sortable; default newest-first; row tooltip explains flag meaning.
- [ ] URL-state via `URLSearchParams`: `?m=A12345&div=CarryOptics`. Implement `src/lib/urlState.ts` with a `useUrlState` hook that reads `window.location.search` on mount and writes via `history.replaceState`. Store subscribes; no routing library needed.
- [ ] Empty / unclassified states: "Only 2 of 4 classifiers in this division — needs 2 more for an initial classification."
- [ ] Restricted-record state: if the API returns `{ error: "record_not_viewable" }`, render a clear "this shooter's record is private" message with a link to USPSA support, not a generic error.

**Acceptance**: lookup an anonymized fixture member; see divisions, pick one, see the table; reload URL restores state.

---

## Phase 3 — Current class display + history chart

**Deliverable**: visible summary card for the selected division + a chart showing score history with a rolling-average line.

- [ ] Port `RollingWindow` + helpers from `uspsaprogress/progress/src/classifications.ts` into `src/lib/rules.ts`. Reimplement without `lodash` (native `Array.sort`, `.reduce`, `.slice`). Preserve attribution in a file-level comment + add NOTICE.
- [ ] `src/lib/rules.ts` exports:
  - `isInvalidFlag(flag: Flag): boolean` — excludes only `I`/`Q`/`N` (permissive, matches uspsaprogress).
  - `sortClassifiers(scores): Classifier[]` — by date asc, then percent asc.
  - `class RollingWindow` with `append(c)` (MRO via classifierCode dedup, 8-max truncation) and `classificationScore(): number | null`.
  - `bestSixOfRecentEight(window): { included: Classifier[]; dropped: Classifier[] }` — doc-faithful behavior per <https://uspsa.org/classification/about>: n=4 → mean of 4; n=5 → mean of 5; n=6 → mean of 6; n=7 → best 6 of 7; n≥8 → best 6 of recent 8.
  - `getCurrentWindow(scores): RollingWindow`.
  - `getClassificationHistory(scores): ClassificationSnapshot[]` for the chart's rolling-average line.
  - `classFor(percent: number): ClassLetter`.
  - `allTimeBestClass(history): ClassLetter` for the next-class-to-chase UX.
- [ ] Unit tests covering each helper, plus a fixture-based test that exercises a full record end-to-end and pins the resulting current % / class letter.
- [ ] `SummaryCard.tsx`: class letter, current %, next-class threshold, gap-to-next, count-in-window.
- [ ] `ProgressChart.tsx` (Recharts): x = date, y = %, scatter dots per classifier colored by class band; reference lines for D/C/B/A/M/GM thresholds; line plot of rolling-average snapshots. Toggle: "all scores" vs "current window only".
- [ ] Row highlighting in `ClassifierTable.tsx` for in-window scores vs dropped vs excluded.

**Acceptance**: summary card matches the % shown on `uspsa.org` for the same member; chart renders; `rules.test.ts` passes with the documented n=4..8 behavior.

---

## Phase 4 — Manual paste input

**Deliverable**: a collapsed disclosure below the lookup form lets a user paste the classifier table copied from the USPSA classification page and renders the same table / chart / summary pipeline. The fetch path remains the primary, recommended experience.

- [ ] Port `parseLine` / `parseTextInput` from `uspsaprogress/progress/src/parsing.ts` into `src/lib/textParser.ts`. Reimplement without `lodash` (native `Number.isNaN`, `Object` iteration).
  - Keep the two regexes: classifier row (`date  classifierNumber  club  flag  percent  hitFactor`) and major-match row (`date  club  flag  percent - - Major Match`).
  - Export `parsePastedTable(input: string, division: Division): { ok: true; classifiers: Classifier[]; parsedRows: number; skippedRows: number } | { ok: false; error: string }`.
  - File-level comment attributes `uspsaprogress/progress` (ISC) and links to the upstream source. Mirror entry in `NOTICE`.
- [ ] Unit tests in `src/lib/textParser.test.ts` covering both row formats, mixed flag values, decimal precision, header-line skipping, blank lines, and a real anonymized table dump.
- [ ] `ManualPastePanel.tsx`:
  - Disclosure widget (`<details>` or a custom accessible disclosure) **collapsed by default**, labeled e.g. "Paste classifier data manually".
  - Inside: a short instructions block ("Open your USPSA classification page, copy the classifier table for one division, paste it below."), a division dropdown so the user can tag which division the paste belongs to, a `<textarea>`, and a "Process pasted data" button.
  - On submit: call `parsePastedTable`; if `ok`, build a synthetic `ShooterRecord` with `source: "paste"`, `membershipType: "Unknown"`, name and member number left blank or filled from optional inline inputs, and write it to the same Zustand slice the fetch path uses. Show a small "parsed N rows, skipped M" summary.
  - Allow appending pastes for additional divisions to the same in-memory record (state merges new divisions in).
- [ ] Source badge in the header area: small chip showing "Fetched live" vs "Manual paste" so the rendered view is unambiguous.
- [ ] Reset button: clears the pasted record and returns to the empty state.
- [ ] Skip URL serialization of pasted records — pasted data is session-local. The "shareable URL" feature only applies to the fetch path.

**Acceptance**: paste a real USPSA table (single division) into the textarea, click process, and see the same table + summary card + chart + class-up insights render as for a fetched record. Switching to a different division via a second paste appends to the same record without clobbering the first.

---

## Phase 5 — Class-up insights

**Deliverable**: card showing, for N = 1..5 upcoming classifiers, the average % needed to class up.

- [ ] `src/lib/projection.ts` (ported and extended from `scoreNeededForTarget` in uspsaprogress):
  - `requiredAverageToClassUp(record, division, K): { minAvgPercent: number | null; feasible: boolean; targetClass: ClassLetter; targetThreshold: number; scoresInWindow: number }`.
  - Simulate K appends of uniform percent X, recompute `bestSixOfRecentEight`, binary-search X in [0, 110].
  - Uses `allTimeBestClass` as the floor — if the shooter has ever been A, the target is M, not A.
- [ ] `ClassUpInsights.tsx`: row of cards for K = 1..5; each shows required average, color badge (green ≤ 100%, amber 100–110%, red > 110% / infeasible).
- [ ] Tooltip text: "assumes you keep ≥X% on each of the next K classifiers".
- [ ] Pre-classified case (<4 scores): card explains how many more are needed before the math applies.
- [ ] Tests covering: A-class near M, B-class near A, fresh shooter with 0/2/4 scores, an already-GM shooter ("congratulations — top class").

**Acceptance**: hand-calculated examples in tests pass; cards render sensibly for each fixture. Manual-paste records produce the same insight numbers as fetched records for equivalent input.

---

## Phase 6 — What-if simulator

**Deliverable**: interactive panel projecting a new class % under user-defined scenarios.

- [ ] Zustand slice `scenario`: `{ excludedExistingIds: Set<string>; hypothetical: HypotheticalScore[] }`. Reset on division change.
- [ ] `WhatIfPanel.tsx`: list of existing in-window scores with toggle checkboxes (default = all in-window included).
- [ ] `HypotheticalScoreForm.tsx`: add a hypothetical score (percent 0–110, synthetic date for ordering). Up to 8 hypotheticals.
- [ ] Live recompute: feed `(currentWindow ∖ excludedExistingIds) ∪ hypothetical` through the same `bestSixOfRecentEight` pipeline; display projected class + %, delta vs current.
- [ ] Side-by-side comparison: actual vs projected (small `ProgressChart` overlay + numbers).
- [ ] URL serialization of the scenario as a compact query param so a scenario is shareable.
- [ ] Reset button.

**Acceptance**: removing the lowest in-window score raises projected %; adding a 95% score moves an A-class shooter into the M band; reset returns the panel to the current-state baseline.

---

## Phase 7 — Polish

- [ ] Mobile breakpoints (lookup → summary → table → chart stacks vertically).
- [ ] Dark mode toggle, default to system preference.
- [ ] Accessibility pass: keyboard navigation through table + chart legend; axe-core in Playwright; visible focus states.
- [ ] Error boundary with friendly fallback + "report" link.
- [ ] About page: rules, brackets, flag legend, link to USPSA source, attribution to `uspsaprogress/progress`.
- [ ] Privacy note: data is publicly available on uspsa.org; we don't store member numbers beyond the function's CDN cache.
- [ ] Optional: `@vercel/analytics` + `@vercel/speed-insights` gated behind an env var. Page-view / Core Web Vitals only.
- [ ] CHANGELOG.md kept current per release.

**Acceptance**: Lighthouse ≥90 perf/a11y/best-practices on production; axe-core finds no critical violations.

---

## Cross-cutting

- **Testing strategy**:
  - Unit tests for `parser`, `rules`, `projection` — these are where bugs hide.
  - Light component tests for `LookupForm` (validation) and `WhatIfPanel` (state wiring).
  - One Playwright smoke that mocks `/api/classification` and walks lookup → division pick → see chart → open what-if.
- **Mocking**: tests never hit `uspsa.org`. Parser tests exercise committed HTML fixtures. The function is mocked at the fetch layer.
- **Observability**: log parser failures with the failing selector / fixture digest (Vercel function logs). Counter for "parser fell back to defaults" events.
- **Rate limiting**: if USPSA pushes back, add per-IP 1 req/s in the function and a Vercel KV cache with a 24h TTL.
- **License / attribution**: `NOTICE` file crediting `uspsaprogress/progress` (ISC) for the ported math. File-level comment in `src/lib/rules.ts` linking to the source.

---

## Decisions on record

- **Stack**: Vite + React SPA + one Vercel Function. No Next.js.
- **Chart library**: Recharts. `ComposedChart` with `Scatter` (per-classifier points), `Line` (rolling average), and `ReferenceLine` (class thresholds).
- **Routing**: none. URL state via `URLSearchParams` + `history.replaceState` in a small `useUrlState` hook.
- **Classification window math**: doc-faithful per <https://uspsa.org/classification/about>. n=4 → mean of 4; n=5 → mean of 5; n=6 → mean of 6; n=7 → best 6 of 7; n≥8 → best 6 of recent 8.
- **Branch protection on `main`**: 1 reviewer required.
- **USPSA fetch from Vercel**: approved.
- **Fixtures**: derived from the four real records listed in `CLAUDE.md` (A154528, A86278, L4898, A155617), anonymized before commit.
