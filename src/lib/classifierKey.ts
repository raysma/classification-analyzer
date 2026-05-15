import type { ValidatedClassifier } from './validation'

export function classifierKey(c: ValidatedClassifier): string {
  return `${c.date}:${c.classifierCode}:${c.percent}`
}
