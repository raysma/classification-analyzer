import { describe, it, expect } from 'vitest'
import {
  classFor,
  isInvalidFlag,
  bestSixOfRecentEight,
  RollingWindow,
  getCurrentWindow,
  getClassificationHistory,
  allTimeBestClass,
  nextClassThreshold,
} from './rules'
import type { ValidatedClassifier } from './validation'

function mkScore(
  percent: number,
  date = '2024-01-01',
  code = '99-11',
  flag: ValidatedClassifier['flag'] = 'Y',
): ValidatedClassifier {
  return { date, classifierCode: code, percent, flag, source: 'club' }
}

describe('classFor', () => {
  it('returns GM for >= 95', () => expect(classFor(95)).toBe('GM'))
  it('returns GM for 110', () => expect(classFor(110)).toBe('GM'))
  it('returns M for 85', () => expect(classFor(85)).toBe('M'))
  it('returns A for 75', () => expect(classFor(75)).toBe('A'))
  it('returns B for 60', () => expect(classFor(60)).toBe('B'))
  it('returns C for 40', () => expect(classFor(40)).toBe('C'))
  it('returns D for 2', () => expect(classFor(2)).toBe('D'))
  it('returns U for 1.9', () => expect(classFor(1.9)).toBe('U'))
  it('boundary M/A: 84.9 is A', () => expect(classFor(84.9)).toBe('A'))
})

describe('isInvalidFlag', () => {
  it('excludes I, Q, N', () => {
    expect(isInvalidFlag('I')).toBe(true)
    expect(isInvalidFlag('Q')).toBe(true)
    expect(isInvalidFlag('N')).toBe(true)
  })
  it('excludes retired flags B, C, D, G (April 2025)', () => {
    expect(isInvalidFlag('B')).toBe(true)
    expect(isInvalidFlag('C')).toBe(true)
    expect(isInvalidFlag('D')).toBe(true)
    expect(isInvalidFlag('G')).toBe(true)
  })
  it('includes valid flags', () => {
    for (const f of ['Y', 'F', 'E', 'M', 'S', 'A', 'X', 'P', ''] as const) {
      expect(isInvalidFlag(f)).toBe(false)
    }
  })
})

describe('bestSixOfRecentEight — documented n behavior', () => {
  it('n=4: returns all 4 as included', () => {
    const scores = [mkScore(70), mkScore(72), mkScore(74), mkScore(76)]
    const { included, dropped } = bestSixOfRecentEight(scores)
    expect(included.length).toBe(4)
    expect(dropped.length).toBe(0)
  })

  it('n=5: returns all 5', () => {
    const scores = [70, 72, 74, 76, 78].map((p) => mkScore(p))
    const { included, dropped } = bestSixOfRecentEight(scores)
    expect(included.length).toBe(5)
    expect(dropped.length).toBe(0)
  })

  it('n=6: returns all 6', () => {
    const scores = [70, 72, 74, 76, 78, 80].map((p) => mkScore(p))
    const { included } = bestSixOfRecentEight(scores)
    expect(included.length).toBe(6)
  })

  it('n=7: best 6 of 7, drops lowest', () => {
    const scores = [50, 70, 72, 74, 76, 78, 80].map((p) => mkScore(p))
    const { included, dropped } = bestSixOfRecentEight(scores)
    expect(included.length).toBe(6)
    expect(dropped.length).toBe(1)
    expect(dropped[0]?.percent).toBe(50)
  })

  it('n=8: best 6 of 8, drops two lowest', () => {
    const scores = [50, 55, 70, 72, 74, 76, 78, 80].map((p) => mkScore(p))
    const { included, dropped } = bestSixOfRecentEight(scores)
    expect(included.length).toBe(6)
    expect(dropped.length).toBe(2)
    const droppedPercents = dropped.map((d) => d.percent).sort((a, b) => a - b)
    expect(droppedPercents).toEqual([50, 55])
  })

  it('n=9: uses only the most recent 8', () => {
    // oldest score (date-wise would be reflected in window ordering)
    // In bestSixOfRecentEight, we take scores.slice(n-8) for n>=8
    const scores = [10, 55, 70, 72, 74, 76, 78, 80, 82].map((p, i) =>
      mkScore(p, `2024-0${i + 1}-01`),
    )
    const { included, dropped } = bestSixOfRecentEight(scores)
    // pool is last 8: [55,70,72,74,76,78,80,82]; best 6 of those
    expect(included.length).toBe(6)
    const droppedPercents = dropped.map((d) => d.percent).sort((a, b) => a - b)
    expect(droppedPercents).toEqual([55, 70])
    // 10% (first entry) not in pool at all
  })

  it('n<4: no included', () => {
    const { included } = bestSixOfRecentEight([mkScore(80), mkScore(82)])
    expect(included.length).toBe(0)
  })
})

