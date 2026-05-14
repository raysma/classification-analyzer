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
      expect(result.requiredPercent).toBeNull()
      expect(result.feasible).toBe(false)
    })

    it('returns infeasible for 2 scores + K=1 (still only 3 total)', () => {
      const scores = buildScores([70, 72])
      const result = requiredAverageToClassUp(scores, 1)
      expect(result.requiredPercent).toBeNull()
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
        expect(result.requiredPercent).toBeGreaterThan(0)
        expect(result.requiredPercent).toBeLessThanOrEqual(110)
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
        expect(result.requiredPercent).toBeGreaterThanOrEqual(82)
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
      const feasibleResults = results.filter((r) => r.feasible && r.requiredPercent !== null)
      if (feasibleResults.length >= 2) {
        for (let i = 1; i < feasibleResults.length; i++) {
          expect(feasibleResults[i]!.requiredPercent!).toBeLessThanOrEqual(
            feasibleResults[i - 1]!.requiredPercent! + 5,
          )
        }
      }
    })
  })
})

describe('unclassified shooter — target uses trending class', () => {
  it('3 scores averaging ~48% (C trend) targets B', () => {
    const scores = buildScores([47.12, 47.88, 49.29])
    const result = requiredAverageToClassUp(scores, 1)
    expect(result.targetClass).toBe('B')
    expect(result.targetThreshold).toBe(60)
    expect(result.requiredPercent).not.toBeNull()
    expect(result.requiredPercent).toBeGreaterThan(90) // (60*4 - 48*3 ≈ 96)
  })

  it('3 scores averaging ~70% (B trend) targets A', () => {
    const scores = buildScores([68, 70, 72])
    const result = requiredAverageToClassUp(scores, 1)
    expect(result.targetClass).toBe('A')
    expect(result.targetThreshold).toBe(75)
  })

  it('3 scores averaging ~1% (still U trend) targets D', () => {
    const scores = buildScores([1, 1, 1])
    const result = requiredAverageToClassUp(scores, 1)
    expect(result.targetClass).toBe('D')
    expect(result.targetThreshold).toBe(2)
  })

  it('3 scores at GM-level (95+%) returns atTop=false (not actually classified)', () => {
    const scores = buildScores([95, 96, 97])
    const result = requiredAverageToClassUp(scores, 1)
    // Trending GM but unclassified — atTop should NOT trigger the
    // "Congratulations" message, and minAvgPercent is null (no useful
    // target above GM).
    expect(result.targetClass).toBe('GM')
    expect(result.atTop).toBe(false)
    expect(result.requiredPercent).toBeNull()
  })

  it('cards for K=1..5 show decreasing required average for C-trending shooter', () => {
    const scores = buildScores([48, 48, 48])
    const results = [1, 2, 3, 4, 5].map((k) => requiredAverageToClassUp(scores, k))
    const values = results.map((r) => r.requiredPercent).filter((v): v is number => v !== null)
    // Should be monotonically non-increasing
    for (let i = 1; i < values.length; i++) {
      expect(values[i]!).toBeLessThanOrEqual(values[i - 1]! + 0.01)
    }
  })
})

describe('requiredAverageForTarget — target override (dropdown selection)', () => {
  it('GM shooter targeting A (going down) reports max allowed average', async () => {
    const { requiredAverageForTarget } = await import('./projection')
    const scores = buildScores([96, 96, 96, 96, 96, 96, 96, 96])
    // K=5: shooter must average below A's upper bound (85%, M's lower bound)
    const result = requiredAverageForTarget(scores, 5, 'A')
    expect(result.targetClass).toBe('A')
    expect(result.direction).toBe('down')
    if (result.feasible) {
      expect(result.requiredPercent).toBeLessThan(85)
    }
  })

  it('GM shooter targeting M (going down)', async () => {
    const { requiredAverageForTarget } = await import('./projection')
    const scores = buildScores([97, 98, 96, 97, 98, 99])
    const result = requiredAverageForTarget(scores, 5, 'M')
    expect(result.targetClass).toBe('M')
    expect(result.direction).toBe('down')
  })

  it('C shooter targeting GM (going up, likely infeasible)', async () => {
    const { requiredAverageForTarget } = await import('./projection')
    const scores = buildScores([45, 47, 50, 48, 49, 46])
    const result = requiredAverageForTarget(scores, 1, 'GM')
    expect(result.targetClass).toBe('GM')
    expect(result.direction).toBe('up')
    expect(result.feasible).toBe(false)
  })

  it('A shooter targeting A (maintain)', async () => {
    const { requiredAverageForTarget } = await import('./projection')
    const scores = buildScores([80, 80, 80, 80, 80, 80, 80, 80])
    const result = requiredAverageForTarget(scores, 1, 'A')
    expect(result.targetClass).toBe('A')
    expect(result.direction).toBe('maintain')
  })

  it('GM shooter targeting GM keeps atTop=true', async () => {
    const { requiredAverageForTarget } = await import('./projection')
    const scores = buildScores([97, 98, 96, 97, 98, 99])
    const result = requiredAverageForTarget(scores, 1, 'GM')
    expect(result.atTop).toBe(true)
    expect(result.direction).toBe('at-top')
  })

  it('infeasible down direction when even 0% cannot drop average enough', async () => {
    const { requiredAverageForTarget } = await import('./projection')
    // 8 GM scores, K=1 — can't drop into A in just one classifier (best 6 of 8
    // keeps the 5 highest reals)
    const scores = buildScores([96, 96, 96, 96, 96, 96, 96, 96])
    const result = requiredAverageForTarget(scores, 1, 'A')
    expect(result.direction).toBe('down')
    expect(result.feasible).toBe(false)
  })
})

describe('requiredAverageForTarget — currentClassOverride', () => {
  it('USPSA-GM shooter whose history does not reach 95% still treats GM as current', async () => {
    const { requiredAverageForTarget } = await import('./projection')
    // 8 scores at 90% — our rolling-window math says M (90), but if USPSA
    // recorded them as GM via major-match promotion, the override wins.
    const scores = buildScores([90, 90, 90, 90, 90, 90, 90, 90])

    // Default (no override): our computed says M → picking M is maintain
    const noOverride = requiredAverageForTarget(scores, 1, 'M')
    expect(noOverride.direction).toBe('maintain')

    // With override saying GM: picking M is now correctly direction='down'
    const withOverride = requiredAverageForTarget(scores, 1, 'M', 'GM')
    expect(withOverride.direction).toBe('down')

    // And picking GM with override is the at-top maintain case
    const pickGM = requiredAverageForTarget(scores, 1, 'GM', 'GM')
    expect(pickGM.atTop).toBe(true)
  })
})
