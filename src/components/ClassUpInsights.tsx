import { useState, useMemo } from 'react'
import { requiredAverageForTarget } from '../lib/projection'
import { formatDivision } from '../lib/formatters'
import type { ValidatedClassifier } from '../lib/validation'
import type { ClassLetter } from '../types/index'

interface Props {
  classifiers: ValidatedClassifier[]
  division: string
  officialClass?: { letter: ClassLetter; percent: number; highPercent: number }
}

const TARGET_OPTIONS: ClassLetter[] = ['GM', 'M', 'A', 'B', 'C', 'D']

function colorForUp(pct: number | null, feasible: boolean): string {
  if (!feasible || pct === null) return 'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200'
  if (pct <= 100) return 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200'
  if (pct <= 110) return 'bg-amber-100 dark:bg-amber-900 text-amber-800 dark:text-amber-200'
  return 'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200'
}

function colorForDown(pct: number | null, feasible: boolean): string {
  if (!feasible || pct === null) return 'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200'
  // For going down: any feasible result is fine. Lower max = harder = use a
  // gentler shade. Doesn't need green/amber/red since "shooting badly" is
  // always achievable below the ceiling.
  return 'bg-indigo-100 dark:bg-indigo-900 text-indigo-800 dark:text-indigo-200'
}

export default function ClassUpInsights({ classifiers, division, officialClass }: Props) {
  const [selectedTarget, setSelectedTarget] = useState<ClassLetter | null>(null)

  const results = useMemo(
    () =>
      [1, 2, 3, 4, 5].map((k) => ({
        k,
        ...requiredAverageForTarget(
          classifiers,
          k,
          selectedTarget ?? undefined,
          officialClass?.letter,
        ),
      })),
    [classifiers, selectedTarget, officialClass?.letter],
  )

  const first = results[0]
  if (!first) return null

  // Only celebrate when actually classified GM and no override picked
  if (first.atTop && !selectedTarget) {
    return (
      <div className="space-y-2">
        <div className="rounded-lg border border-yellow-200 dark:border-yellow-800 bg-yellow-50 dark:bg-yellow-950 p-4 text-sm text-yellow-800 dark:text-yellow-200">
          Congratulations — you&apos;re Grand Master in {formatDivision(division)}! That&apos;s the top class.
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Curious how poorly you&apos;d have to shoot to drop down?{' '}
          <button
            type="button"
            onClick={() => setSelectedTarget('M')}
            className="underline hover:text-gray-700 dark:hover:text-gray-200"
          >
            Pick a class
          </button>{' '}
          to find out.
        </p>
      </div>
    )
  }

  // Insufficient scores edge case
  if (first.requiredPercent === null && first.direction !== 'at-top') {
    const needed = Math.max(0, 4 - (first.scoresInWindow ?? 0))
    return (
      <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-4 text-sm text-gray-600 dark:text-gray-400">
        {needed > 0
          ? `Need ${needed} more classifier${needed !== 1 ? 's' : ''} in ${formatDivision(division)} before class-up math applies.`
          : 'Not enough scores to project class-up yet.'}
      </div>
    )
  }

  const effectiveTarget = first.targetClass
  const isDown = first.direction === 'down'
  const colorFn = isDown ? colorForDown : colorForUp

  return (
    <div className="space-y-2">
      <div className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2 flex-wrap">
        <span>Journey to</span>
        <select
          value={effectiveTarget}
          onChange={(e) => setSelectedTarget(e.target.value as ClassLetter)}
          className="rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-2 py-0.5 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
          aria-label="Target classification"
        >
          {TARGET_OPTIONS.map((cls) => (
            <option key={cls} value={cls}>
              {cls}
            </option>
          ))}
        </select>
        <span>class — {isDown ? 'maximum allowed' : 'required'} average</span>
      </div>
      <div className="grid grid-cols-5 gap-1.5 sm:gap-2">
        {results.map(({ k, requiredPercent, feasible }) => (
          <div
            key={k}
            className={`rounded-lg p-2 sm:p-3 text-center ${colorFn(feasible ? requiredPercent : null, feasible)}`}
          >
            <p className="text-xs font-medium mb-1 leading-tight">
              +{k}<span className="hidden sm:inline"> classifier{k !== 1 ? 's' : ''}</span>
            </p>
            {feasible && requiredPercent !== null ? (
              <p className="text-sm sm:text-lg font-bold tabular-nums">
                {isDown && '≤'}
                {requiredPercent.toFixed(1)}%
              </p>
            ) : (
              <p className="text-sm sm:text-lg font-bold">—</p>
            )}
          </div>
        ))}
      </div>
      <p className="text-xs text-gray-400 dark:text-gray-500">
        {isDown
          ? `Maximum average per classifier across the next N to drop into ${effectiveTarget} class.`
          : 'Assumes uniform average on each of the next N classifiers. Green ≤100%, amber ≤110%, red >110% (not feasible).'}
      </p>
    </div>
  )
}
