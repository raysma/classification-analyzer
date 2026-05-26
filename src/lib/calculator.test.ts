import { describe, it, expect } from 'vitest'
import { classifyHF, CLASSIFIER_PCT_CAP } from './calculator'

describe('classifyHF — known values', () => {
  it('9.0749 HF on 22-07 Carry Optics → 100% GM', () => {
    const r = classifyHF(9.0749, '22-07', 'CarryOptics')
    expect(r).not.toBeNull()
    expect(r?.letter).toBe('GM')
    expect(r?.hhf).toBe(9.0749)
    expect(r?.pct ?? 0).toBeCloseTo(100, 4)
  })

  it('caps at 110 when raw would exceed it', () => {
    const r = classifyHF(12.0, '22-07', 'CarryOptics')
    expect(r?.pct).toBe(CLASSIFIER_PCT_CAP)
    expect(r?.letter).toBe('GM')
  })

  it('sub-2% → U', () => {
    const r = classifyHF(0.1, '22-07', 'Open')
    expect(r?.letter).toBe('U')
  })

  it('sub-40% but >= 2% → D', () => {
    const r = classifyHF(1.0, '22-07', 'Open')
    expect(r?.letter).toBe('D')
  })
})

describe('classifyHF — boundary sweep', () => {
  // 22-07 / Open HHF = 10.1495. Nudge each boundary HF by a tiny epsilon so
  // floating-point rounding doesn't flip the bracket either way — we only
  // care that the letter falls on the correct side of the cut.
  it('boundary letters via 22-07 Open', () => {
    const hhf = 10.1495
    const EPS = 0.0005
    const just_above = (pct: number) => ((pct + 0.01) / 100) * hhf + EPS
    const just_below = (pct: number) => ((pct - 0.01) / 100) * hhf - EPS
    expect(classifyHF(just_above(95), '22-07', 'Open')?.letter).toBe('GM')
    expect(classifyHF(just_below(95), '22-07', 'Open')?.letter).toBe('M')
    expect(classifyHF(just_above(85), '22-07', 'Open')?.letter).toBe('M')
    expect(classifyHF(just_below(85), '22-07', 'Open')?.letter).toBe('A')
    expect(classifyHF(just_above(75), '22-07', 'Open')?.letter).toBe('A')
    expect(classifyHF(just_below(75), '22-07', 'Open')?.letter).toBe('B')
    expect(classifyHF(just_above(60), '22-07', 'Open')?.letter).toBe('B')
    expect(classifyHF(just_below(60), '22-07', 'Open')?.letter).toBe('C')
    expect(classifyHF(just_above(40), '22-07', 'Open')?.letter).toBe('C')
    expect(classifyHF(just_below(40), '22-07', 'Open')?.letter).toBe('D')
    expect(classifyHF(just_above(2), '22-07', 'Open')?.letter).toBe('D')
    expect(classifyHF(just_below(2), '22-07', 'Open')?.letter).toBe('U')
  })
})

describe('classifyHF — invalid inputs', () => {
  it('returns null for missing HF', () => {
    expect(classifyHF(null, '22-07', 'Open')).toBeNull()
    expect(classifyHF(undefined, '22-07', 'Open')).toBeNull()
  })

  it('returns null for non-positive HF', () => {
    expect(classifyHF(0, '22-07', 'Open')).toBeNull()
    expect(classifyHF(-1, '22-07', 'Open')).toBeNull()
  })

  it('returns null for NaN / Infinity', () => {
    expect(classifyHF(NaN, '22-07', 'Open')).toBeNull()
    expect(classifyHF(Infinity, '22-07', 'Open')).toBeNull()
  })

  it('returns null for unknown code', () => {
    expect(classifyHF(5, '99-99', 'Open')).toBeNull()
  })

  it('returns null for missing code / division', () => {
    expect(classifyHF(5, null, 'Open')).toBeNull()
    expect(classifyHF(5, '22-07', null)).toBeNull()
  })

  it('tolerates whitespace in code', () => {
    expect(classifyHF(9.0749, ' 22-07 ', 'CarryOptics')?.letter).toBe('GM')
  })
})
