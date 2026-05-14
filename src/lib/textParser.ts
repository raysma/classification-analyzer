// Text paste parser ported and extended from uspsaprogress/progress (ISC)
// https://github.com/uspsaprogress/progress
// Lodash removed; native equivalents throughout.
import type { Division } from '../types/index'
import type { ValidatedClassifier } from './validation'
import { FlagSchema } from './validation'

const VALID_FLAGS = new Set(FlagSchema.options)

// New 8-column format (USPSA current, 2025+):
// Date  Number  Club  F  Percent  HF  Entered  Source
const NEW_ROW_RE =
  /^(\d{1,2}\/\d{1,2}\/\d{2,4})\t([^\t]*)\t([^\t]*)\t([A-Z]?)\t([\d.]+)\t([^\t]*)\t[^\t]*\t([^\t]+)$/

// Old 7-column format (pre-2025):
// Date  Code  Name  HF  %  Flag  Club
const OLD_CLUB_ROW_RE =
  /^(\d{1,2}\/\d{1,2}\/\d{2,4})\t([^\t]+)\t([^\t]*)\t([\d.]*)\t([\d.]+)\t([A-Z]?)\t(.*)$/

// Old major match row (pre-2025): HF column is empty, second col is literal "Major Match"
const OLD_MAJOR_ROW_RE =
  /^(\d{1,2}\/\d{1,2}\/\d{2,4})\tMajor Match\t([^\t]*)\t\t([\d.]+)\t([A-Z]?)\t(.*)$/i

function parseDate(raw: string): string | null {
  const trimmed = raw.trim()
  // Accepts M/D/YYYY or M/D/YY (2-digit year expanded to 20xx for < 50, else 19xx)
  const match = /^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/.exec(trimmed)
  if (!match) return null
  const [, m, d, yRaw] = match
  const y =
    yRaw!.length === 2
      ? parseInt(yRaw!, 10) < 50
        ? `20${yRaw}`
        : `19${yRaw}`
      : yRaw!
  return `${y}-${m!.padStart(2, '0')}-${d!.padStart(2, '0')}`
}

export interface ParsedPasteResult {
  ok: true
  classifiers: ValidatedClassifier[]
  parsedRows: number
  skippedRows: number
  warnings: string[]
}

export interface ParsePasteError {
  ok: false
  error: string
}

export function parsePastedTable(
  input: string,
  _division: Division,
): ParsedPasteResult | ParsePasteError {
  const lines = input.split('\n').map((l) => l.replace(/\r$/, ''))
  const classifiers: ValidatedClassifier[] = []
  const warnings: string[] = []
  let parsedRows = 0
  let skippedRows = 0

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) continue

    // Skip header rows (both old and new format start with "Date\t")
    if (/^date\t/i.test(trimmed)) continue

    // --- New 8-column format (USPSA 2025+) ---
    const newMatch = NEW_ROW_RE.exec(line)
    if (newMatch) {
      const [, dateRaw, codeRaw, clubRaw, flagRaw, percentRaw, hfRaw, sourceRaw] = newMatch
      const date = parseDate(dateRaw ?? '')
      if (!date) {
        warnings.push(`Skipped row: bad date "${dateRaw ?? ''}"`)
        skippedRows++
        continue
      }
      const percent = parseFloat(percentRaw ?? '')
      if (Number.isNaN(percent)) {
        warnings.push(`Skipped row: bad percent "${percentRaw ?? ''}"`)
        skippedRows++
        continue
      }
      const flagCandidate = (flagRaw ?? '').trim() as ValidatedClassifier['flag']
      const flag: ValidatedClassifier['flag'] = VALID_FLAGS.has(flagCandidate) ? flagCandidate : ''
      const isMajorMatch = /major\s*match/i.test(sourceRaw ?? '')

      if (isMajorMatch) {
        const entry: ValidatedClassifier = {
          date,
          classifierCode: 'MAJOR',
          percent,
          flag,
          source: 'majorMatch',
        }
        const matchName = (clubRaw ?? '').trim()
        if (matchName) entry.matchName = matchName
        classifiers.push(entry)
        parsedRows++
      } else {
        const entry: ValidatedClassifier = {
          date,
          classifierCode: (codeRaw ?? '').trim(),
          percent,
          flag,
          source: 'club',
        }
        const hf = parseFloat(hfRaw ?? '')
        if (!Number.isNaN(hf) && hf > 0) entry.hitFactor = hf
        classifiers.push(entry)
        parsedRows++
      }
      continue
    }

    // --- Old format: major match row ---
    const oldMajorMatch = OLD_MAJOR_ROW_RE.exec(line)
    if (oldMajorMatch) {
      const [, dateRaw, matchNameRaw, percentRaw, flagRaw, sourceRaw] = oldMajorMatch
      const date = parseDate(dateRaw ?? '')
      if (!date) {
        warnings.push(`Skipped major match row: bad date "${dateRaw ?? ''}"`)
        skippedRows++
        continue
      }
      const percent = parseFloat(percentRaw ?? '')
      if (Number.isNaN(percent)) {
        warnings.push(`Skipped major match row: bad percent "${percentRaw ?? ''}"`)
        skippedRows++
        continue
      }
      const flagCandidate = (flagRaw ?? '').trim() as ValidatedClassifier['flag']
      const flag: ValidatedClassifier['flag'] = VALID_FLAGS.has(flagCandidate) ? flagCandidate : ''
      const entry: ValidatedClassifier = {
        date,
        classifierCode: 'MAJOR',
        percent,
        flag,
        source: 'majorMatch',
      }
      const name = (matchNameRaw ?? '').trim()
      if (name) entry.classifierName = name
      const matchName = (sourceRaw ?? '').trim()
      if (matchName) entry.matchName = matchName
      classifiers.push(entry)
      parsedRows++
      continue
    }

    // --- Old format: club row ---
    const oldClubMatch = OLD_CLUB_ROW_RE.exec(line)
    if (oldClubMatch) {
      const [, dateRaw, codeRaw, nameRaw, hfRaw, percentRaw, flagRaw] = oldClubMatch
      const date = parseDate(dateRaw ?? '')
      if (!date) {
        warnings.push(`Skipped row: bad date "${dateRaw ?? ''}"`)
        skippedRows++
        continue
      }
      const percent = parseFloat(percentRaw ?? '')
      if (Number.isNaN(percent)) {
        warnings.push(`Skipped row: bad percent "${percentRaw ?? ''}"`)
        skippedRows++
        continue
      }
      const flagCandidate = (flagRaw ?? '').trim() as ValidatedClassifier['flag']
      const flag: ValidatedClassifier['flag'] = VALID_FLAGS.has(flagCandidate) ? flagCandidate : ''
      const entry: ValidatedClassifier = {
        date,
        classifierCode: (codeRaw ?? '').trim(),
        percent,
        flag,
        source: 'club',
      }
      const name = (nameRaw ?? '').trim()
      if (name) entry.classifierName = name
      const hf = parseFloat(hfRaw ?? '')
      if (!Number.isNaN(hf) && hf > 0) entry.hitFactor = hf
      classifiers.push(entry)
      parsedRows++
      continue
    }

    // Unrecognized line
    skippedRows++
    if (trimmed.length > 5) {
      warnings.push(`Skipped unrecognized row: "${trimmed.slice(0, 60)}"`)
    }
  }

  if (parsedRows === 0) {
    return { ok: false, error: 'no_rows_parsed' }
  }

  return { ok: true, classifiers, parsedRows, skippedRows, warnings }
}
