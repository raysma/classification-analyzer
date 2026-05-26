# iOS Native Port Plan — classification-analyzer

## Status: 1.0.0 — shipped to TestFlight ✅

All M1–M5 milestones complete. The app is live on TestFlight at `CFBundleShortVersionString: 1.0.0`.

| Milestone | Status | Notes |
|---|---|---|
| M1 — Hello, lookup | ✅ | Scaffold, 4 SPM packages, Lookup view, plain table, stub Summary. |
| M2 — Rules + insights | ✅ | Full Rules + Projection ports, real SummaryCard, ClassUpInsightsView with K=1..5 grid + Journey-to picker, DivisionPicker, custom-scheme deep linking. |
| M3 — Chart + manual paste | ✅ | ProgressChartView (Swift Charts) with dots + spline + reference lines + scrub-line tooltip + fullscreen landscape variant. USPSAPasteParser port + ManualPasteSheet. |
| M4 — What-If + Liquid Glass | ✅ | WhatIfPanel with 8-cap hypotheticals + per-row Y/F badge. Conditional `glassEffect` wrapped behind `if #available(iOS 26)` with Material fallback on iOS 18. Universal links deferred to a future minor — custom scheme handles all v1 deep linking. |
| M5 — Polish + automation | ✅ | App icon (blue/white concentric target on blue), launch screen, Dark Mode, accessibility, error copy, manual TestFlight builds. ASC API key + automated release workflow deferred — not blocking 1.0.0. |
| **Beyond M5** | ✅ | Classifier Calculator tab + Send-to-What-If hand-off, recent lookups list, clearable member-number field, tap-out keyboard dismiss on every tab, USPSA-spec wording polish across all surfaces. |

Two handoff briefs appended below (Recent lookups, Classifier calculator) were implemented as part of M5 / Beyond-M5.

## Context

Today's app is a React/TS/Tailwind/Zustand web app on Vercel that looks up a USPSA shooter's classification record, visualizes their history, and projects what they need to class up. The user has an Apple Developer account and wants the same experience as a native iOS app on **TestFlight**, designed for **iOS 26 Liquid Glass** while still running on iOS 18.

The win: native interactions, real Liquid Glass, deep linking from the web app, and a single codebase for the rules math kept in sync across both platforms.

## Confirmed decisions

- **Backend**: reuse the existing Vercel function at `/api/classification?member=<id>`. Zyte fetch, HTML parsing, and Zod validation stay server-side. iOS only decodes the JSON.
- **Repo layout**: monorepo. iOS code lives in `/ios/` alongside the existing `src/` and `api/`. CI runs both `pnpm test` and `xcodebuild test`. Drift between TS rules and Swift port is mechanically prevented because a single PR can touch both sides plus shared fixtures.
- **Deployment target**: iOS 18.0. Liquid Glass effects (`glassEffect`, `GlassEffectContainer`, etc.) wrapped in `if #available(iOS 26, *)` with Material fallbacks on iOS 18.
- **v1 scope**: lookup by member number, manual paste, what-if simulator. No recents/favorites in v1.
- **Distribution**: TestFlight only for now. App Store submission is a later, optional milestone.
- **Bundle ID**: `com.rmshooting.classificationanalyzer` (reverse-DNS of `rmshooting.com`).
- **App display name**: "Classification Analyzer".
- **Apple Team ID**: deferred — left blank in project config, filled the first time the project is opened in Xcode with the user's developer account selected.

## Architecture

```
[iOS App, SwiftUI]
   │  GET /api/classification?member=A12345
   ▼
[Existing Vercel Function]  ← unchanged
   │
   └─ Zyte → parse → Zod → JSON
```

Pure logic ported to Swift; HTML parsing stays on the server (Node-only deps, fragile to USPSA changes — better to fix once, not in two languages).

## Project scaffolding (`/ios`)

- Xcode project: `ios/ClassificationAnalyzer.xcodeproj`, single app target `ClassificationAnalyzer`.
- Bundle ID: `com.rmshooting.classificationanalyzer`.
- SwiftUI `@main App`. No AppDelegate.
- **Four local Swift packages** under `ios/Packages/` so the math is unit-testable without UIKit/SwiftUI and could even run on Linux CI later:
  - `USPSADomain` — `Division`, `ClassLetter`, `Flag`, `Classifier`, `ShooterRecord`, `ClassInfo`. One file per type.
  - `USPSARules` — port of `src/lib/rules.ts` + `projection.ts` + `formatters.ts`. Depends on `USPSADomain`.
  - `USPSAPasteParser` — port of `src/lib/textParser.ts`.
  - `USPSAClient` — `URLSession` proxy client + `ClassificationError`. Depends on `USPSADomain`.

