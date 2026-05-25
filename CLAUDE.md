# classification-analyzer

A web app that fetches a USPSA shooter's classification record by member number, visualizes their progression over time, and shows what they need to do in upcoming classifiers to class up.

## Goals

1. Look up a shooter's full classifier history from `uspsa.org` given just a member number (primary, automated path).
2. Show records in a sortable table, filterable by division.
3. Display the shooter's current classification + percentage for the selected division.
4. Plot scores over time with a trend line / rolling-average line.
5. Compute the average percentage required across the next N classifiers (N = 1..5) to reach the next class.
6. Provide a "what-if" simulator: add hypothetical future scores and/or include/exclude current scores to see the resulting class %.
7. Offer a secondary **manual-paste input**: a collapsed disclosure under the lookup form where a user can paste the classifier table from the USPSA page (mirroring `uspsaprogress/progress`'s UX). Parsed via regex into the same `ShooterRecord` shape and rendered through the same downstream pipeline. Used when automated fetch is blocked, when working from a saved copy, or for privacy.

## Prior art

- **`uspsaprogress/progress`** (TS + webpack + vanilla DOM, ISC). Origin of the rules math ported into `src/lib/rules.ts`: rolling window, MRO via classifier-number dedup, score-needed projection, and the "all-time-best class as the next-class-to-chase floor" UX detail. The lodash dependency is stripped during port. Attribution lives at the top of `src/lib/rules.ts`.
- **`practiscore-editor`** (sibling project). Architectural blueprint via `architecture-template.md`. Provides the stack (Vite + React + TS + Tailwind + Zustand + Zod + Vitest + Vercel), the project layout, the `develop` + `main` branch strategy, and the coding conventions used throughout.

## Tech stack (non-negotiables)

| Concern              | Choice                                    | Why                                                                 |
|----------------------|-------------------------------------------|---------------------------------------------------------------------|
| Language             | **TypeScript** (strict, no `any`)         | Catches bugs at the parser/rules boundary.                          |
| UI framework         | **React 18** (function components only)   | Plenty of escape hatches; no `React.FC`.                            |
| Build tool           | **Vite 5**                                | Fast dev server, ESM-native, zero-config TS/JSX.                    |
| Styling              | **Tailwind CSS**                          | No CSS files to manage, no class-name collisions.                   |
| State                | **Zustand**                               | One store, no providers. Scenario state lives here.                 |
| Data fetching        | **TanStack Query**                        | Caching/staleness for `/api/classification`.                        |
| Schema validation    | **Zod**                                   | Validate the proxy response before it hits the rules layer.         |
| Charts               | **Recharts**                              | Good React/TS story; line+scatter+reference lines all built-in.     |
| Tests                | **Vitest** (co-located `*.test.ts`)       | Same config as Vite.                                                |
| E2E                  | **Playwright** (one smoke flow)           | Browser-level safety net.                                           |
| Package manager      | **pnpm** (pinned via `packageManager`)    | Deterministic; Vercel auto-detects.                                 |
| Hosting              | **Vercel** (production + per-branch preview) | Free static hosting + serverless function for the proxy.        |
| Serverless           | **Vercel Function (Node 24)** for one proxy endpoint | Unavoidable: USPSA has no public JSON + no permissive CORS. |

**Guardrails:**
- The proxy function (`api/classification.ts`) is the only server code in the repo. All other logic is client-side.
- Tailwind for all styling.
- Zustand for all client state.
- `localStorage` is for UI flags (selected division, theme) and the user-curated recent-lookups list (`{ memberNumber, name, lastLookedUpAt }`). It is not a classification cache — tapping a recent always re-issues the fetch.
- URL state lives in `URLSearchParams`, manipulated via a small custom hook over `history.replaceState`. No routing library.
- TypeScript strict; `unknown` and narrow, never `any`.
- One file per type/component; no barrel `index.ts` re-exports.

## Architecture

USPSA's site does not expose a public JSON API for member classification records and the page itself is blocked by bot protection / has no permissive CORS. A pure client-side fetch from the browser to `uspsa.org/classification/<memberNumber>` will fail.

```
[Browser SPA] ──> [Vercel Function /api/classification]
                       │
                       ├─ validates member number (1–3 letter prefix + digits; e.g. A, TY, FY, L)
                       ├─ fetches via Zyte (browserHtml: true) -> full rendered USPSA page
                       ├─ parses HTML -> typed JSON (node-html-parser)
                       ├─ Zod-validates the parsed shape
                       ├─ caches by member number (CDN headers)
                       └─ returns { shooter, divisions: { [div]: Classifier[] }, warnings: string[] }
```

All math (current %, trendline, class-up insights, what-if) runs client-side in `src/lib/`.

### Project layout

```
.
├── api/
│   └── classification.ts        # Vercel Function: validate -> fetch -> parse -> Zod -> JSON
├── index.html                   # Vite entry
├── package.json
├── pnpm-lock.yaml
├── tsconfig.json
├── tsconfig.node.json
├── vite.config.ts               # Vitest config block lives here
├── tailwind.config.js
├── postcss.config.js
├── vercel.json                  # SPA rewrite to index.html
├── .gitignore
├── .gitattributes               # `* text=auto`
├── README.md
├── CHANGELOG.md
├── CLAUDE.md
├── PLAN.md
├── tests/
│   └── fixtures/uspsa/          # Sanitized USPSA HTML fixtures
└── src/
    ├── main.tsx                 # ReactDOM.createRoot
    ├── App.tsx                  # Top-level layout
    ├── index.css                # @tailwind base/components/utilities
    ├── vite-env.d.ts
    ├── types/
    │   └── index.ts             # All domain types
    ├── lib/                     # Pure functions; no React, no store imports
    │   ├── rules.ts             # Rolling window, classification, flag handling (ported)
    │   ├── rules.test.ts
    │   ├── projection.ts        # scoreNeededForTarget, multi-classifier projection
    │   ├── projection.test.ts
    │   ├── parser.ts            # USPSA HTML -> ShooterRecord (server + tests)
    │   ├── parser.test.ts
    │   ├── textParser.ts        # Pasted TSV -> Classifier[] (ported from uspsaprogress)
    │   ├── textParser.test.ts
    │   ├── formatters.ts        # formatDivision() — camelCase -> spaced display names
    │   ├── urlState.ts          # useUrlState hook over URLSearchParams
    │   └── validation.ts        # Zod schemas
    ├── api/
    │   └── classification.ts    # Client wrapper around /api/classification
    ├── store/
    │   └── useAppStore.ts       # Single Zustand store (lookup state + scenario)
    └── components/
        ├── LookupForm.tsx
        ├── ManualPastePanel.tsx     # Collapsed disclosure; textarea + parse button
        ├── DivisionTabs.tsx
        ├── ClassifierTable.tsx
        ├── SummaryCard.tsx
        ├── ProgressChart.tsx
        ├── ClassUpInsights.tsx
        └── whatif/
            ├── WhatIfPanel.tsx
            └── HypotheticalScoreForm.tsx
```

**Rules of thumb:**
- `lib/` is **pure functions only**. No React imports, no store imports. These are the things tests cover.
- `store/` holds side-effecting state. Components read from it and call its actions; the store does not embed business logic — it calls into `lib/`.
- `components/` is presentation. No rules math in components.

### Data shape (target)

```ts
type Division =
  | "Open" | "Limited" | "Limited10" | "Production" | "Revolver"
  | "SingleStack" | "CarryOptics" | "LimitedOptics" | "PCC";

type ClassLetter = "GM" | "M" | "A" | "B" | "C" | "D" | "U";

type Flag =
  | "S" | "M" | "E" | "F" | "A" | "I" | "X" | "Y" | "P" | "Q" | "N" | "";

interface Classifier {
  date: string;            // ISO yyyy-mm-dd
  classifierCode: string;  // e.g. "99-11"
  classifierName?: string;
  hitFactor?: number;      // missing for major-match entries
  percent: number;         // 0..110
  flag: Flag;
  source: "club" | "majorMatch";
  matchName?: string;
}

interface ShooterRecord {
  memberNumber: string;
  name: string;
  membershipType: "Annual" | "ThreeYear" | "FiveYear" | "Lifetime" | "Unknown";
  currentClasses: Partial<Record<Division, { letter: ClassLetter; percent: number; highPercent: number }>>;
  classifiers: Partial<Record<Division, Classifier[]>>;
  fetchedAt: string;       // ISO timestamp
  source: "fetch" | "paste";
}
```

## USPSA classification rules (reference for math)

Source: <https://uspsa.org/classification/about> (April 2025 system update).

- **Brackets**: GM 95–110%, M 85–94.9%, A 75–84.9%, B 60–74.9%, C 40–59.9%, D 2–40%.
- **Initial classification**: requires ≥4 valid scores from distinct classifier courses; with 4 scores, average all 4; with 5 scores, average all 5; with 6+ scores, **best 6 of the most recent 8** (so at n=6 we use all 6, at n=7 we use best 6 of 7, at n≥8 we use best 6 of recent 8). This deliberately diverges from `uspsaprogress`'s `min(2, n-4)` heuristic; the difference matters for n=6 and n=7. The rule is encoded in `bestSixOfRecentEight()` with unit tests pinning the expected behavior.
- **MRO (Most Recent Override)**: when appending a new score, drop any prior score with the same `classifierCode` before truncating to the most recent 8.
- **Score ceiling**: 110% of HHF.
- **Flags**:
  - `S` (Same-Day Average): multiple attempts same classifier same day are averaged into one. We trust the server-supplied row.
  - `M` (Most Recent Override): different-day reshoots — only the most recent counts. We trust the server.
  - `E`: out of the most-recent-8 window.
  - `F`: dropped (one of the lowest scores).
  - `A`: invalidated as >20% above current class.
  - `I` / `X` / `Q` / `N`: excluded (admin / expired / DQ / DNF).
  - `Y`: included in current calculated average.
  - `P`: pending the next weekly run.
- **Permissive validity** (ported from uspsaprogress): when computing live numbers, we only exclude `I`, `Q`, `N`. `P` and `X` are included so users don't have to wait until Tuesday's stats run, and so paused-membership users can still track. Flags `S`/`M`/`E`/`F`/`A`/`Y` are honored but `E`/`F` simply reflect what our rolling window would compute anyway.
- Retired (April 2025): `B`, `C`, `D`, `G` flags. Historical scores still carry them but our rolling-window math actively excludes them via `EXCLUDED_FLAGS` in `src/lib/rules.ts` — they don't count toward the current calculated average.
- **Major-match promotions**: a Level II/III match overall result can count as a classifier when ≥3 GMs at ≥90% and ≥10 competitors in the division. 5% over current-class ceiling auto-promotes (except GM). 95% at a National = GM. We don't simulate promotions; we just display the major-match rows.

### Class-up math

`requiredAverageForTarget(scores, k, targetOverride?, currentClassOverride?)` in `src/lib/projection.ts` computes the per-classifier average needed across the **next K classifiers** to land in a target class. The function is direction-aware:

- **Up / maintain** — find the minimum X such that the simulated best-6-of-8 average is ≥ the target's lower bound.
- **Down** — find the maximum X such that the simulated average is < the target's upper bound (the next class's lower bound). Used when a higher-classed shooter picks a lower target from the dropdown.
- **At-top** — target is GM and the shooter is officially classified GM; surfaces a "you're already there" state instead of a number.

