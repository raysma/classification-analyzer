import { useState } from 'react'
import type { Flag, ClassLetter } from '../types/index'
import type { ValidatedClassifier } from '../lib/validation'
import { classFor } from '../lib/rules'

const FLAG_DESCRIPTIONS: Record<Flag, string> = {
  S: 'Same-Day Average — multiple attempts on the same day are averaged into one',
  M: 'Most Recent Override — an earlier attempt at the same classifier was superseded',
  E: 'Outside the most-recent-8 window',
  F: 'Dropped (one of the lower scores not used in the average)',
  A: 'Invalidated — score was >20% above current class',
  I: 'Excluded — administrative',
  X: 'Excluded — expired',
  Y: 'Included in current calculated average',
  P: 'Pending — will be counted after the next weekly processing run',
  Q: 'Excluded — disqualification',
  N: 'Excluded — did not finish',
  B: 'Retired flag (pre-April 2025)',
  C: 'Retired flag (pre-April 2025)',
  D: 'Retired flag (pre-April 2025)',
  G: 'Retired flag (pre-April 2025)',
  '': '',
}

const FLAG_CLASSES: Record<Flag, string> = {
  Y: 'text-green-700 dark:text-green-400',
  F: 'text-amber-600 dark:text-amber-400',
  E: 'text-gray-400',
  M: 'text-blue-600 dark:text-blue-400',
  S: 'text-blue-600 dark:text-blue-400',
  A: 'text-red-600 dark:text-red-400',
  I: 'text-red-600 dark:text-red-400',
  X: 'text-red-600 dark:text-red-400',
  Q: 'text-red-600 dark:text-red-400',
  N: 'text-red-600 dark:text-red-400',
  P: 'text-purple-600 dark:text-purple-400',
  B: 'text-gray-400',
  C: 'text-gray-400',
  D: 'text-gray-400',
  G: 'text-gray-400',
  '': '',
}

const PERCENT_COLORS: Record<ClassLetter, string> = {
  GM: 'text-yellow-500 dark:text-yellow-400',
  M:  'text-purple-500 dark:text-purple-400',
  A:  'text-blue-500 dark:text-blue-400',
  B:  'text-green-500 dark:text-green-400',
  C:  'text-orange-400 dark:text-orange-300',
  D:  'text-red-400 dark:text-red-300',
  U:  'text-gray-400',
}

type SortKey = 'date' | 'percent' | 'hitFactor'
type SortDir = 'asc' | 'desc'

interface Props {
  classifiers: ValidatedClassifier[]
  highlightedIds?: Set<string>
  droppedIds?: Set<string>
  excludedIds?: Set<string>
}

function classifierRowId(c: ValidatedClassifier): string {
  return `${c.date}:${c.classifierCode}`
}

export default function ClassifierTable({
  classifiers,
  highlightedIds,
  droppedIds,
  excludedIds,
}: Props) {
  const [sortKey, setSortKey] = useState<SortKey>('date')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir('desc')
    }
  }

  const sorted = [...classifiers].sort((a: ValidatedClassifier, b: ValidatedClassifier) => {
    let cmp = 0
    if (sortKey === 'date') {
      cmp = a.date.localeCompare(b.date)
    } else if (sortKey === 'percent') {
      cmp = a.percent - b.percent
    } else if (sortKey === 'hitFactor') {
      cmp = (a.hitFactor ?? 0) - (b.hitFactor ?? 0)
    }
    return sortDir === 'asc' ? cmp : -cmp
  })

  function sortIndicator(key: SortKey) {
    if (sortKey !== key) return null
    return sortDir === 'asc' ? ' ↑' : ' ↓'
  }

  function rowBg(c: ValidatedClassifier): string {
    const id = classifierRowId(c)
    if (excludedIds?.has(id)) return 'opacity-40'
    if (highlightedIds?.has(id)) return 'bg-green-50 dark:bg-green-950'
    if (droppedIds?.has(id)) return 'bg-amber-50 dark:bg-amber-950'
    return ''
  }

  return (
    <div className="overflow-x-auto rounded-md border border-gray-200 dark:border-gray-700">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-400 text-left">
          <tr>
            <th
              className="px-3 py-2 font-medium cursor-pointer hover:text-gray-900 dark:hover:text-gray-100 whitespace-nowrap"
              onClick={() => toggleSort('date')}
            >
              Date{sortIndicator('date')}
            </th>
            <th className="px-3 py-2 font-medium whitespace-nowrap">Code</th>
            <th className="px-3 py-2 font-medium">Classifier</th>
            <th
              className="px-3 py-2 font-medium cursor-pointer hover:text-gray-900 dark:hover:text-gray-100 whitespace-nowrap"
              onClick={() => toggleSort('hitFactor')}
            >
              HF{sortIndicator('hitFactor')}
            </th>
            <th
              className="px-3 py-2 font-medium cursor-pointer hover:text-gray-900 dark:hover:text-gray-100 whitespace-nowrap"
              onClick={() => toggleSort('percent')}
            >
              %{sortIndicator('percent')}
            </th>
            <th className="px-3 py-2 font-medium">Flag</th>
            <th className="px-3 py-2 font-medium">Source</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
          {sorted.map((c) => {
            const desc = FLAG_DESCRIPTIONS[c.flag]
            return (
              <tr key={classifierRowId(c)} className={`transition-colors ${rowBg(c)}`}>
                <td className="px-3 py-2 whitespace-nowrap font-mono text-xs">{c.date}</td>
                <td className="px-3 py-2 whitespace-nowrap font-mono text-xs">{c.classifierCode}</td>
                <td className="px-3 py-2 text-gray-700 dark:text-gray-300">
                  {c.classifierName ?? <span className="text-gray-400">—</span>}
                  {c.matchName && (
                    <span className="ml-1 text-xs text-gray-400">({c.matchName})</span>
                  )}
                </td>
                <td className="px-3 py-2 whitespace-nowrap font-mono text-xs">
                  {c.hitFactor !== undefined ? c.hitFactor.toFixed(4) : '—'}
                </td>
                <td className={`px-3 py-2 whitespace-nowrap font-mono font-medium ${PERCENT_COLORS[classFor(c.percent)]}`}>
                  {c.percent.toFixed(4)}%
                </td>
                <td className="px-3 py-2">
                  {c.flag ? (
                    <span
                      className={`font-medium ${FLAG_CLASSES[c.flag]}`}
                      title={desc}
                      aria-label={desc || undefined}
                    >
                      {c.flag}
                    </span>
                  ) : (
                    <span className="text-gray-400">—</span>
                  )}
                </td>
                <td className="px-3 py-2 text-xs text-gray-500 dark:text-gray-400">
                  {c.source === 'majorMatch' ? (
                    <span className="text-purple-600 dark:text-purple-400 font-medium">Major Match</span>
                  ) : (
                    'Club'
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
