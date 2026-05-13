# classification-analyzer

A web app that fetches a USPSA shooter's classification record by member number, visualizes their progression over time, and shows what they need to do in upcoming classifiers to class up.

## Goals

1. Look up a shooter's full classifier history from `uspsa.org` given just a member number.
2. Show records in a sortable table, filterable by division.
3. Display the shooter's current classification + percentage for the selected division.
4. Plot scores over time with a trend line.
5. Compute the average percentage required across the next N classifiers (N = 1..5) to reach the next class.
6. Provide a "what-if" simulator: add hypothetical future scores and/or include/exclude current scores to see the resulting class %.

## Tech stack (proposed — confirm during plan review)

- **Language**: TypeScript
- **Framework**: React 18 (with Vite for dev/build)
- **Routing**: React Router (or Next-style file routing if we pick Next.js — see open question below)
- **Styling**: Tailwind CSS
- **Data fetching/cache**: TanStack Query (React Query)
- **Charts**: Recharts (good React/TS story; can swap to Chart.js if richer trendline math is needed)
- **State**: Local component state + Zustand for what-if/scenario state
- **Hosting**: Vercel (production + preview deployments on PR)
- **Serverless proxy**: Vercel Functions (Node runtime) for the USPSA fetch — see Architecture
- **Testing**: Vitest + React Testing Library; Playwright for one or two smoke E2E flows
- **Lint/format**: ESLint + Prettier
- **Package manager**: pnpm (lockfile committed)

Open question for the user: do we want **Vite + React SPA** (simpler, true client app + one Vercel Function), or **Next.js App Router** (server components, built-in API routes, better SEO)? The plan assumes Vite + React SPA unless changed.

## Architecture

USPSA's site does not expose a public JSON API for member classification records and the page itself is blocked by bot protection / has no permissive CORS. A pure client-side fetch from the browser to `uspsa.org/classification/<memberNumber>` will fail.

```
[Browser SPA] ──> [Vercel Function /api/classification]
                       │
                       ├─ validates member number (A|TY|FY|L + digits)
                       ├─ fetches https://uspsa.org/classification/<memberNumber>
                       ├─ parses HTML -> typed JSON (cheerio or linkedom)
                       ├─ caches by member number (in-memory + CDN headers)
                       └─ returns { shooter, divisions: { [div]: Classifier[] } }
```

All math (current %, trendline, class-up insights, what-if) runs client-side from the typed JSON.

### Data shape (target)

```ts
type Division =
  | "Open" | "Limited" | "Limited10" | "Production" | "Revolver"
  | "SingleStack" | "CarryOptics" | "LimitedOptics" | "PCC";

type ClassLetter = "GM" | "M" | "A" | "B" | "C" | "D" | "U";

type Flag = "S" | "M" | "E" | "F" | "A" | "I" | "X" | "Y" | "P" | "Q" | "N" | "";

interface Classifier {
  date: string;          // ISO yyyy-mm-dd
  classifierCode: string;// e.g. "99-11"
  classifierName?: string;
  hitFactor: number;
  percent: number;       // 0..110
  flag: Flag;
  source: "club" | "majorMatch";
  matchName?: string;
}

interface ShooterRecord {
  memberNumber: string;
  name: string;
  membershipType: "Annual" | "ThreeYear" | "FiveYear" | "Lifetime";
  currentClasses: Partial<Record<Division, { letter: ClassLetter; percent: number }>>;
  classifiers: Partial<Record<Division, Classifier[]>>;
  fetchedAt: string;     // ISO timestamp
}
```

## USPSA classification rules (reference for math)

Source: <https://uspsa.org/classification/about> (April 2025 system update).

- **Brackets**: GM 95–110%, M 85–94.9%, A 75–84.9%, B 60–74.9%, C 40–59.9%, D 2–40%.
- **Initial classification**: requires ≥4 valid scores from distinct classifier courses; once ≥4 exist, classification uses the **best 6 of the most recent 8** valid scores (reclassification rule). Special case: if exactly 5 scores exist, all 5 are averaged.
- **Ongoing reclassification**: **best 6 of most recent 8** valid scores; a member moves up if the new average is in a higher bracket. Classification cannot be more than one class below their highest class in any other division.
- **Score ceiling**: 110% of HHF.
- **Flags that matter for math**:
  - `S` (Same-Day Average): multiple attempts same classifier same day are averaged into one.
  - `M` (Most Recent Override): different-day reshoots — only the most recent counts.
  - `E`: out of the most-recent-8 window.
  - `F`: dropped (one of the lowest 2 of the 8 considered) — i.e. these are the scores not in the "best 6".
  - `A`: invalidated as >20% above current class.
  - `I` / `X` / `Q` / `N`: excluded (admin / expired / DQ / DNF).
  - `Y`: included in current calculated average.
  - `P`: pending the next weekly run.
- Retired (April 2025): `B`, `C`, `D`, `G` flags. Historical scores with these flags keep them; new logic doesn't apply them.
- **Major-match promotions**: a Level II/III match overall result can count as a classifier when ≥3 GMs at ≥90% and ≥10 competitors in the division. A 5% over current-class ceiling auto-promotes (except GM). 95% at a National = GM.

### Class-up math (high level)

Given current best-6-of-8 average `A` and the target class threshold `T`, the user wants the average required across the **next K classifiers** to push the new best-6-of-8 average to ≥T.

The simple lower bound is `T·6 − (sum of the 5 best scores after K eviction events)` divided by K — but the window is rolling: each new score evicts the oldest of the 8, and only the top 6 of the new 8 are summed. The simulator should:

1. Project the rolling window forward K steps with the user-supplied % per new score.
2. Recompute best-6-of-8 at each step.
3. Solve (numerically/binary search) for the minimum **uniform** percentage X such that K identical new scores at X% reach the target. Also report optimistic (one big score) and pessimistic (consistent) scenarios.

## Commands (after scaffolding lands)

```
pnpm install           # install deps
pnpm dev               # vite dev server (and `vercel dev` for the API proxy)
pnpm build             # production build
pnpm test              # vitest
pnpm test:e2e          # playwright smoke
pnpm lint              # eslint
pnpm format            # prettier --write
```

Deployment is via Vercel: pushes to `main` → production, all other branches → preview.

## Repo conventions

- Feature branches off `main`, naming: `<topic>/<short-desc>`.
- Commits: short imperative subject ("add division selector"); reference issue when applicable.
- PRs require green CI (build + lint + test).
- No secrets in repo. Vercel env vars only.
- Don't commit a scraped USPSA fixture for a real human's record without their consent — synthetic fixtures only, or anonymize.

## Out of scope (for now)

- Auth / accounts / saving favorites.
- Comparing two shooters head-to-head.
- Pushing/syncing data to USPSA.
- Mobile native apps.

## Risk register

- **USPSA HTML changes**: parser must be defensive and covered by snapshot tests. Plan for a single `parser.ts` with versioned fixtures.
- **USPSA bot blocking**: the serverless function may need a realistic User-Agent and occasional throttling. If they ever rate-limit, add Vercel KV / Upstash Redis caching with a TTL.
- **Terms of service**: confirm `uspsa.org` ToS doesn't forbid automated retrieval before launching publicly. Add a courteous User-Agent identifying the project.
- **Classification rule drift**: the April 2025 changes are recent — keep the rules layer isolated in `src/uspsa/rules.ts` so the math is swappable.