The rolling window is order-dependent (each new score evicts the oldest after MRO and date-desc sorting, then we take the best 6 of the new 8). The core algorithm:

1. Snapshot the current window with `getCurrentWindow()`.
2. Simulate K appends of a candidate uniform percent X.
3. Recompute `bestSixOfRecentEight()`.
4. Binary-search X ∈ [0, 110] for the boundary value (smallest for up/maintain, largest for down). For up/maintain, if even X=110 isn't enough, surface "not feasible in K classifiers".

`currentClassOverride` accepts USPSA's authoritative class letter (parsed from the Classifications summary table). When supplied, the function uses it to determine direction instead of our computed rolling-window class — important for shooters promoted via major-match where the rolling window never reaches the threshold. `targetOverride` accepts the user's dropdown selection.

### Default target class

The class-up section's "Journey to" dropdown lets the shooter pick any target (GM–D), but it needs a sensible default to land on. Resolution order:

1. **USPSA's official class letter** (from the parsed `currentClasses[division].letter`) when available — this is authoritative and captures every promotion pathway including major-match auto-promotion.
2. **All-time-best class within the selected division** (sticky-class floor, per `uspsaprogress` UX) for paste records or when official data is missing. If a shooter slipped from A to B in Carry Optics, the Carry Optics insight still targets M (the next class above their CO best).
3. **Trending class from the simple mean** for unclassified shooters (<4 scores) — a C-trending shooter sees what they need to reach B rather than always defaulting to D.

