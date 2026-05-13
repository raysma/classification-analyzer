import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { parsePastedTable } from './textParser'

function fixture(name: string): string {
  return readFileSync(join(__dirname, '../../tests/fixtures/paste', name), 'utf-8')
}

describe('parsePastedTable', () => {
  describe('A154528-CO.txt — club rows only', () => {
    it('parses all rows', () => {
      const result = parsePastedTable(fixture('A154528-CO.txt'), 'CarryOptics')
      expect(result.ok).toBe(true)
      if (!result.ok) return
      expect(result.parsedRows).toBe(9)
      expect(result.skippedRows).toBe(0)
    })

    it('skips header row', () => {
      const result = parsePastedTable(fixture('A154528-CO.txt'), 'CarryOptics')
      if (!result.ok) throw new Error('parse failed')
      expect(result.classifiers.every((c) => c.date.match(/^\d{4}-\d{2}-\d{2}$/))).toBe(true)
    })

    it('parses dates as YYYY-MM-DD', () => {
      const result = parsePastedTable(fixture('A154528-CO.txt'), 'CarryOptics')
      if (!result.ok) throw new Error('parse failed')
      expect(result.classifiers[0]?.date).toBe('2024-02-18')
    })

    it('parses hit factors', () => {
      const result = parsePastedTable(fixture('A154528-CO.txt'), 'CarryOptics')
      if (!result.ok) throw new Error('parse failed')
      const withHF = result.classifiers.filter((c) => c.hitFactor !== undefined)
      expect(withHF.length).toBe(9)
    })

    it('parses flags', () => {
      const result = parsePastedTable(fixture('A154528-CO.txt'), 'CarryOptics')
      if (!result.ok) throw new Error('parse failed')
      const flags = new Set(result.classifiers.map((c) => c.flag))
      expect(flags.has('Y')).toBe(true)
      expect(flags.has('F')).toBe(true)
      expect(flags.has('E')).toBe(true)
    })
  })

  describe('A86278-Limited.txt — S/M flags + major match', () => {
    it('parses major match row', () => {
      const result = parsePastedTable(fixture('A86278-Limited.txt'), 'Limited')
      expect(result.ok).toBe(true)
      if (!result.ok) return
      const major = result.classifiers.filter((c) => c.source === 'majorMatch')
      expect(major.length).toBe(1)
      expect(major[0]?.hitFactor).toBeUndefined()
      expect(major[0]?.classifierCode).toBe('MAJOR')
    })

    it('parses S and M flags', () => {
      const result = parsePastedTable(fixture('A86278-Limited.txt'), 'Limited')
      if (!result.ok) throw new Error('parse failed')
      const flags = new Set(result.classifiers.map((c) => c.flag))
      expect(flags.has('S')).toBe(true)
      expect(flags.has('M')).toBe(true)
    })

    it('parses correct total rows', () => {
      const result = parsePastedTable(fixture('A86278-Limited.txt'), 'Limited')
      if (!result.ok) throw new Error('parse failed')
      expect(result.parsedRows).toBe(13) // 1 major + 12 club rows
    })
  })

  describe('edge cases', () => {
    it('returns ok:false for empty input', () => {
      const result = parsePastedTable('', 'Open')
      expect(result.ok).toBe(false)
    })

    it('returns ok:false for header-only input', () => {
      const result = parsePastedTable('Date\tClassifier\tClassifier Name\tHit Factor\t%\tFlag\tClub', 'Open')
      expect(result.ok).toBe(false)
    })

    it('skips blank lines', () => {
      const input = [
        'Date\tClassifier\tClassifier Name\tHit Factor\t%\tFlag\tClub',
        '',
        '3/15/2024\t99-11\tSmoke and Hope\t8.1234\t78.54\tY\tPalmetto Gun Club',
        '',
      ].join('\n')
      const result = parsePastedTable(input, 'Open')
      expect(result.ok).toBe(true)
      if (!result.ok) return
      expect(result.parsedRows).toBe(1)
    })

    it('skips rows with bad dates and continues', () => {
      const input = [
        'bad-date\t99-11\tName\t8.0\t70.0\tY\tClub',
        '3/15/2024\t99-12\tName\t8.0\t70.0\tY\tClub',
      ].join('\n')
      const result = parsePastedTable(input, 'Open')
      expect(result.ok).toBe(true)
      if (!result.ok) return
      expect(result.parsedRows).toBe(1)
      expect(result.skippedRows).toBeGreaterThan(0)
    })

    it('handles mixed flags including empty', () => {
      const input = [
        '1/1/2024\t99-11\tTest\t8.0\t75.0\t\tClub A',
        '2/1/2024\t99-12\tTest2\t7.5\t70.0\tY\tClub B',
      ].join('\n')
      const result = parsePastedTable(input, 'Open')
      expect(result.ok).toBe(true)
      if (!result.ok) return
      const flags = result.classifiers.map((c) => c.flag)
      expect(flags).toContain('')
      expect(flags).toContain('Y')
    })
  })
})