## TS → Swift module map

| TS file | Swift target |
|---|---|
| `src/types/index.ts` | `Packages/USPSADomain/Sources/USPSADomain/*.swift` |
| `src/lib/rules.ts` | `USPSARules/Rules.swift` |
| `src/lib/projection.ts` | `USPSARules/Projection.swift` |
| `src/lib/textParser.ts` | `USPSAPasteParser/TextParser.swift` |
| `src/lib/formatters.ts` | `USPSARules/DivisionFormatter.swift` |
| `src/api/classification.ts` (client) | `USPSAClient/ClassificationClient.swift` |
| `src/store/useAppStore.ts` | `ios/ClassificationAnalyzer/App/AppModel.swift` (`@Observable`) |
| `src/lib/urlState.ts` | `ios/ClassificationAnalyzer/App/DeepLinkRouter.swift` |
| `LookupForm.tsx` | `Features/Lookup/LookupView.swift` |
| `ManualPastePanel.tsx` | `Features/Lookup/ManualPasteSheet.swift` |
| `DivisionTabs.tsx` | `Features/Divisions/DivisionPicker.swift` |
| `SummaryCard.tsx` | `Features/Summary/SummaryCard.swift` |
| `ProgressChart.tsx` | `Features/Chart/ProgressChartView.swift` |
| `ClassUpInsights.tsx` | `Features/Insights/ClassUpInsightsView.swift` |
| `WhatIfPanel.tsx` + `HypotheticalScoreForm.tsx` | `Features/WhatIf/*.swift` |
| `ClassifierTable.tsx` | `Features/Table/ClassifierTableView.swift` |
| `App.tsx` | `Features/Root/RootView.swift` |

## State, networking, chart, glass

- **State**: Swift 6 `@Observable` `AppModel` injected via `.environment(...)`. Single source of truth — mirrors the one-Zustand-store rule. Only `selectedDivision` persists, via `@AppStorage` (UserDefaults). Local UI flags (sheet open, sort column) stay as `@State` in the view.
- **Networking**: `ClassificationClient` actor, single `func fetch(member:) async throws -> (record, warnings)`. Shared `URLSession` with a 10/50 MB `URLCache`. `JSONDecoder` uses default keys (server is already camelCase) and keeps `date` as `String` — same TZ-naive convention as web. Base URL from `.xcconfig` (Debug → localhost, Release → production Vercel domain). `ClassificationError` enum maps every documented proxy error code (`record_not_viewable`, `rate_limited`, `parse_failed`, etc.) one-to-one. In-flight requests deduped on the actor.
- **Chart**: Swift Charts on iOS 18+. `PointMark` per classifier (foregroundStyle keyed by class color) + `LineMark` for the rolling-average spline (`.interpolationMethod(.monotone)`) + six dashed `RuleMark`s at class thresholds. `.chartYScale(domain: 0...110)`. `.chartXSelection` drives a custom hover card.
- **Liquid Glass (iOS 26 only)**: wrap in a `.glassOrMaterial(...)` helper so call sites stay clean. Glass-adopting surfaces: NavigationStack toolbar (auto when built against iOS 26 SDK), Lookup card, SummaryCard, WhatIfPanel, ClassUpInsights grid cells, the floating Lookup CTA (`.interactive()`), and a `GlassEffectContainer` around the DivisionPicker with `.glassEffectID` so chip selection morphs — the signature Liquid Glass moment. iOS 18 fallback: `.regularMaterial` + hairline `.separator` stroke; deliberate, not regressive.

## Manual paste and what-if

- Paste: `DisclosureGroup` under the lookup field opens a `.sheet` (`.presentationDetents([.medium, .large])`) with a monospaced `TextEditor` + a `PasteButton` (privacy-friendly) + Parse button. Parser produces a synthesized `ShooterRecord(source: .paste, …)` assigned to `appModel.pastedRecord`; downstream pipeline is identical to the fetch path.
- What-if: `hypotheticalScores: [Double]` on `AppModel` (capped at 8). `HypotheticalScoreForm` uses decimal-pad `TextField` with 0–110 validation. SummaryCard's percent uses `.contentTransition(.numericText())` so scenario changes morph the digits.