Default target = one class above whatever the above resolves to. The floor is per-division; we don't cross divisions here. USPSA's cross-division adjustment rule is already reflected in the `currentClasses` numbers we parse, so no separate handling is needed for fetched records — for paste records we apply `crossDivisionFloorClass()` as a fallback.

### Date handling

Match dates from USPSA are local calendar dates with no timezone. Parse them as TZ-naive `YYYY-MM-DD` strings everywhere in `lib/` and only convert to `Date` at chart-rendering time (Recharts wants a number/Date on the X axis). Never feed `new Date("3/15/2025")` into the rules pipeline — locale parsing can shift a day across TZ boundaries and break the rolling window's ordering.

### Defensive parsing

USPSA's HTML can change. The parser returns `{ ok: true; doc: ShooterRecord; warnings: string[] }` on a partial success — warnings list non-fatal misses (e.g. missing classifier name, unrecognized flag character). The function only returns a hard error when *no* classifier rows parse at all. The UI renders a non-blocking banner when `warnings.length > 0`.

## Commands

```
pnpm install           # install deps
pnpm dev               # vite dev server
pnpm dev:api           # vercel dev for the function (separate terminal)
pnpm build             # production build
pnpm test              # vitest
pnpm test:e2e          # playwright smoke
pnpm lint              # eslint
pnpm format            # prettier --write
pnpm typecheck         # tsc --noEmit
```

