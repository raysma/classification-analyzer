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
export function bestSixOfRecentEight(scores: ValidatedClassifier[]): {
  included: ValidatedClassifier[]
  dropped: ValidatedClassifier[]
} {
  const n = scores.length
  if (n < 4) return { included: [], dropped: scores }
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
