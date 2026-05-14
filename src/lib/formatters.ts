import type { Division } from '../types/index'

export function formatDivision(division: Division | string): string {
  return division
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/([a-zA-Z])(\d)/g, '$1 $2')
}
