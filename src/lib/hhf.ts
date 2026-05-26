// HHF (High Hit Factor) lookup + active-classifier listing.
//
// Source data (committed verbatim under src/data/):
//   - uspsa-hhfs.json        — keyed by division shortcode → classifier → hhf
//   - uspsa-classifiers.json — names for every classifier code USPSA has published
//   - uspsa-divisions.json   — shortcode ↔ long-name mapping (informational)
//
// All three files are mirrored from
// https://github.com/CodeHowlerMonkey/hitfactor.info/tree/main/data.
// To refresh, replace the files in place and re-run the test suite.
//
// A classifier is "active" iff it appears in uspsa-hhfs.json — the upstream
// HHF dataset is the source of truth. classifiers.json contains historical
// codes that no longer have a published HHF; those are deliberately filtered.
import type { Division } from '../types/index'
import hhfData from '../data/uspsa-hhfs.json'
import classifierData from '../data/uspsa-classifiers.json'

const DIVISION_TO_SHORTCODE: Record<Division, string> = {
  Open: 'opn',
  Limited: 'ltd',
  Limited10: 'l10',
  Production: 'prod',
  Revolver: 'rev',
  SingleStack: 'ss',
  CarryOptics: 'co',
  LimitedOptics: 'lo',
  PCC: 'pcc',
}

type HHFTable = Record<string, Record<string, number>>
type ClassifierFile = {
  classifiers?: Array<{ classifier?: unknown; name?: unknown }>
}

const hhfTable = hhfData as HHFTable

// code (upper-case trimmed) -> Division -> hhf
const HHF_INDEX: Map<string, Partial<Record<Division, number>>> = (() => {
  const map = new Map<string, Partial<Record<Division, number>>>()
  for (const [division, shortcode] of Object.entries(DIVISION_TO_SHORTCODE) as Array<
    [Division, string]
  >) {
    const perCode = hhfTable[shortcode]
    if (!perCode) continue
    for (const [rawCode, hhf] of Object.entries(perCode)) {
      if (typeof hhf !== 'number' || !Number.isFinite(hhf)) continue
      const code = rawCode.trim()
      if (!code) continue
      let bucket = map.get(code)
      if (!bucket) {
        bucket = {}
        map.set(code, bucket)
      }
      bucket[division] = hhf
    }
  }
  return map
})()

// code (trimmed) -> name
const CLASSIFIER_NAMES: Map<string, string> = (() => {
  const file = classifierData as ClassifierFile
  const map = new Map<string, string>()
  for (const entry of file.classifiers ?? []) {
    const code = typeof entry.classifier === 'string' ? entry.classifier.trim() : ''
    const name = typeof entry.name === 'string' ? entry.name.trim() : ''
    if (code && name && !map.has(code)) map.set(code, name)
  }
  return map
})()

export function getHHF(
  code: string | null | undefined,
  division: Division | null | undefined,
): number | null {
  if (!code || !division) return null
  const trimmed = code.trim()
  if (!trimmed) return null
  const bucket = HHF_INDEX.get(trimmed)
  if (!bucket) return null
  return bucket[division] ?? null
}

export interface ActiveClassifier {
  code: string
  name: string
}

const ACTIVE_CLASSIFIERS: ActiveClassifier[] = (() => {
  const codes = [...HHF_INDEX.keys()].sort((a, b) => a.localeCompare(b))
  return codes.map((code) => ({
    code,
    name: CLASSIFIER_NAMES.get(code) ?? code,
  }))
})()

export function listActiveClassifiers(): ActiveClassifier[] {
  return ACTIVE_CLASSIFIERS
}
