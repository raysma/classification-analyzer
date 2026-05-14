import { parse } from 'node-html-parser'
import type { HTMLElement as NHElement } from 'node-html-parser'
import type { Division, ClassLetter, Flag, Classifier, ShooterRecord } from '../types/index'

// data-division attribute values (lowercased) → our Division type
const DIVISION_MAP: Record<string, Division> = {
  open: 'Open',
  limited: 'Limited',
  limited_10: 'Limited10',
  limited10: 'Limited10',
  'limited-10': 'Limited10',
  production: 'Production',
  revolver: 'Revolver',
  singlestack: 'SingleStack',
  single_stack: 'SingleStack',
  'single stack': 'SingleStack',
  carryoptics: 'CarryOptics',
  carry_optics: 'CarryOptics',
  'carry optics': 'CarryOptics',
  limitedoptics: 'LimitedOptics',
  limited_optics: 'LimitedOptics',
  'limited optics': 'LimitedOptics',
  pcc: 'PCC',
}


const VALID_FLAGS = new Set(['S', 'M', 'E', 'F', 'A', 'I', 'X', 'Y', 'P', 'Q', 'N', 'B', 'C', 'D', 'G', ''])

const RESTRICTED_SELECTORS = ['.record-restricted', '#record-restricted']
const RESTRICTED_TEXTS = ['not available for public viewing', 'record not viewable', 'private record']

export type ParseResult =
  | { ok: true; doc: ShooterRecord; warnings: string[] }
  | { ok: false; error: string }

function parseDate(raw: string): string | null {
  const trimmed = raw.trim()
  // MM/DD/YYYY (4-digit year)
  const match4 = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(trimmed)
  if (match4) {
    const [, m, d, y] = match4
    return `${y}-${m!.padStart(2, '0')}-${d!.padStart(2, '0')}`
  }
  // MM/DD/YY (2-digit year → 20xx)
  const match2 = /^(\d{1,2})\/(\d{1,2})\/(\d{2})$/.exec(trimmed)
  if (match2) {
    const [, m, d, y] = match2
    return `20${y}-${m!.padStart(2, '0')}-${d!.padStart(2, '0')}`
  }
  return null
}

function parseDivisionKey(raw: string): Division | null {
  return DIVISION_MAP[raw.trim().toLowerCase()] ?? null
}

function parseFlag(raw: string): Flag | null {
  const f = raw.trim()
  if (VALID_FLAGS.has(f)) return f as Flag
  return null
}

function parseMembershipType(raw: string): ShooterRecord['membershipType'] {
  const lower = raw.trim().toLowerCase()
  if (lower.includes('life')) return 'Lifetime'
  if (lower.includes('annual')) return 'Annual'
  if (lower.includes('three') || lower.includes('3-year') || lower.includes('3year')) return 'ThreeYear'
  if (lower.includes('five') || lower.includes('5-year') || lower.includes('5year')) return 'FiveYear'
  return 'Unknown'
}

function cellText(cell: NHElement): string {
  return (cell.textContent ?? '').trim()
}

function isRestrictedRecord(document: NHElement): boolean {
  for (const sel of RESTRICTED_SELECTORS) {
    if (document.querySelector(sel)) return true
  }
  const bodyText = (document.querySelector('body')?.textContent ?? '').toLowerCase()
  return RESTRICTED_TEXTS.some((t) => bodyText.includes(t))
}

