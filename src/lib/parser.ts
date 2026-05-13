import { parse } from 'node-html-parser'
import type { HTMLElement as NHElement } from 'node-html-parser'
import type { Division, ClassLetter, Flag, Classifier, ShooterRecord } from '../types/index'

const DIVISION_MAP: Record<string, Division> = {
  open: 'Open',
  limited: 'Limited',
  limited10: 'Limited10',
  'limited-10': 'Limited10',
  production: 'Production',
  revolver: 'Revolver',
  singlestack: 'SingleStack',
  'single stack': 'SingleStack',
  carryoptics: 'CarryOptics',
  'carry optics': 'CarryOptics',
  limitedoptics: 'LimitedOptics',
  'limited optics': 'LimitedOptics',
  pcc: 'PCC',
}

const CLASS_MAP: Record<string, ClassLetter> = {
  GM: 'GM',
  M: 'M',
  A: 'A',
  B: 'B',
  C: 'C',
  D: 'D',
  U: 'U',
}

const VALID_FLAGS = new Set(['S', 'M', 'E', 'F', 'A', 'I', 'X', 'Y', 'P', 'Q', 'N', 'B', 'C', 'D', 'G', ''])

const RESTRICTED_SELECTORS = ['.record-restricted', '#record-restricted']
const RESTRICTED_TEXTS = ['not available for public viewing', 'record not viewable', 'private record']

export type ParseResult =
  | { ok: true; doc: ShooterRecord; warnings: string[] }
  | { ok: false; error: string }

function parseDate(raw: string): string | null {
  const trimmed = raw.trim()
  // Expected formats: M/D/YYYY or MM/DD/YYYY
  const match = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(trimmed)
  if (!match) return null
  const [, m, d, y] = match
  return `${y}-${m!.padStart(2, '0')}-${d!.padStart(2, '0')}`
}

function parseDivisionName(raw: string): Division | null {
  const key = raw.trim().toLowerCase()
  return DIVISION_MAP[key] ?? null
}

function parseCurrentClass(raw: string): { letter: ClassLetter; percent: number } | null {
  // Format: "A - 78.5%" or "GM - 95.1%"
  const match = /^([A-Z]+)\s*-\s*([\d.]+)%$/.exec(raw.trim())
  if (!match) return null
  const [, letter, percentStr] = match
  const cls = CLASS_MAP[letter ?? '']
  if (!cls) return null
  const percent = parseFloat(percentStr ?? '0')
  if (isNaN(percent)) return null
  return { letter: cls, percent }
}

function parseFlag(raw: string): Flag | null {
  const f = raw.trim()
  if (VALID_FLAGS.has(f)) return f as Flag
  return null
}

