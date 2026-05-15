import { describe, it, expect } from 'vitest'
import { classifierKey } from './classifierKey'
import type { ValidatedClassifier } from './validation'

function mk(date: string, code: string, percent: number): ValidatedClassifier {
  return { date, classifierCode: code, percent, flag: 'Y', source: 'club' }
}

describe('classifierKey', () => {
  it('disambiguates same-day same-classifier rows with different percents', () => {
    const a = mk('2024-05-03', '23-02', 90.7121)
    const b = mk('2024-05-03', '23-02', 82.7656)
    expect(classifierKey(a)).not.toBe(classifierKey(b))
  })

  it('produces unique keys for a realistic fixture with 27 same-day-same-code pairs', () => {
    // Mirrors the L6332 CarryOptics pattern where multiple attempts of the same
    // classifier code show up on the same day with different percents. Before
    // the fix these collided as React keys, causing duplicate-row ghosting on
    // re-render.
    const rows: ValidatedClassifier[] = []
    for (let i = 0; i < 30; i++) {
      const date = `2024-0${(i % 9) + 1}-0${(i % 9) + 1}`
      rows.push(mk(date, '23-02', 70 + i * 0.5))
      rows.push(mk(date, '23-02', 50 + i * 0.3))
    }
    const keys = new Set(rows.map(classifierKey))
    expect(keys.size).toBe(rows.length)
  })

  it('uses date, classifierCode, and percent', () => {
    expect(classifierKey(mk('2024-05-03', '23-02', 90.71))).toBe('2024-05-03:23-02:90.71')
  })
})
