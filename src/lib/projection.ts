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
const CLASS_THRESHOLDS: Record<ClassLetter, number | null> = {
  GM: 95,
  M: 85,
  A: 75,
  B: 60,
  C: 40,
  D: 2,
  U: null,
}

function nextTargetClass(currentBest: ClassLetter): ClassLetter | null {
  const order: ClassLetter[] = ['GM', 'M', 'A', 'B', 'C', 'D', 'U']
  const idx = order.indexOf(currentBest)
  if (idx <= 0) return null // GM has no next
  return order[idx - 1] ?? null
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

export interface RequiredAverageResult {
  minAvgPercent: number | null
  feasible: boolean
  targetClass: ClassLetter
  targetThreshold: number
  scoresInWindow: number
}

export function requiredAverageToClassUp(
  scores: ValidatedClassifier[],
  k: number,
): RequiredAverageResult {
  const history = getClassificationHistory(scores)
  const best = allTimeBestClass(history)
  const target = nextTargetClass(best === 'U' ? classFor(0) : best)

  // If current is GM, no target
  if (!target) {
    return {
      minAvgPercent: null,
      feasible: false,
      targetClass: 'GM',
      targetThreshold: 95,
      scoresInWindow: 0,
    }
  }

  const threshold = CLASS_THRESHOLDS[target]
  if (threshold === null) {
    return {
      minAvgPercent: null,
      feasible: false,
      targetClass: target,
      targetThreshold: 95,
      scoresInWindow: 0,
    }
  }

  const window = getCurrentWindow(scores)
  const windowScores = window.getScores()
  const { included } = bestSixOfRecentEight(windowScores)

  // Need at least 4 scores total after K appends
  const totalAfterK = windowScores.length + k
  if (totalAfterK < 4) {
    return {
      minAvgPercent: null,
      feasible: false,
      targetClass: target,
      targetThreshold: threshold,
      scoresInWindow: windowScores.length,
    }
  }

  // Current score — if already at target, no need to project
  const currentPct = window.classificationScore()
  if (currentPct !== null && currentPct >= threshold) {
    return {
      minAvgPercent: currentPct,
      feasible: true,
      targetClass: target,
      targetThreshold: threshold,
      scoresInWindow: included.length,
    }
  }

  // Binary search for minimum uniform score needed
  const MAX_SCORE = 110
  const result = simulateAppends(window, k, MAX_SCORE)
  if (result === null || result < threshold) {
    return {
      minAvgPercent: MAX_SCORE,
      feasible: false,
      targetClass: target,
      targetThreshold: threshold,
      scoresInWindow: included.length,
    }
  }

  let lo = 0
  let hi = MAX_SCORE
  for (let iter = 0; iter < 60; iter++) {
    const mid = (lo + hi) / 2
    const pct = simulateAppends(window, k, mid)
    if (pct !== null && pct >= threshold) {
      hi = mid
    } else {
      lo = mid
    }
    if (hi - lo < 0.01) break
  }

  const minAvg = Math.ceil(hi * 100) / 100

  return {
    minAvgPercent: minAvg,
    feasible: minAvg <= MAX_SCORE,
    targetClass: target,
    targetThreshold: threshold,
    scoresInWindow: included.length,
  }
}
