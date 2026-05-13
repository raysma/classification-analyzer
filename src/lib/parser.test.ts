import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { parseClassificationHtml } from './parser'

function fixture(name: string): string {
  return readFileSync(join(__dirname, '../../tests/fixtures/uspsa', name), 'utf-8')
}

describe('parseClassificationHtml', () => {
  describe('A154528 — annual, multi-division', () => {
    it('parses successfully', () => {
      const result = parseClassificationHtml(fixture('A154528.html'))
      expect(result.ok).toBe(true)
      if (!result.ok) return

      expect(result.doc.name).toBe('Jane Smith')
      expect(result.doc.membershipType).toBe('Annual')
      expect(result.doc.source).toBe('fetch')
    })

    it('parses three divisions', () => {
      const result = parseClassificationHtml(fixture('A154528.html'))
      if (!result.ok) throw new Error('parse failed')
      const divs = Object.keys(result.doc.classifiers)
      expect(divs).toContain('Open')
      expect(divs).toContain('CarryOptics')
      expect(divs).toContain('Production')
    })

    it('parses current classes', () => {
      const result = parseClassificationHtml(fixture('A154528.html'))
      if (!result.ok) throw new Error('parse failed')
      expect(result.doc.currentClasses['Open']).toEqual({ letter: 'A', percent: 78.5 })
      expect(result.doc.currentClasses['CarryOptics']).toEqual({ letter: 'B', percent: 65.2 })
      expect(result.doc.currentClasses['Production']).toEqual({ letter: 'C', percent: 48.1 })
    })

    it('parses dates as YYYY-MM-DD', () => {
      const result = parseClassificationHtml(fixture('A154528.html'))
      if (!result.ok) throw new Error('parse failed')
      const openRows = result.doc.classifiers['Open'] ?? []
      expect(openRows.length).toBeGreaterThan(0)
      for (const row of openRows) {
        expect(row.date).toMatch(/^\d{4}-\d{2}-\d{2}$/)
      }
    })

    it('detects major match rows', () => {
      const result = parseClassificationHtml(fixture('A154528.html'))
      if (!result.ok) throw new Error('parse failed')
      const openRows = result.doc.classifiers['Open'] ?? []
      const majorRows = openRows.filter((r) => r.source === 'majorMatch')
      expect(majorRows.length).toBeGreaterThan(0)
      for (const row of majorRows) {
        expect(row.hitFactor).toBeUndefined()
        expect(row.classifierCode).toBe('MAJOR')
      }
    })

    it('club rows have hitFactor', () => {
      const result = parseClassificationHtml(fixture('A154528.html'))
      if (!result.ok) throw new Error('parse failed')
      const openRows = result.doc.classifiers['Open'] ?? []
      const clubRows = openRows.filter((r) => r.source === 'club')
      expect(clubRows.length).toBeGreaterThan(0)
      for (const row of clubRows) {
        expect(typeof row.hitFactor).toBe('number')
      }
    })

    it('parses all valid flags', () => {
      const result = parseClassificationHtml(fixture('A154528.html'))
      if (!result.ok) throw new Error('parse failed')
      const allRows = Object.values(result.doc.classifiers).flat()
      const flags = new Set(allRows.map((r) => r.flag))
      // Should include Y, F, M, E and possibly empty
      expect(flags.has('Y')).toBe(true)
      expect(flags.has('F')).toBe(true)
      expect(flags.has('E')).toBe(true)
    })
  })

  describe('A86278 — S/M/P flags', () => {
    it('parses successfully with S, M, P flags', () => {
      const result = parseClassificationHtml(fixture('A86278.html'))
      expect(result.ok).toBe(true)
      if (!result.ok) return

      const allRows = Object.values(result.doc.classifiers).flat()
      const flags = new Set(allRows.map((r) => r.flag))
      expect(flags.has('S')).toBe(true)
      expect(flags.has('M')).toBe(true)
      expect(flags.has('P')).toBe(true)
    })

    it('parses M (Master) current class', () => {
      const result = parseClassificationHtml(fixture('A86278.html'))
      if (!result.ok) throw new Error('parse failed')
      expect(result.doc.currentClasses['Limited']?.letter).toBe('M')
    })
  })

  describe('L4898 — lifetime member', () => {
    it('parses lifetime membership type', () => {
      const result = parseClassificationHtml(fixture('L4898.html'))
      expect(result.ok).toBe(true)
      if (!result.ok) return
      expect(result.doc.membershipType).toBe('Lifetime')
    })

    it('parses GM current class', () => {
      const result = parseClassificationHtml(fixture('L4898.html'))
      if (!result.ok) throw new Error('parse failed')
      expect(result.doc.currentClasses['Production']?.letter).toBe('GM')
    })

    it('has many classifier rows', () => {
      const result = parseClassificationHtml(fixture('L4898.html'))
      if (!result.ok) throw new Error('parse failed')
      const prodRows = result.doc.classifiers['Production'] ?? []
      expect(prodRows.length).toBeGreaterThan(10)
    })
  })

  describe('A155617 — private record', () => {
    it('returns ok:false with record_not_viewable', () => {
      const result = parseClassificationHtml(fixture('A155617.html'))
      expect(result.ok).toBe(false)
      if (result.ok) return
      expect(result.error).toBe('record_not_viewable')
    })
  })

  describe('edge cases', () => {
    it('returns ok:false for empty html with no classifiers', () => {
      const html = `<html><body><div class="container">
        <div class="member-info"><h2>Test</h2><p>Member: X1</p><p>Membership: Annual</p></div>
        <div class="division-block"><h3>Open</h3><div class="current-class">A - 75.0%</div>
        <table class="classifier-table"><thead></thead><tbody></tbody></table></div>
      </body></html>`
      const result = parseClassificationHtml(html)
      expect(result.ok).toBe(false)
    })

    it('produces warnings for malformed rows but still parses valid ones', () => {
      const html = `<html><body><div class="container">
        <div class="member-info"><h2>Test User</h2><p>Member: A99999</p><p>Membership: Annual</p></div>
        <div class="division-block"><h3>Open</h3><div class="current-class">B - 62.0%</div>
        <table class="classifier-table"><thead></thead><tbody>
          <tr><td>bad-date</td><td>99-11</td><td>Name</td><td>8.0</td><td>70.0</td><td>Y</td><td>Club</td></tr>
          <tr><td>3/15/2024</td><td>99-12</td><td>Name</td><td>8.0</td><td>70.0</td><td>Y</td><td>Club</td></tr>
        </tbody></table></div>
      </body></html>`
      const result = parseClassificationHtml(html)
      expect(result.ok).toBe(true)
      if (!result.ok) return
      expect(result.warnings.length).toBeGreaterThan(0)
      const openRows = result.doc.classifiers['Open'] ?? []
      expect(openRows.length).toBe(1)
    })
  })
})