## Deep linking

- v1: custom scheme `classificationanalyzer://lookup?m=A12345&div=CarryOptics`, registered in `Info.plist`, handled by `.onOpenURL { DeepLinkRouter.handle($0, into: appModel) }`.
- M4: universal links. Serve `apple-app-site-association` from Vercel under `/.well-known/`, add `applinks:<domain>` entitlement. Requires the final TeamID, so deferred.

## Testing

- Mirror the existing Vitest cases one-to-one in XCTest under each package's `Tests/` directory. `rules.test.ts` (375 LOC) and `projection.test.ts` (235 LOC) translate directly. The textParser tests likewise.
- `USPSAClient` tests use a `URLProtocol` stub to return canned JSON for every documented error code plus the happy path.
- One XCUI smoke test: launch with `-UITEST_MOCK 1`, type a member number, assert SummaryCard renders.
- No HTML parser tests on iOS — that stays server-side.

## CI

GitHub Actions, two parallel jobs:

- `web` on `ubuntu-latest`: existing `pnpm install && pnpm typecheck && pnpm test && pnpm build`.
- `ios` on `macos-15` (Xcode 16): `xcodebuild test -project ios/ClassificationAnalyzer.xcodeproj -scheme ClassificationAnalyzer -destination 'platform=iOS Simulator,name=iPhone 16'`.

Path filters keep macOS runner minutes lean: `ios` job only runs when `ios/**` or shared rule fixtures change.

## TestFlight pipeline

