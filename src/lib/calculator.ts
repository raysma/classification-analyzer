import type { ClassLetter, Division } from '../types/index'
import { classFor } from './rules'
import { getHHF } from './hhf'

export const CLASSIFIER_PCT_CAP = 110

export interface ClassificationResult {
  pct: number
  letter: ClassLetter
  hhf: number
}

export function classifyHF(
  hf: number | null | undefined,
  code: string | null | undefined,
  division: Division | null | undefined,
): ClassificationResult | null {
  if (typeof hf !== 'number' || !Number.isFinite(hf) || hf <= 0) return null
  const hhf = getHHF(code, division)
  if (hhf === null || hhf <= 0) return null
  const raw = (hf / hhf) * 100
  const pct = Math.min(CLASSIFIER_PCT_CAP, raw)
  return { pct, letter: classFor(pct), hhf }
}
