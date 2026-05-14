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

    it('Limited division classifiers parse with plausible percents', () => {
      const result = parseClassificationHtml(fixture('A86278.html'))
      if (!result.ok) throw new Error('parse failed')
      const limitedRows = result.doc.classifiers['Limited'] ?? []
      expect(limitedRows.length).toBeGreaterThan(0)
      for (const row of limitedRows) {
        expect(row.percent).toBeGreaterThan(0)
        expect(row.percent).toBeLessThanOrEqual(110)
      }
    })
  })

  describe('L4898 — lifetime member', () => {
    it('parses lifetime membership type', () => {
      const result = parseClassificationHtml(fixture('L4898.html'))
      expect(result.ok).toBe(true)
      if (!result.ok) return
      expect(result.doc.membershipType).toBe('Lifetime')
    })

    it('has many classifier rows', () => {
      const result = parseClassificationHtml(fixture('L4898.html'))
      if (!result.ok) throw new Error('parse failed')
      const prodRows = result.doc.classifiers['Production'] ?? []
      expect(prodRows.length).toBeGreaterThan(10)
    })

    it('Production classifiers include high percents consistent with GM', () => {
      const result = parseClassificationHtml(fixture('L4898.html'))
      if (!result.ok) throw new Error('parse failed')
      const prodRows = result.doc.classifiers['Production'] ?? []
      const maxPct = Math.max(...prodRows.map((r) => r.percent))
      expect(maxPct).toBeGreaterThanOrEqual(95)
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
    it('returns ok:false for html with no division links and no member info', () => {
      const html = `<html><body><p>Some unrelated page content.</p></body></html>`
      const result = parseClassificationHtml(html)
      expect(result.ok).toBe(false)
    })

    it('produces warnings for malformed rows but still parses valid ones', () => {
      const html = `<html><body>
        <table class="table table-striped">
          <tbody>
            <tr><th scope="row">Shooter Name:</th><td>Test User</td></tr>
            <tr><th scope="row">Member Number:</th><td>A99999</td></tr>
            <tr><th scope="row">Membership Expiry Date:</th><td>3/15/26</td></tr>
          </tbody>
        </table>
        <table class="table table-striped table-responsive">
          <thead class="thead-inverse">
            <tr><th colspan="8"><a href="#" class="divisionClick" data-division="Open">Open Classifiers</a></th></tr>
          </thead>
          <tbody id="Open-dropDown">
            <tr><td>Date</td><td>Number</td><td>Club</td><td>F</td><td>Percent</td><td>HF</td><td>Entered</td><td>Source</td></tr>
            <tr><td>bad-date</td><td>99-11</td><td>Club</td><td>Y</td><td>70.0</td><td>8.0</td><td>bad-date</td><td>Stage Score</td></tr>
            <tr><td>3/15/24</td><td>99-12</td><td>Club</td><td>Y</td><td>70.0</td><td>8.0</td><td>3/18/24</td><td>Stage Score</td></tr>
          </tbody>
        </table>
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
