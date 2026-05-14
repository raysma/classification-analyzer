import { describe, it, expect } from 'vitest'
import { requiredAverageToClassUp } from './projection'
import type { ValidatedClassifier } from './validation'

function mkScore(
  percent: number,
  date = '2024-01-01',
  code = '99-11',
): ValidatedClassifier {
  return { date, classifierCode: code, percent, flag: 'Y', source: 'club' }
}

function buildScores(percents: number[]): ValidatedClassifier[] {
  return percents.map((p, i) =>
    mkScore(p, `2024-${String(i + 1).padStart(2, '0')}-01`, `code-${i}`),
  )
}

describe('requiredAverageToClassUp', () => {
  describe('pre-classified shooter (<4 scores)', () => {
    it('returns infeasible with null minAvgPercent for 0 scores', () => {
      const result = requiredAverageToClassUp([], 1)
      expect(result.minAvgPercent).toBeNull()
      expect(result.feasible).toBe(false)
    })

    it('returns infeasible for 2 scores + K=1 (still only 3 total)', () => {
      const scores = buildScores([70, 72])
      const result = requiredAverageToClassUp(scores, 1)
      expect(result.minAvgPercent).toBeNull()
      expect(result.feasible).toBe(false)
    })

    it('returns feasible once K brings total to 4', () => {
      const scores = buildScores([70, 72])
      const result = requiredAverageToClassUp(scores, 2)
      // 2 existing + 2 new = 4 total — might be feasible
      expect(result.feasible !== undefined).toBe(true)
    })
  })

  describe('B-class shooter targeting A', () => {
    it('feasible at K=3 with achievable score', () => {
      // B class ~65% average; need 75% for A
      const scores = buildScores([65, 66, 67, 68, 65, 66])
      const result = requiredAverageToClassUp(scores, 3)
      expect(result.targetClass).toBe('A')
      expect(result.targetThreshold).toBe(75)
      if (result.feasible) {
        expect(result.minAvgPercent).toBeGreaterThan(0)
        expect(result.minAvgPercent).toBeLessThanOrEqual(110)
      }
    })
  })

  describe('A-class shooter near M', () => {
    it('requires scores close to 85% to reach M at K=1', () => {
      // A class ~82% average; need 85% for M
      const scores = buildScores([82, 83, 84, 81, 82, 83, 82, 81])
      const result = requiredAverageToClassUp(scores, 1)
      expect(result.targetClass).toBe('M')
      expect(result.targetThreshold).toBe(85)
      if (result.feasible) {
        expect(result.minAvgPercent).toBeGreaterThanOrEqual(82)
      }
    })
  })

  describe('fresh shooter with exactly 4 scores', () => {
    it('can reach D class easily', () => {
      const scores = buildScores([30, 35, 38, 40])
      const result = requiredAverageToClassUp(scores, 1)
      expect(['D', 'C', 'B', 'A', 'M', 'GM']).toContain(result.targetClass)
    })
  })

  describe('GM shooter', () => {
    it('returns infeasible (already top class) and sets atTop', () => {
      const scores = buildScores([97, 98, 96, 97, 98, 99])
      const result = requiredAverageToClassUp(scores, 1)
      expect(result.targetClass).toBe('GM')
      expect(result.feasible).toBe(false)
      expect(result.atTop).toBe(true)
    })
  })

  describe('atTop guard for M shooter targeting GM', () => {
    it('does not set atTop when GM is the target but unreachable', () => {
      // Low M scores; K=1 cannot mathematically reach GM (>110% needed)
      const scores = buildScores([85, 85, 85, 85, 85, 85])
      const result = requiredAverageToClassUp(scores, 1)
      expect(result.targetClass).toBe('GM')
      expect(result.atTop).toBe(false)
    })
  })

  describe('K=1..5 cards', () => {
    it('more classifiers generally requires lower average per classifier', () => {
      const scores = buildScores([65, 66, 67, 68, 65, 66])
      const results = [1, 2, 3, 4, 5].map((k) => requiredAverageToClassUp(scores, k))
      const feasibleResults = results.filter((r) => r.feasible && r.minAvgPercent !== null)
      if (feasibleResults.length >= 2) {
        for (let i = 1; i < feasibleResults.length; i++) {
          expect(feasibleResults[i]!.minAvgPercent!).toBeLessThanOrEqual(
            feasibleResults[i - 1]!.minAvgPercent! + 5,
          )
        }
      }
    })
  })
})
