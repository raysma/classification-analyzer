import { describe, it, expect } from 'vitest'
import { getHHF, listActiveClassifiers } from './hhf'

describe('getHHF', () => {
  it('returns the known HHF for 22-07 Carry Optics', () => {
    expect(getHHF('22-07', 'CarryOptics')).toBe(9.0749)
  })

  it('returns the known HHF for 03-03 Carry Optics', () => {
    expect(getHHF('03-03', 'CarryOptics')).toBe(8.2443)
  })

  it('returns the known HHF for 25-01 PCC', () => {
    expect(getHHF('25-01', 'PCC')).toBe(8.9521)
  })

  it('covers Limited 10 for both legacy and 25-series codes', () => {
    expect(getHHF('22-07', 'Limited10')).toBeGreaterThan(0)
    expect(getHHF('25-01', 'Limited10')).toBeGreaterThan(0)
  })

  it('trims whitespace from code', () => {
    expect(getHHF(' 22-07 ', 'CarryOptics')).toBe(9.0749)
    expect(getHHF('22-07\t', 'CarryOptics')).toBe(9.0749)
  })

  it('returns null for unknown code', () => {
    expect(getHHF('99-99', 'CarryOptics')).toBeNull()
  })

  it('returns null for null / undefined / empty inputs', () => {
    expect(getHHF(null, 'CarryOptics')).toBeNull()
    expect(getHHF(undefined, 'CarryOptics')).toBeNull()
    expect(getHHF('', 'CarryOptics')).toBeNull()
    expect(getHHF('   ', 'CarryOptics')).toBeNull()
    expect(getHHF('22-07', null)).toBeNull()
    expect(getHHF('22-07', undefined)).toBeNull()
  })
})

describe('listActiveClassifiers', () => {
  const list = listActiveClassifiers()

  it('returns all 63 active classifier codes', () => {
    expect(list).toHaveLength(63)
  })

  it('is sorted ascending by code', () => {
    const codes = list.map((c) => c.code)
    const sorted = [...codes].sort((a, b) => a.localeCompare(b))
    expect(codes).toEqual(sorted)
  })

  it('joins the human name for each code', () => {
    const entry = list.find((c) => c.code === '22-07')
    expect(entry?.name).toBe('Cross Road Blues')
  })

  it('includes only codes that have a published HHF', () => {
    for (const entry of list) {
      expect(getHHF(entry.code, 'CarryOptics')).not.toBeNull()
    }
  })

  it('falls back to code as name if missing — never empty', () => {
    for (const entry of list) {
      expect(entry.name.length).toBeGreaterThan(0)
    }
  })
})