describe('RollingWindow', () => {
  it('MRO: replaces earlier score with same classifierCode', () => {
    const w = new RollingWindow()
    w.append(mkScore(60, '2024-01-01', '99-11'))
    w.append(mkScore(80, '2024-06-01', '99-11'))
    const scores = w.getScores()
    expect(scores.length).toBe(1)
    expect(scores[0]?.percent).toBe(80)
  })

  it('truncates to 8 most recent', () => {
    const w = new RollingWindow()
    for (let i = 1; i <= 10; i++) {
      w.append(mkScore(60 + i, `2024-${String(i).padStart(2, '0')}-01`, `code-${i}`))
    }
    expect(w.getScores().length).toBe(8)
  })

  it('excludes invalid flags', () => {
    const w = new RollingWindow()
    w.append(mkScore(80, '2024-01-01', '99-11', 'I'))
    expect(w.getScores().length).toBe(0)
  })

  it('classificationScore returns null for <4 scores', () => {
    const w = new RollingWindow()
    w.append(mkScore(80, '2024-01-01', '99-11'))
    w.append(mkScore(82, '2024-02-01', '99-12'))
    expect(w.classificationScore()).toBeNull()
  })

  it('classificationScore averages 4 scores correctly', () => {
    const w = new RollingWindow()
    w.append(mkScore(80, '2024-01-01', 'a'))
    w.append(mkScore(80, '2024-02-01', 'b'))
    w.append(mkScore(80, '2024-03-01', 'c'))
    w.append(mkScore(80, '2024-04-01', 'd'))
    expect(w.classificationScore()).toBe(80)
  })
})

describe('getClassificationHistory', () => {
  it('returns snapshots starting at 4th score', () => {
    const scores = ['a', 'b', 'c', 'd', 'e'].map((code, i) =>
      mkScore(70 + i * 2, `2024-0${i + 1}-01`, code),
    )
    const history = getClassificationHistory(scores)
    expect(history.length).toBeGreaterThanOrEqual(2) // entries from 4th score onward
    expect(history[0]?.date).toBeDefined()
  })
})

describe('allTimeBestClass', () => {
  it('returns GM when history contains it', () => {
    const history = [
      { date: '2024-01-01', percent: 96, classLetter: 'GM' as const },
      { date: '2024-06-01', percent: 80, classLetter: 'A' as const },
    ]
    expect(allTimeBestClass(history)).toBe('GM')
  })

  it('returns U for empty history', () => {
    expect(allTimeBestClass([])).toBe('U')
  })
})

describe('nextClassThreshold', () => {
  it('returns null for GM', () => expect(nextClassThreshold('GM')).toBeNull())
  it('returns 95 for M', () => expect(nextClassThreshold('M')).toBe(95))
  it('returns 85 for A', () => expect(nextClassThreshold('A')).toBe(85))
})

describe('end-to-end: A154528 Open fixture', () => {
  it('computes a sensible classification percent', async () => {
    const { readFileSync } = await import('fs')
    const { join } = await import('path')
    const { parseClassificationHtml } = await import('./parser')

    const html = readFileSync(
      join(__dirname, '../../tests/fixtures/uspsa/A154528.html'),
      'utf-8',
    )
    const result = parseClassificationHtml(html)
    if (!result.ok) throw new Error('parse failed')

    const openScores = result.doc.classifiers['Open'] ?? []
    const window = getCurrentWindow(openScores)
    const pct = window.classificationScore()
    expect(pct).not.toBeNull()
    if (pct !== null) {
      expect(pct).toBeGreaterThan(0)
      expect(pct).toBeLessThanOrEqual(110)
    }
  })
})