1. App Store Connect → create app record (name, bundle ID, SKU).
2. Xcode → Signing & Capabilities → Automatically manage signing → select team.
3. First build: Archive in Xcode, upload via Organizer → wait for processing → invite internal testers (user's Apple ID first).
4. Automation (deferred to M5): App Store Connect API key, GH Actions workflow using `xcodebuild archive` + `xcrun altool --upload-app` (or `fastlane pilot`), keys stored as GH secrets.

## Phasing — each milestone is a discrete TestFlight build

- **M1 — Hello, lookup**: scaffold project + 4 SPM packages, `USPSADomain` complete, `USPSAClient` happy-path + error mapping, `LookupView` + plain `ClassifierTableView` + stub SummaryCard (class letter only). iOS 18 styling only. **First TestFlight upload.**
- **M2 — Rules + insights**: full `Rules` + `Projection` ports with all unit tests green. Real SummaryCard (percent to 4 dp, gap, projected, all-time high). `ClassUpInsightsView` with K=1..5 grid + journey-to picker. DivisionPicker. Custom-scheme deep linking. **First useful build.**
- **M3 — Chart + manual paste**: `ProgressChartView` (Swift Charts) with dots + spline + 6 reference lines + hover card. `USPSAPasteParser` port + `ManualPasteSheet`. Warning banner.
- **M4 — What-If + Liquid Glass**: `WhatIfPanel`, hypotheticals, animated transitions. Conditional `glassEffect` on lookup card, summary, division chips (morphing), insights grid. iOS 18 Material fallback finalized. Universal links live.
- **M5 — Polish + automation**: app icon set, launch screen, Dark Mode pass, accessibility (VoiceOver labels on chart marks, Dynamic Type), error-copy review, ASC API key + GH Actions release workflow. Public TestFlight link.
- **M6 (optional) — App Store**: privacy labels, screenshots, marketing copy, ToS check, submit for review.

## Verification

- Rules/projection parity: `swift test --package-path ios/Packages/USPSARules` must pass every translated Vitest case. CI runs this on every PR.
- End-to-end fetch: in Simulator, look up the same member numbers used as web fixtures (`A154528`, `A86278`, `L4898`, plus the `A155617` private-record path) and confirm SummaryCard / table / chart match the web app for each division.
- Manual paste parity: paste the same TSV blob into web and iOS, diff the resulting class % to ≤ 0.0001.
- Liquid Glass visual check: run M4 build on an iOS 26 simulator, confirm DivisionPicker chip morph, then run on iOS 18 simulator and confirm Material fallback is deliberate (no broken layout, no missing affordances).
- TestFlight smoke: install the M1 build on a real device via TestFlight, look up `L4898`, confirm SummaryCard renders.

## Open questions / risks

- **App name + icon**: "Classification Analyzer" is safe; "USPSA Analyzer" risks trademark friction. Icon not yet designed — blocker for M5 only.
- **App Store review**: low risk (no IAP, no auth, no UGC). Frame the app as "view your own record." Avoid USPSA logo in icon and any implied affiliation in copy.
- **Privacy nutrition labels**: member number is "Other User Content", linked to user = No, used for tracking = No. No analytics in v1, no ATT.
- **iOS 26 SDK availability**: Liquid Glass APIs need an Xcode with the iOS 26 SDK. If not yet available on the user's Xcode at M4, ship M4 functionally on Material and add glass behind `@available` later.
- **Zyte cost**: iOS will roughly double traffic on the existing proxy. The risk-register item for Vercel KV / Upstash caching on the server moves up in priority; pure server-side work, no iOS impact.

## Critical files to reference during the port

- `/home/user/classification-analyzer/src/types/index.ts`
- `/home/user/classification-analyzer/src/lib/rules.ts` (+ `rules.test.ts`)
- `/home/user/classification-analyzer/src/lib/projection.ts` (+ `projection.test.ts`)
- `/home/user/classification-analyzer/src/lib/textParser.ts` (+ `textParser.test.ts`)
- `/home/user/classification-analyzer/src/lib/formatters.ts`
- `/home/user/classification-analyzer/src/store/useAppStore.ts`
- `/home/user/classification-analyzer/src/api/classification.ts`
- `/home/user/classification-analyzer/api/classification.ts` (error code contract)

---

# Recent member-number lookups (handoff brief)

## Context

The web app (shipped on `main`) persists the user's recent successful lookups so they don't have to re-type member numbers. We want the same behavior on iOS. This is **not a cache** — entries are just `{ memberNumber, name, lastLookedUpAt }` metadata; tapping a recent always re-issues the network fetch, so any classification record change shows up on the next view. The iOS app already has in-flight request memoization in `ClassificationClient`, which is untouched.

## Rules (mirrored from the web implementation)

- Added/updated only on a **successful network fetch**. Paste records are excluded.
- Dedup by canonical (uppercased) `memberNumber`. Re-lookup updates `name` and `lastLookedUpAt`, moves entry to the top.
- Sort newest first. **Cap at 10**; oldest evicted on overflow.
- User can delete any entry; deletion does not prevent re-adding by performing a new lookup.
- Persisted via `UserDefaults` (matches the existing `selectedDivision` pattern in `AppModel`). No cross-device sync.

## Files to add / modify

### 1. New type: `ios/ClassificationAnalyzer/App/RecentLookup.swift`

```swift
public struct RecentLookup: Codable, Sendable, Hashable, Identifiable {
    public let memberNumber: String
    public let name: String
    public let lastLookedUpAt: Date
    public var id: String { memberNumber }
}
```

### 2. `ios/ClassificationAnalyzer/App/AppModel.swift`

Already an `@Observable @MainActor` class. Add:

- `var recentLookups: [RecentLookup] = []` property
- `static let recentLookupsCap = 10`
- On `init()`: decode from `UserDefaults.standard` key `"recentLookups"` via `JSONDecoder` (fall back to `[]` on missing/corrupt). Mirrors the existing `selectedDivision` pattern around lines 24–27.
- `didSet` on the property (or explicit save call) that encodes via `JSONEncoder` back to `UserDefaults`.
- `func addRecent(from record: ShooterRecord)` — uppercases `memberNumber`, removes any existing match, prepends a new `RecentLookup(memberNumber:, name:, lastLookedUpAt: .now)`, truncates to `recentLookupsCap`. Skip when the record originated from paste (`record.source != .fetch`).
- `func removeRecent(memberNumber: String)` — filters by uppercased key.

Call `addRecent(from:)` from the existing `lookup()` action immediately after the successful fetch is assigned to `fetchedRecord`.

### 3. `ios/ClassificationAnalyzer/Features/Root/LookupTab.swift`

The file already has a marker around line 44: `// Recents list lands here...`. Render a section there gated on `!appModel.recentLookups.isEmpty`:

- A `List` / `ForEach(appModel.recentLookups)` of tappable rows.
- Each row displays **member number as primary text** (monospaced), **shooter name as secondary** (smaller, muted), and a `.relative`-formatted `lastLookedUpAt`:
  ```swift
  Text(entry.lastLookedUpAt, format: .relative(presentation: .named))
  ```
- Tap → set `appModel.memberNumber = entry.memberNumber` and call `Task { await appModel.lookup() }`. Same path as the form submit, so the existing auto-switch-to-Overview behavior carries over.
- `.swipeActions(edge: .trailing)` with a destructive Delete button calling `appModel.removeRecent(memberNumber:)`. Consider also a trailing trash button for discoverability.

Routing through `DeepLinkRouter.handle()` is **not** necessary — direct state mutation is simpler than constructing a synthetic URL.

## Tests

Add `ios/ClassificationAnalyzerTests/AppModelRecentLookupsTests.swift` (or whatever the existing app-target test location is). Cover:

- `addRecent` prepends to front and uppercases the key
- Duplicate member number (case-insensitive) dedupes + moves to top + refreshes `name` + `lastLookedUpAt`
- Cap-at-10 eviction of the oldest entry
- `removeRecent` is case-insensitive and a no-op when absent
- Paste-source records are skipped
- Persistence round-trip: write entries, reconstruct an `AppModel`, confirm `recentLookups` is restored from `UserDefaults`

## Verification

1. `xcodebuild test` — `AppModelRecentLookupsTests` green.
2. Run in simulator: look up a member; force-quit and relaunch — confirm the row persists in the Lookup tab.
3. Swipe to delete; relaunch; confirm it stays deleted.
4. Tap a recent row and confirm Overview tab auto-switches (mirroring the form-submit flow).
5. Look up a paste record — confirm it does **not** appear in the list.

## Reference: web implementation already shipped

Web equivalents on `main` for cross-reference:

- Type: `src/types/index.ts` — `RecentLookup` interface
- Store: `src/store/useAppStore.ts` — `addRecentLookup` / `removeRecentLookup` / `RECENT_LOOKUPS_CAP = 10`, persisted via Zustand's `persist` middleware
- Component: `src/components/RecentLookups.tsx`
- Wiring: `src/App.tsx` — `useEffect` watching `data?.record` with `source === 'fetch'` guard
- Tests: `src/store/useAppStore.test.ts`

---

# Classifier calculator (handoff brief)

## Context

The web app shipped a new *Calculator* tab on `main` that turns a freshly-shot classifier hit factor into the USPSA percentage and class letter, and optionally pipes the result into the What-If scenario as a hypothetical row carrying the **real** classifier code and today's date — so MRO fires the way it would in real life when a shooter reshoots a classifier. iOS gets the same feature. All math is pure; no network involved.

## Rules (mirrored from the web implementation)

- **Tab order**: Overview · What-If · Scores · Calculator (Calculator is last).
- Calculator works **without a loaded record**. *Send to What-If* is the only action that requires one.
- Result is computed only when the user taps **Calculate** — not live as they type. Any edit to division / classifier / hit factor clears the prior result so stale numbers aren't shown.
- Math:
  ```
  pct    = min(110, hitFactor / hhf * 100)
  letter = bracket(pct)   // reuse classFor from Rules.swift — do not duplicate
  ```
  The 110% cap is real and load-bearing; USPSA caps individual classifier results at 110% for both per-stage rating and the rolling average.
- Reject non-finite / ≤ 0 HF and "no HHF on file" with no result (no error banner — just nothing renders).
- On *Send to What-If*: if the calculator's division differs from `selectedDivision`, switching divisions resets the existing scenario (existing What-If behavior). Warn the user inline before the tap. Then add a hypothetical carrying `(percent, today's local YYYY-MM-DD, real classifier code)` and navigate to the What-If tab.
- The "active" classifier list is **whatever appears in the HHF table** — not every code in `uspsa-classifiers.json` is active. `classifiers.json` has 117 historical codes; only the 63 with a published HHF are in the dropdown. Sort ascending by code.

## Data files to add

Bundle three JSON files copied verbatim from `src/data/` in the web repo. Refresh by replacing the files in place; no schema munging needed.

- `ios/Packages/USPSARules/Sources/USPSARules/Resources/uspsa-hhfs.json` (~12 KB)
- `ios/Packages/USPSARules/Sources/USPSARules/Resources/uspsa-classifiers.json` (~62 KB)
- `ios/Packages/USPSARules/Sources/USPSARules/Resources/uspsa-divisions.json` (~1 KB)

Add `resources: [.process("Resources")]` to the `USPSARules` package target. Load once via `Bundle.module` at first use. Provenance + refresh instructions live at the top of `HHFTable.swift` (below).

Division ↔ shortcode mapping (matches web `DIVISION_TO_SHORTCODE` in `src/lib/hhf.ts`):

| Division | HHF shortcode |
|---|---|
| `.open` | `opn` |
| `.limited` | `ltd` |
| `.limited10` | `l10` |
| `.production` | `prod` |
| `.revolver` | `rev` |
| `.singleStack` | `ss` |
| `.carryOptics` | `co` |
| `.limitedOptics` | `lo` |
| `.pcc` | `pcc` |

## Files to add / modify

### 1. `USPSARules/HHFTable.swift` (new)

```swift
public struct ActiveClassifier: Sendable, Hashable, Identifiable {
    public let code: String   // "22-07"
    public let name: String   // "Cross Road Blues"
    public var id: String { code }
}