Deployment: pushes to `main` → production, pushes to any other branch → preview URL.

## Branch strategy

| Branch    | Environment    | URL                                      |
|-----------|----------------|------------------------------------------|
| `main`    | **Production** | `*.vercel.app` (custom domain TBD)       |
| `develop` | **Preview**    | stable `*-git-develop-*.vercel.app`      |

- Feature work: `feature/<name>`, `fix/<name>`, `claude/<name>` branched off `develop`, PR'd back into `develop`. Each push gets an ephemeral Vercel preview URL — share that URL for review.
- Promote: PR `develop` → `main`. Vercel redeploys production on merge.
- `main` is branch-protected: no direct pushes, required PR review.
- Hotfix: branch off `main`, PR into `main`, then back-port PR into `develop`.

## Coding conventions

- TypeScript strict mode. No `any`; use `unknown` and narrow.
- Function components with explicit prop types. No `React.FC`.
- Tailwind for all styling. The only `.css` file is `src/index.css` with the three Tailwind directives.
- Pure functions in `lib/`, side-effects in `store/`, presentation in `components/`. Don't blur these.
- Default to no comments. Only comment the *why* when non-obvious (a hidden constraint, a workaround, a subtle invariant). Never narrate what well-named code already says.
- One file per type/component. No barrel `index.ts` re-exports.
- No premature abstraction. Three similar lines is fine; refactor on the third real caller, not before.
- No backwards-compat shims, no `_unused` renames, no removed-code comments.
- Tests are co-located: `foo.ts` next to `foo.test.ts`.

