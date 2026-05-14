// Rolling window classification math ported from uspsaprogress/progress (ISC)
// https://github.com/uspsaprogress/progress
// Lodash removed; native Array/Math equivalents used throughout.
import type { ClassLetter, Flag } from '../types/index'
import type { ValidatedClassifier } from './validation'
import type { ClassificationSnapshot } from '../types/index'

// Flags excluded from the rolling window computation.
// I/Q/N: admin / DQ / DNF (always excluded).
// B/C/D/G: retired April 2025; historical scores still carry them but they are
// not part of any current calculation.
const EXCLUDED_FLAGS: Set<Flag> = new Set(['I', 'Q', 'N', 'B', 'C', 'D', 'G'])

export function isInvalidFlag(flag: Flag): boolean {
  return EXCLUDED_FLAGS.has(flag)
}

// Class thresholds (inclusive lower bound)
const CLASS_THRESHOLDS: Array<{ min: number; letter: ClassLetter }> = [
  { min: 95, letter: 'GM' },
  { min: 85, letter: 'M' },
  { min: 75, letter: 'A' },
  { min: 60, letter: 'B' },
  { min: 40, letter: 'C' },
  { min: 2, letter: 'D' },
]

export function classFor(percent: number): ClassLetter {
  for (const { min, letter } of CLASS_THRESHOLDS) {
    if (percent >= min) return letter
  }
  return 'U'
}

export function nextClassThreshold(current: ClassLetter): number | null {
  const idx = CLASS_THRESHOLDS.findIndex((t) => t.letter === current)
  if (idx <= 0) return null // GM has no next
  return CLASS_THRESHOLDS[idx - 1]?.min ?? null
}

export function sortClassifiers(scores: ValidatedClassifier[]): ValidatedClassifier[] {
  return [...scores].sort((a, b) => {
    const dateCmp = a.date.localeCompare(b.date)
    if (dateCmp !== 0) return dateCmp
    return a.percent - b.percent
  })
}

// Per USPSA rules (April 2025):
// n=4 → mean of all 4; n=5 → mean of all 5; n=6 → mean of 6;
// n=7 → best 6 of 7; n≥8 → best 6 of recent 8
// n<4 → no classification yet, but the scores are still "in" the rolling
// window (not dropped). They're just pending an initial classification.
export function bestSixOfRecentEight(scores: ValidatedClassifier[]): {
  included: ValidatedClassifier[]
  dropped: ValidatedClassifier[]
} {
  const n = scores.length
  if (n === 0) return { included: [], dropped: [] }
  if (n <= 6) return { included: scores, dropped: [] }

  // n=7: best 6 of all 7
  // n≥8: best 6 of the most recent 8
  const pool = n >= 8 ? scores.slice(n - 8) : scores

  const sorted = [...pool].sort((a, b) => b.percent - a.percent)
  const included = sorted.slice(0, 6)
  const includedSet = new Set(included)
  const dropped = pool.filter((s) => !includedSet.has(s))

  return { included, dropped }
}

export class RollingWindow {
  private scores: ValidatedClassifier[] = []

  append(c: ValidatedClassifier) {
    if (isInvalidFlag(c.flag)) return
    // MRO: remove prior score with the same classifierCode
    this.scores = this.scores.filter((s) => s.classifierCode !== c.classifierCode)
    this.scores.push(c)
    // Keep most recent 8
    if (this.scores.length > 8) {
      this.scores = this.scores.slice(this.scores.length - 8)
    }
  }

  getScores(): ValidatedClassifier[] {
    return this.scores
  }

  classificationScore(): number | null {
    const { included } = bestSixOfRecentEight(this.scores)
    if (included.length < 4) return null
    const sum = included.reduce((acc, s) => acc + s.percent, 0)
    return sum / included.length
  }
}

export function getCurrentWindow(scores: ValidatedClassifier[]): RollingWindow {
  const sorted = sortClassifiers(scores)
  const window = new RollingWindow()
  for (const s of sorted) {
    window.append(s)
  }
  return window
}

export function getClassificationHistory(scores: ValidatedClassifier[]): ClassificationSnapshot[] {
  const sorted = sortClassifiers(scores)
  const window = new RollingWindow()
  const history: ClassificationSnapshot[] = []

  for (const s of sorted) {
    window.append(s)
    const pct = window.classificationScore()
    if (pct !== null) {
      history.push({
        date: s.date,
        percent: Math.round(pct * 100) / 100,
        classLetter: classFor(pct),
      })
    }
  }

  return history
}

export function allTimeBestClass(history: ClassificationSnapshot[]): ClassLetter {
  if (history.length === 0) return 'U'
  const order: ClassLetter[] = ['GM', 'M', 'A', 'B', 'C', 'D', 'U']
  let best: ClassLetter = 'U'
  for (const snap of history) {
    if (order.indexOf(snap.classLetter) < order.indexOf(best)) {
      best = snap.classLetter
    }
  }
  return best
}

// Per USPSA sticky-class rule: once you achieve a class, you don't drop in
// that division even if the rolling-window percent slips. The displayed
// letter should reflect the all-time high % achieved, not the current %.
export function stickyClassFor(
  currentPercent: number | null,
  allTimeHighPercent: number | null | undefined,
): ClassLetter {
  const high = Math.max(currentPercent ?? 0, allTimeHighPercent ?? 0)
  if (high <= 0) return 'U'
  return classFor(high)
}

// Rank order used for class comparisons. Higher index = better class.
const CLASS_RANK: ClassLetter[] = ['U', 'D', 'C', 'B', 'A', 'M', 'GM']

export function rankOf(letter: ClassLetter): number {
  return CLASS_RANK.indexOf(letter)
}

export function maxClass(a: ClassLetter, b: ClassLetter): ClassLetter {
  return rankOf(a) >= rankOf(b) ? a : b
}

// USPSA cross-division rule: a classified division (≥4 in-window scores) can be
// no more than one letter below the highest classified division. Returns the
// floor for `scopedDivision` based on every OTHER division's all-time best.
// Returns null when no other division qualifies (so no floor applies).
export function crossDivisionFloorClass(
  classifiersByDivision: Partial<Record<string, ValidatedClassifier[]>>,
  scopedDivision: string,
): ClassLetter | null {
  let highestRank = -1

  for (const div of Object.keys(classifiersByDivision)) {
    if (div === scopedDivision) continue
    const scores = classifiersByDivision[div] ?? []
    if (scores.length < 4) continue

    const window = getCurrentWindow(scores)
    if (window.getScores().length < 4) continue

    const history = getClassificationHistory(scores)
    if (history.length === 0) continue

    const high = Math.max(...history.map((h) => h.percent))
    const rank = rankOf(classFor(high))
    if (rank > highestRank) highestRank = rank
  }

  if (highestRank < 1) return null
  return CLASS_RANK[highestRank - 1] ?? null
}
