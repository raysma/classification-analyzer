// Text paste parser ported and extended from uspsaprogress/progress (ISC)
// https://github.com/uspsaprogress/progress
// Regex rebuilt from observed fixture reality (April 2025 format).
// Lodash removed; native equivalents throughout.
import type { Division } from '../types/index'
import type { ValidatedClassifier } from './validation'
import { FlagSchema } from './validation'

const VALID_FLAGS = new Set(FlagSchema.options)

// Tab-separated classifier row:
// Date  Code  Name  HF  %  Flag  Club
const CLUB_ROW_RE =
  /^(\d{1,2}\/\d{1,2}\/\d{4})\t([^\t]+)\t([^\t]*)\t([\d.]*)\t([\d.]+)\t([A-Z]?)\t(.*)$/

// Major match row: HF column is empty
// Date  "Major Match"  MatchName  <empty>  %  Flag  Club/MatchName
const MAJOR_ROW_RE =
  /^(\d{1,2}\/\d{1,2}\/\d{4})\tMajor Match\t([^\t]*)\t\t([\d.]+)\t([A-Z]?)\t(.*)$/i

function parseDate(raw: string): string | null {
  const match = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(raw.trim())
  if (!match) return null
  const [, m, d, y] = match
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

    // Skip header rows
    if (/^date\t/i.test(trimmed)) continue

    // Try major match row first
    const majorMatch = MAJOR_ROW_RE.exec(line)
    if (majorMatch) {
      const [, dateRaw, matchNameRaw, percentRaw, flagRaw, sourceRaw] = majorMatch
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

    // Try club row
    const clubMatch = CLUB_ROW_RE.exec(line)
    if (clubMatch) {
      const [, dateRaw, codeRaw, nameRaw, hfRaw, percentRaw, flagRaw] = clubMatch
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
