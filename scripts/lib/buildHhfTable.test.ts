import { describe, it, expect } from 'vitest'
import { buildHhfTable } from './buildHhfTable.ts'

const HEADER =
  'date,stage,OPEN,LIMITED,LIMITED10,PRODUCTION,REVOLVER,SINGLESTACK,CARRYOPTICS,PCC,LIMITEDOPTICS'

// Two snapshots; the older one has different values + a 99-code (1999) that must
// sort before the 03-code (2003). Latest date must win.
const CSV = [
  HEADER,
  '2024-01-01,03-03,1,1,1,1,1,1,1,1,1',
  '2024-01-01,99-08,1,1,1,1,1,1,1,1,1',
  '2025-11-13,03-03,9.1147,7.7467,8.5421,7.7559,6.0017,7.5389,8.2443,8.7401,8.3794',
  '2025-11-13,99-08,10.248,8.9179,8.9179,8.5421,6.5,7.5,8.2,8.0,8.1',
].join('\n')

describe('buildHhfTable', () => {
  it('keeps only the most recent snapshot', () => {
    const { table, snapshotDate } = buildHhfTable(CSV)
    expect(snapshotDate).toBe('2025-11-13')
    expect(table.opn?.['03-03']).toBe(9.1147)
    expect(table.opn?.['99-08']).toBe(10.248)
  })

  it('maps CSV columns to division shortcodes', () => {
    const { table } = buildHhfTable(CSV)
    expect(table.ltd?.['03-03']).toBe(7.7467)
    expect(table.l10?.['03-03']).toBe(8.5421)
    expect(table.co?.['03-03']).toBe(8.2443)
    expect(table.lo?.['03-03']).toBe(8.3794)
  })

  it('orders codes by (year, seq) with 99 → 1999 before 03 → 2003', () => {
    const { table } = buildHhfTable(CSV)
    expect(Object.keys(table.opn ?? {})).toEqual(['99-08', '03-03'])
  })

  it('emits divisions in the committed file order', () => {
    const { table } = buildHhfTable(CSV)
    expect(Object.keys(table)).toEqual([
      'opn',
      'ltd',
      'prod',
      'rev',
      'ss',
      'co',
      'pcc',
      'lo',
      'l10',
    ])
  })

  it('warns and skips empty/zero cells rather than emitting them', () => {
    const csv = [HEADER, '2025-11-13,03-03,9.1147,0,8.5421,7.75,6,7.5,8.2,8.7,8.3'].join('\n')
    const { table, warnings } = buildHhfTable(csv)
    expect(table.ltd?.['03-03']).toBeUndefined()
    expect(warnings.some((w) => w.includes('ltd 03-03'))).toBe(true)
  })

  it('rejects a header missing division columns', () => {
    const bad = ['date,stage,OPEN,LIMITED', '2025-11-13,03-03,9.1,7.7'].join('\n')
    expect(() => buildHhfTable(bad)).toThrow(/missing division columns/)
  })

  it('rejects a header that does not start with date,stage', () => {
    const bad = [
      HEADER.replace('date,stage', 'when,what'),
      '2025-11-13,03-03,9.1,7.7,8.5,7.7,6,7.5,8.2,8.7,8.3',
    ].join('\n')
    expect(() => buildHhfTable(bad)).toThrow(/expected date,stage/)
  })
})