export function parseClassificationHtml(html: string): ParseResult {
  const document = parse(html)
  const warnings: string[] = []

  if (isRestrictedRecord(document)) {
    return { ok: false, error: 'record_not_viewable' }
  }

  // --- Member info ---
  // New HTML: <th scope="row">Shooter Name:</th><td>Value</td>
  let name = ''
  let memberNumber = ''
  let membershipType: ShooterRecord['membershipType'] = 'Unknown'

  for (const th of Array.from(document.querySelectorAll('th[scope="row"]'))) {
    const label = (th.textContent ?? '').replace(/:$/, '').trim().toLowerCase()
    const td = th.nextElementSibling as NHElement | null
    if (!td) continue
    const value = (td.textContent ?? '').trim()
    if (label.includes('shooter name')) {
      name = value
    } else if (label.includes('member number')) {
      memberNumber = value
    } else if (label.includes('membership expiry')) {
      membershipType = value.toLowerCase().includes('life') ? 'Lifetime' : 'Annual'
    } else if (label.includes('membership type')) {
      membershipType = parseMembershipType(value)
    }
  }

  // --- Division detection ---
  // New HTML: <a class="divisionClick" data-division="PCC">PCC Classifiers</a>
  const divisionLinks = Array.from(document.querySelectorAll('a.divisionClick'))

  if (divisionLinks.length === 0 && !memberNumber) {
    return { ok: false, error: 'parse_failed' }
  }

  const currentClasses: Partial<Record<Division, { letter: ClassLetter; percent: number }>> = {}
  const classifiers: Partial<Record<Division, Classifier[]>> = {}
  let totalRows = 0

  for (const link of divisionLinks) {
    const divisionKey = (link.getAttribute('data-division') ?? '').trim()
    const division = parseDivisionKey(divisionKey)
    if (!division) {
      warnings.push(`Unknown data-division: "${divisionKey}"`)
      continue
    }

    // Classifier rows live in <tbody id="{divisionKey}-dropDown">
    const tbody = document.querySelector(`#${divisionKey}-dropDown`)
    if (!tbody) {
      warnings.push(`No tbody found for division "${divisionKey}"`)
      continue
    }

    const allRows = Array.from(tbody.querySelectorAll('tr'))
    // First row is the column header row (Date, Number, Club, F, Percent, HF, Entered, Source)
    const dataRows = allRows.slice(1)
    const divClassifiers: Classifier[] = []

    for (const row of dataRows) {
      const cells = Array.from(row.querySelectorAll('td'))
      if (cells.length < 6) continue

      // Column order: date(0), code(1), club(2), flag(3), percent(4), hf(5), entered(6), source(7)
      const dateRaw = cellText(cells[0]!)
      const date = parseDate(dateRaw)
      if (!date) {
        warnings.push(`Could not parse date "${dateRaw}" in ${division}`)
        continue
      }

      const classifierCodeRaw = cellText(cells[1]!)
      const clubRaw = cellText(cells[2]!)
      const flagRaw = cellText(cells[3]!)
      const percentRaw = cellText(cells[4]!)
      const hfRaw = cellText(cells[5]!)
      const sourceRaw = cells[7] ? cellText(cells[7]!) : ''

      const percent = parseFloat(percentRaw)
      if (isNaN(percent)) {
        warnings.push(`Could not parse percent "${percentRaw}" in ${division}`)
        continue
      }

      const flag = parseFlag(flagRaw)
      if (flag === null) {
        warnings.push(`Unrecognized flag "${flagRaw}" in ${division}, treating as empty`)
      }

      const isMajorMatch = sourceRaw.toLowerCase().includes('major')

      let hitFactor: number | undefined
      const hf = parseFloat(hfRaw)
      if (!isNaN(hf)) hitFactor = hf

      const classifier: Classifier = {
        date,
        classifierCode: isMajorMatch ? 'MAJOR' : classifierCodeRaw,
        percent,
        flag: flag ?? '',
        source: isMajorMatch ? 'majorMatch' : 'club',
      }

      if (isMajorMatch && clubRaw) classifier.matchName = clubRaw
      if (hitFactor !== undefined) classifier.hitFactor = hitFactor

      divClassifiers.push(classifier)
      totalRows++
    }

    if (divClassifiers.length > 0) {
      classifiers[division] = divClassifiers
    }
  }

  if (totalRows === 0 && divisionLinks.length > 0) {
    return { ok: false, error: 'no_classifiers_parsed' }
  }

  if (!memberNumber) {
    warnings.push('Could not parse member number from page')
  }

  return {
    ok: true,
    doc: {
      memberNumber: memberNumber || 'UNKNOWN',
      name,
      membershipType,
      currentClasses,
      classifiers,
      fetchedAt: new Date().toISOString(),
      source: 'fetch',
    },
    warnings,
  }
}
