// scoreNeededForTarget ported and extended from uspsaprogress/progress (ISC)
// https://github.com/uspsaprogress/progress
import type { ClassLetter } from '../types/index'
import type { ValidatedClassifier } from './validation'
import {
  RollingWindow,
  getCurrentWindow,
  bestSixOfRecentEight,
  classFor,
  allTimeBestClass,
  getClassificationHistory,
} from './rules'

// Lower bound percent required to ENTER each class
const CLASS_THRESHOLDS: Record<ClassLetter, number> = {
  GM: 95,
  M: 85,
  A: 75,
  B: 60,
  C: 40,
  D: 2,
  U: 0,
}

// Lowest-to-highest. U is below D for "unclassified" ordering.
const CLASS_ORDER: ClassLetter[] = ['U', 'D', 'C', 'B', 'A', 'M', 'GM']

function classRank(c: ClassLetter): number {
  return CLASS_ORDER.indexOf(c)
}

function classAbove(c: ClassLetter): ClassLetter | null {
  const idx = CLASS_ORDER.indexOf(c)
  if (idx < 0 || idx >= CLASS_ORDER.length - 1) return null
  return CLASS_ORDER[idx + 1] ?? null
}

function simulateAppends(
  window: RollingWindow,
  k: number,
  uniformPercent: number,
): number | null {
  const clone = new RollingWindow()
  for (const s of window.getScores()) {
    clone.append(s)
  }
  for (let i = 0; i < k; i++) {
    const synthetic: ValidatedClassifier = {
      date: '9999-01-01',
      classifierCode: `synthetic-${i}`,
      percent: uniformPercent,
      flag: 'Y',
      source: 'club',
    }
    clone.append(synthetic)
  }
  return clone.classificationScore()
}

export type ProjectionDirection = 'up' | 'down' | 'maintain' | 'at-top'

export interface RequiredAverageResult {
  // For 'up' / 'maintain': minimum average per classifier to reach/keep the target class.
  // For 'down': maximum average per classifier to drop into the target class.
  requiredPercent: number | null
  direction: ProjectionDirection
  feasible: boolean
  targetClass: ClassLetter
  targetThreshold: number
  scoresInWindow: number
  atTop: boolean
}

// The class a shooter is effectively at — their official sticky class if known,
// or a best-guess trending class from the simple mean for unclassified shooters.
function effectiveCurrentClass(scores: ValidatedClassifier[]): ClassLetter {
  const history = getClassificationHistory(scores)
  const best = allTimeBestClass(history)
  if (best !== 'U') return best
  if (scores.length === 0) return 'U'
  const simpleAvg = scores.reduce((acc, s) => acc + s.percent, 0) / scores.length
  return classFor(simpleAvg)
}

export function requiredAverageForTarget(
  scores: ValidatedClassifier[],
  k: number,
  targetOverride?: ClassLetter,
): RequiredAverageResult {
  const current = effectiveCurrentClass(scores)
  const history = getClassificationHistory(scores)
  const officiallyClassifiedGM = allTimeBestClass(history) === 'GM'

  // Resolve target: explicit override wins, otherwise default to "next class up"
  // from the current effective class.
  let target: ClassLetter
  if (targetOverride && targetOverride !== 'U') {
    target = targetOverride
  } else {
    const next = classAbove(current === 'U' ? 'U' : current)
    if (!next) {
      // current is GM with no override — celebrate or stall depending on whether
      // they're actually classified GM
      return {
        requiredPercent: null,
        direction: 'at-top',
        feasible: false,
        targetClass: 'GM',
        targetThreshold: 95,
        scoresInWindow: 0,
        atTop: officiallyClassifiedGM,
      }
    }
    target = next
  }

  // Determine direction
  const currentRank = classRank(current)
  const targetRank = classRank(target)
  let direction: ProjectionDirection
  if (currentRank < targetRank) direction = 'up'
  else if (currentRank > targetRank) direction = 'down'
  else direction = 'maintain'

  // At-top special case: target GM and currently GM (only when actually classified)
  if (target === 'GM' && direction === 'maintain' && officiallyClassifiedGM) {
    return {
      requiredPercent: null,
      direction: 'at-top',
      feasible: false,
      targetClass: 'GM',
      targetThreshold: 95,
      scoresInWindow: 0,
      atTop: true,
    }
  }

  const targetLowerBound = CLASS_THRESHOLDS[target]
  const nextAbove = classAbove(target)
  const targetUpperBound = nextAbove ? CLASS_THRESHOLDS[nextAbove] : 110

  const window = getCurrentWindow(scores)
  const windowScores = window.getScores()
  const { included } = bestSixOfRecentEight(windowScores)

  // Need at least 4 scores total after K appends
  const totalAfterK = windowScores.length + k
  if (totalAfterK < 4) {
    return {
      requiredPercent: null,
      direction,
      feasible: false,
      targetClass: target,
      targetThreshold: direction === 'down' ? targetUpperBound : targetLowerBound,
      scoresInWindow: windowScores.length,
      atTop: false,
    }
  }

  const MIN_SCORE = 0
  const MAX_SCORE = 110

  if (direction === 'up' || direction === 'maintain') {
    // Find the minimum X such that the resulting average is >= targetLowerBound.
    const atMax = simulateAppends(window, k, MAX_SCORE)
    if (atMax === null || atMax < targetLowerBound) {
      return {
        requiredPercent: MAX_SCORE,
        direction,
        feasible: false,
        targetClass: target,
        targetThreshold: targetLowerBound,
        scoresInWindow: included.length,
        atTop: false,
      }
    }

    let lo = 0
    let hi = MAX_SCORE
    for (let iter = 0; iter < 60; iter++) {
      const mid = (lo + hi) / 2
      const pct = simulateAppends(window, k, mid)
      if (pct !== null && pct >= targetLowerBound) {
        hi = mid
      } else {
        lo = mid
      }
      if (hi - lo < 0.01) break
    }

    return {
      requiredPercent: Math.ceil(hi * 100) / 100,
      direction,
      feasible: true,
      targetClass: target,
      targetThreshold: targetLowerBound,
      scoresInWindow: included.length,
      atTop: false,
    }
  }

  // direction === 'down' — find max X such that resulting avg < targetUpperBound
  const atMin = simulateAppends(window, k, MIN_SCORE)
  if (atMin === null || atMin >= targetUpperBound) {
    // Even shooting 0% K times can't drop the avg into target — infeasible
    return {
      requiredPercent: MIN_SCORE,
      direction: 'down',
      feasible: false,
      targetClass: target,
      targetThreshold: targetUpperBound,
      scoresInWindow: included.length,
      atTop: false,
    }
  }

  let lo = MIN_SCORE
  let hi = MAX_SCORE
  for (let iter = 0; iter < 60; iter++) {
    const mid = (lo + hi) / 2
    const pct = simulateAppends(window, k, mid)
    if (pct !== null && pct < targetUpperBound) {
      lo = mid
    } else {
      hi = mid
    }
    if (hi - lo < 0.01) break
  }

  return {
    requiredPercent: Math.floor(lo * 100) / 100,
    direction: 'down',
    feasible: true,
    targetClass: target,
    targetThreshold: targetUpperBound,
    scoresInWindow: included.length,
    atTop: false,
  }
}

// Backwards-compatible alias for callers that haven't migrated yet.
export const requiredAverageToClassUp = requiredAverageForTarget