function parseMembershipType(
  raw: string,
): 'Annual' | 'ThreeYear' | 'FiveYear' | 'Lifetime' | 'Unknown' {
  const lower = raw.trim().toLowerCase()
  if (lower.includes('lifetime')) return 'Lifetime'
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
  const memberInfoEl = document.querySelector('.member-info')

  // If neither member info nor division blocks are present, this isn't a USPSA classification page
  // (e.g. a Cloudflare challenge page or any other non-classification response)
  const hasDivisionBlocks = document.querySelectorAll('.division-block').length > 0
  if (!memberInfoEl && !hasDivisionBlocks) {
    return { ok: false, error: 'parse_failed' }
  }
  const name = (memberInfoEl?.querySelector('h2')?.textContent ?? '').trim()

  let memberNumber = ''
  let membershipType: ShooterRecord['membershipType'] = 'Unknown'

  const paragraphs = memberInfoEl?.querySelectorAll('p') ?? []
  for (const p of Array.from(paragraphs)) {
    const text = (p.textContent ?? '').trim()
    const memberMatch = /^Member:\s*(.+)$/.exec(text)
    if (memberMatch) {
      memberNumber = (memberMatch[1] ?? '').trim()
      continue
    }
    const membershipMatch = /^Membership:\s*(.+)$/.exec(text)
    if (membershipMatch) {
      membershipType = parseMembershipType(membershipMatch[1] ?? '')
    }
  }

  if (!memberNumber) {
    warnings.push('Could not parse member number from page')
  }

  // --- Division blocks ---
  const divisionBlocks = Array.from(document.querySelectorAll('.division-block'))
  const currentClasses: Partial<Record<Division, { letter: ClassLetter; percent: number }>> = {}
  const classifiers: Partial<Record<Division, Classifier[]>> = {}

  let totalRows = 0

  for (const block of divisionBlocks) {
    const divisionName = (block.querySelector('h3')?.textContent ?? '').trim()
    const division = parseDivisionName(divisionName)
    if (!division) {
      warnings.push(`Unknown division name: "${divisionName}"`)
      continue
    }

    // Parse current class
    const currentClassText = (block.querySelector('.current-class')?.textContent ?? '').trim()
    const currentClass = parseCurrentClass(currentClassText)
    if (currentClass) {
      currentClasses[division] = currentClass
    } else {
      warnings.push(`Could not parse current class for ${division}: "${currentClassText}"`)
    }

    // Parse classifier rows
    const rows = Array.from(block.querySelectorAll('table.classifier-table tbody tr'))
    const divClassifiers: Classifier[] = []

    for (const row of rows) {
      const cells = Array.from(row.querySelectorAll('td'))
      if (cells.length < 7) {
        warnings.push(`Skipping malformed row in ${division}: only ${cells.length} cells`)
        continue
      }

      const dateRaw = cellText(cells[0]!)
      const date = parseDate(dateRaw)
      if (!date) {
        warnings.push(`Could not parse date "${dateRaw}" in ${division}`)
        continue
      }

      const classifierCodeRaw = cellText(cells[1]!)
      const isMajorMatch =
        classifierCodeRaw.toLowerCase() === 'major match' ||
        classifierCodeRaw.toLowerCase().includes('major match')

      const classifierNameRaw = cellText(cells[2]!)
      const hfRaw = cellText(cells[3]!)
      const percentRaw = cellText(cells[4]!)
      const flagRaw = cellText(cells[5]!)
      const sourceRaw = cellText(cells[6]!)

      const percent = parseFloat(percentRaw)
      if (isNaN(percent)) {
        warnings.push(`Could not parse percent "${percentRaw}" in ${division}`)
        continue
      }

      const flag = parseFlag(flagRaw)
      if (flag === null) {
        warnings.push(`Unrecognized flag "${flagRaw}" in ${division}, treating as empty`)
      }

      let hitFactor: number | undefined
      if (!isMajorMatch && hfRaw !== '-' && hfRaw !== '') {
        const hf = parseFloat(hfRaw)
        if (!isNaN(hf)) hitFactor = hf
      }

      const classifier: Classifier = {
        date,
        classifierCode: isMajorMatch ? 'MAJOR' : classifierCodeRaw,
        percent,
        flag: flag ?? '',
        source: isMajorMatch ? 'majorMatch' : 'club',
      }

      if (classifierNameRaw) classifier.classifierName = classifierNameRaw
      if (hitFactor !== undefined) classifier.hitFactor = hitFactor
      if (isMajorMatch && sourceRaw) classifier.matchName = sourceRaw

      divClassifiers.push(classifier)
      totalRows++
    }

    if (divClassifiers.length > 0) {
      classifiers[division] = divClassifiers
    }
  }

  if (totalRows === 0 && divisionBlocks.length > 0) {
    return { ok: false, error: 'no_classifiers_parsed' }
  }

  const record: ShooterRecord = {
    memberNumber: memberNumber || 'UNKNOWN',
    name,
    membershipType,
    currentClasses,
    classifiers,
    fetchedAt: new Date().toISOString(),
    source: 'fetch',
  }

  return { ok: true, doc: record, warnings }
}