public enum HHFTable {
    public static func hhf(code: String, division: Division) -> Double?
    public static func activeClassifiers() -> [ActiveClassifier]  // sorted by code asc
}
```

Index built on first call: trim the code, key `[String: [Division: Double]]`. Never throws. Returns `nil` on any miss (unknown code, division with no HHF for that code, malformed input).

### 2. `USPSARules/Calculator.swift` (new)

```swift
public struct ClassificationResult: Sendable, Equatable {
    public let pct: Double         // capped at 110
    public let letter: ClassLetter
    public let hhf: Double
}

public enum Calculator {
    public static let pctCap = 110.0
    public static func classify(hitFactor: Double, code: String, division: Division) -> ClassificationResult?
}
```

Reuse `classFor(percent:)` from the existing `Rules.swift` for the letter — do not duplicate the bracket table.

### 3. `ios/ClassificationAnalyzer/App/HypotheticalScore.swift` (modify)

Today's `HypotheticalScore` is `{ id, percent }`. Extend with two optionals so the model can distinguish calculator-sent rows from form-added ones:

```swift
public struct HypotheticalScore: Codable, Sendable, Identifiable, Hashable {
    public let id: UUID
    public let percent: Double
    public var date: String?           // YYYY-MM-DD, only set when sent from Calculator
    public var classifierCode: String? // real code, only set when sent from Calculator
}
```

When building the scenario `[Classifier]` to feed into the rolling-window pipeline (the iOS equivalent of `buildScenarioScores` in `src/store/useAppStore.ts`), use the real `date`/`classifierCode` if present, otherwise fall back to the synthetic sentinel (`"9999-MM-01"` / `"hypo-<id>"`) the form already uses.

### 4. `ios/ClassificationAnalyzer/App/AppModel.swift` (modify)

- Extend `addHypothetical(...)` to accept optional `date` and `classifierCode`. Keep the 8-cap unchanged.
- `removeHypothetical(id:)` is unchanged.
- Add `.calculator` to the tab enum, at the END of the order. Update `DeepLinkRouter` so `?tab=calculator` resolves.

### 5. `ios/ClassificationAnalyzer/Features/Calculator/CalculatorView.swift` (new)

Header: title + one-line subtitle ("Enter a classifier hit factor to see the percentage and class letter, then optionally send it to What-If as a hypothetical score.").

Form (three controls, equal width, stack on narrow widths):
- **Division** `Picker` over `Division.allCases`, default `appModel.selectedDivision ?? .carryOptics`.
- **Classifier** `Picker` over `HHFTable.activeClassifiers()`, label `"\(code) — \(name)"`.
- **Hit factor** `TextField` with `.keyboardType(.decimalPad)`. Do **not** enforce 4-decimal precision on input — accept whatever the user types.

Buttons in one row:
- **Calculate** — primary tint (same as `LookupView`'s submit). Tap (or keyboard Done) calls `calculate()`, which validates, runs `Calculator.classify(...)`, and stores `(result, division, code)` in local `@State`. Each input change clears that stored result.
- **Send to What-If** — secondary tint matching the existing WhatIfPanel "Add hypothetical" button (so the cross-page color tie is preserved: indigo = What-If hypothetical action). Disabled with inline reason text when (a) no result, (b) no record, or (c) scenario at the 8-cap.

Result chip (below buttons, only renders when a result exists):
- Class-letter pill using the **same palette as SummaryCard's letter chip**: yellow GM, purple M, blue A, green B, orange C, red D, gray U. Do not invent new colors.
- `String(format: "%.4f%%", pct)` (4 decimals everywhere, matching the rest of the app).
- Small subtitle: `HHF X.XXXX · <Division name>`.

Side-warning (amber text) when *Send to What-If* would switch the division and therefore clear the scenario.

Today's date for the hand-off:
```swift
let today = Date.now.formatted(.iso8601.year().month().day())  // local calendar
```
Matches the web's `todayLocalISO()` — TZ-naive, not UTC.

### 6. `Features/WhatIf/WhatIfPanel.swift` (modify)

A scenario hypothetical row currently displays as `"Hypothetical · <pct>%"`. When the hypothetical carries both `date` and `classifierCode` (set only by Calculator), render it like a real score instead: `"<date> · <code> · <pct>%"` — same indigo color and × delete button as today. Detection: `hypothetical.date != nil && hypothetical.classifierCode != nil`.

### 7. `Features/Root/RootView.swift` (modify)

Add the `.calculator` tab at index 4 (after Scores). Its TabView item renders `CalculatorView` with **no** record-required gate (unlike the other three tabs).

## Tests

### `USPSARules/Tests/HHFTableTests.swift`

- `hhf("22-07", .carryOptics) == 9.0749`
- `hhf("03-03", .carryOptics) == 8.2443`
- `hhf("25-01", .pcc) == 8.9521`
- Limited 10 lookups succeed for both legacy (`22-07`) and 25-series codes
- Whitespace tolerance on the code (`" 22-07 "` resolves)
- Unknown code / missing inputs → nil
- `activeClassifiers().count == 63` and the array is sorted ascending by code

### `USPSARules/Tests/CalculatorTests.swift`

- `classify(9.0749, "22-07", .carryOptics)` → `{ pct: 100, letter: .gm, hhf: 9.0749 }`
- `classify(12.0, "22-07", .carryOptics)` → `pct: 110, letter: .gm` (raw 132%, hits cap)
- `classify(0.1, "22-07", .open)` → letter `.u`
- `classify(1.0, "22-07", .open)` → letter `.d`
- Boundary sweep: for each of GM/M/A/B/C/D, assert just-above and just-below the threshold land on the correct side
- Null / zero / negative / NaN HF → nil
- Unknown code → nil

### `AppModelCalculatorHandoffTests.swift`

- Sending a calculator hypothetical into an 8-score scenario evicts the oldest score and the rolling window stays size 8
- MRO: sending a hypothetical with code matching one in the window evicts that prior score, the oldest unrelated score stays
- Legacy `.percent`-only hypothetical still uses the 9999 sentinel and grows a sub-8 window unchanged

## Verification

1. `swift test --package-path ios/Packages/USPSARules` — all calculator tests green.
2. Simulator: navigate to Calculator with no record loaded, enter `22-07` / Carry Optics / `9.0749` → confirm `100.0000% · GM` with the yellow GM chip color matching SummaryCard.
3. Look up a real record (e.g. `L4898`), select PCC. Open Calculator, change division to Carry Optics, enter a HF, tap Send → confirm app switches to Carry Optics, lands on What-If, the new hypothetical row renders with real date + code + indigo styling, and the projected % **and** the scores list both recompute (Y/F flags + eviction visible).
4. Confirm the Calculator tab is reachable without a record and that *Send to What-If* is disabled with an inline hint in that state.
5. Layout/height check on the smallest target device: the two Pickers and the TextField are visually the same height. Native SwiftUI pickers and text fields can render at different intrinsic heights; an explicit `.frame(height:)` may be needed to match.

## Reference: web implementation already shipped

Web equivalents on `main` for cross-reference:

- Data: `src/data/uspsa-hhfs.json`, `src/data/uspsa-classifiers.json`, `src/data/uspsa-divisions.json`
- Loader: `src/lib/hhf.ts` (+ `hhf.test.ts`)
- Math: `src/lib/calculator.ts` (+ `calculator.test.ts`) — reuses `classFor` from `src/lib/rules.ts`
- UI: `src/components/calculator/CalculatorPanel.tsx`, `src/components/calculator/LetterPill.tsx`
- Store extension: `src/store/useAppStore.ts` (`HypotheticalScore` + `buildScenarioScores` changes)
- What-If row rendering: `src/components/whatif/WhatIfPanel.tsx`
- Pipeline tests: `src/components/whatif/WhatIfPanel.test.ts`