## PR conventions

- **Pull requests from `develop` → `main`**: use a `## Summary` header followed by a bulleted list of the substantive changes. Do **not** include a `## Test plan` section or any other procedural scaffolding. The CHANGELOG is the canonical place for user-facing release notes; the main PR body should be a concise description of the diff.
- PRs for feature branches into `develop` can include test plans where useful.

## Repo hygiene

- No secrets in repo. Vercel env vars only.
- Don't commit a scraped USPSA fixture for a real human's record without their consent — synthetic / anonymized fixtures only. The `L5727` example URL the prompt referenced is a public record but its content should still be anonymized in committed fixtures.
- Pin `engines.node` to `24.x` and `packageManager` to a specific `pnpm@x.y.z`. Open ranges break unpredictably on Vercel.

## Reference records (for fixtures and manual testing)

Real USPSA records to validate parser + UI against. Sanitize / anonymize before committing as fixtures (replace member numbers and names; preserve structure, classifier codes, dates, percentages, flags).

- `A154528` — annual member, expected to have a multi-division record.
- `A86278` — annual member.
- `L4898` — lifetime member; verifies the `L` prefix path.
- `L6332` — lifetime member with a long multi-division classification history; good stress test for the table, chart, and rolling-window math.
- `A155617` — **private / restricted record**. Used to validate the parser's "record not viewable" path. The function should return a 404 with `{ error: "record not viewable" }` (or similar) and the UI should render a clear message rather than a parse error.

## Out of scope

- Auth / accounts / saving favorites server-side.
- Comparing two shooters head-to-head.
- Pushing/syncing data to USPSA.
- Mobile native apps.

## Explicitly deferred / not building

These have been considered and consciously skipped for v1. Don't add speculatively.

- **Authenticated lookup of one's own private record.** Out of scope; users with restricted records see the "record not viewable" state.
- **Code coverage thresholds in CI.** Test the right things, not a number.
- **Server-side persistence of any kind** (database, Vercel KV, Upstash). Add only if USPSA rate-limits us.
- **Cross-division class-up insights.** The next-class-to-chase floor is intentionally per-division.

## Risk register

- **USPSA HTML changes**: the parser must be defensive and is locked down by snapshot tests against committed fixtures. Plan for a single `parser.ts` with versioned fixtures and a Zod schema at the boundary.
- **USPSA bot blocking**: the serverless function delegates fetching to Zyte (`browserHtml: true`), which runs its own headless browser. If we see rate-limiting from Zyte's side or USPSA blocks Zyte's IP pool, add Vercel KV / Upstash Redis caching with a TTL.
- **Scraping provider concentration**: Zyte is now the sole upstream fetch path. If Zyte goes down or hard-blocks us, the lookup feature is offline until manual paste — there is no automatic fallback. Re-evaluate adding a secondary provider only if Zyte uptime becomes a real problem.
- **Terms of service**: confirm `uspsa.org` ToS doesn't forbid automated retrieval before any public announcement. Respect any robots.txt directive.
- **Classification rule drift**: the April 2025 changes are recent — `src/lib/rules.ts` is the single point of change; do not duplicate threshold or flag logic in components.

## Things NOT to do

- Don't put rules math in components — it ends up duplicated. Math lives in `src/lib/`.
- Don't mutate Zustand state from components — always call store actions.
- Don't import `lodash`. Use native `Array` / `Math`.
- Don't expand the proxy function beyond fetch + parse + Zod. No business logic on the server.
- Don't commit real members' records as fixtures without anonymizing.
