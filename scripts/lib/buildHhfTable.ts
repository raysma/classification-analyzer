// Pure transform: USPSA HHF CSV -> the { shortcode: { code: hhf } } table that
// ships as src/data/uspsa-hhfs.json. No IO — the caller supplies the CSV text.
//
// The CSV (https://uspsa.org/api/scoring/hhf/uspsa/csv) carries one row per
// (date, classifier) with a column per division and 14 dated snapshots. We keep
// only the most recent snapshot; the historical rows are intentionally dropped.

export type HhfTable = Record<string, Record<string, number>>

export interface BuildResult {
  table: HhfTable
  snapshotDate: string
  warnings: string[]
}

// CSV column header -> our division shortcode.
const COLUMN_TO_SHORTCODE: Record<string, string> = {
  OPEN: 'opn',
  LIMITED: 'ltd',
  LIMITED10: 'l10',
  PRODUCTION: 'prod',
  REVOLVER: 'rev',
  SINGLESTACK: 'ss',
  CARRYOPTICS: 'co',
  PCC: 'pcc',
  LIMITEDOPTICS: 'lo',
}

// Fixed division order in the committed JSON; output must match it so an
// unchanged refresh is a byte-identical (no-op) diff.
const DIVISION_ORDER = ['opn', 'ltd', 'prod', 'rev', 'ss', 'co', 'pcc', 'lo', 'l10']

// Codes are ordered by (year, sequence) with the 2-digit year resolved against
// a 1990 pivot so "99-xx" (1999) sorts before "03-xx" (2003), matching the file.
function codeSortKey(code: string): [number, number] {
  const [yy, seq] = code.split('-')
  const year = Number(yy)
  return [year >= 90 ? 1900 + year : 2000 + year, Number(seq)]
}

export function buildHhfTable(csvText: string): BuildResult {
  const lines = csvText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
  const headerLine = lines[0]
  if (!headerLine || lines.length < 2) {
    throw new Error('CSV has no data rows')
  }

  const header = headerLine.split(',').map((h) => h.trim())
  if (header[0] !== 'date' || header[1] !== 'stage') {
    throw new Error(
      `unexpected CSV header start: ${header.slice(0, 2).join(',')} (expected date,stage)`,
    )
  }

  // Map each expected division column to its index; reject if any are missing.
  const divisionCols: Array<{ index: number; shortcode: string }> = []
  const seen = new Set<string>()
  header.forEach((name, index) => {
    const shortcode = COLUMN_TO_SHORTCODE[name]
    if (shortcode) {
      divisionCols.push({ index, shortcode })
      seen.add(name)
    }
  })
  const missing = Object.keys(COLUMN_TO_SHORTCODE).filter((c) => !seen.has(c))
  if (missing.length > 0) {
    throw new Error(`CSV header missing division columns: ${missing.join(', ')}`)
  }

  type Row = { date: string; code: string; cells: string[] }
  const rows: Row[] = []
  for (const line of lines.slice(1)) {
    const cells = line.split(',').map((c) => c.trim())
    const date = cells[0]
    const code = cells[1]
    if (!date || !code) continue
    rows.push({ date, code, cells })
  }
  if (rows.length === 0) {
    throw new Error('CSV has no parseable data rows')
  }

  const snapshotDate = rows.reduce((max, r) => (r.date > max ? r.date : max), '')
  const latest = rows.filter((r) => r.date === snapshotDate)

  const warnings: string[] = []
  const table: HhfTable = {}
  for (const shortcode of DIVISION_ORDER) {
    const col = divisionCols.find((c) => c.shortcode === shortcode)
    if (!col) continue
    const pairs: Array<[string, number]> = []
    for (const row of latest) {
      const raw = row.cells[col.index] ?? ''
      const value = Number(raw)
      if (raw === '' || !Number.isFinite(value) || value === 0) {
        warnings.push(`skipped ${shortcode} ${row.code}: empty/zero HHF (${raw || 'empty'})`)
        continue
      }
      pairs.push([row.code, value])
    }
    pairs.sort((a, b) => {
      const ka = codeSortKey(a[0])
      const kb = codeSortKey(b[0])
      return ka[0] - kb[0] || ka[1] - kb[1]
    })
    const perCode: Record<string, number> = {}
    for (const [code, value] of pairs) perCode[code] = value
    table[shortcode] = perCode
  }

  return { table, snapshotDate, warnings }
}
