import { requiredAverageToClassUp } from '../lib/projection'
import { formatDivision } from '../lib/formatters'
import type { ValidatedClassifier } from '../lib/validation'

interface Props {
  classifiers: ValidatedClassifier[]
  division: string
}

function colorForPercent(pct: number | null): string {
  if (pct === null) return 'bg-gray-100 dark:bg-gray-800 text-gray-500'
  if (pct <= 100) return 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200'
  if (pct <= 110) return 'bg-amber-100 dark:bg-amber-900 text-amber-800 dark:text-amber-200'
  return 'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200'
}

export default function ClassUpInsights({ classifiers, division }: Props) {
  const results = [1, 2, 3, 4, 5].map((k) => ({
    k,
    ...requiredAverageToClassUp(classifiers, k),
  }))

  const first = results[0]
  if (!first) return null

  if (first.targetClass === 'GM' && !first.feasible) {
    return (
      <div className="rounded-lg border border-yellow-200 dark:border-yellow-800 bg-yellow-50 dark:bg-yellow-950 p-4 text-sm text-yellow-800 dark:text-yellow-200">
        Congratulations — you&apos;re Grand Master in {formatDivision(division)}! That&apos;s the top class.
      </div>
    )
  }

  if (first.minAvgPercent === null) {
    const needed = Math.max(0, 4 - (first.scoresInWindow ?? 0))
    return (
      <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-4 text-sm text-gray-600 dark:text-gray-400">
        {needed > 0
          ? `Need ${needed} more classifier${needed !== 1 ? 's' : ''} in ${formatDivision(division)} before class-up math applies.`
          : 'Not enough scores to project class-up yet.'}
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
        Class-up to {first.targetClass} ({first.targetThreshold}% threshold) — required average
      </p>
      <div className="grid grid-cols-5 gap-2">
        {results.map(({ k, minAvgPercent, feasible }) => (
          <div
            key={k}
            className={`rounded-lg p-3 text-center ${colorForPercent(feasible ? minAvgPercent : 111)}`}
          >
            <p className="text-xs font-medium mb-1">+{k} classifier{k !== 1 ? 's' : ''}</p>
            {feasible && minAvgPercent !== null ? (
              <p className="text-lg font-bold tabular-nums">{minAvgPercent.toFixed(1)}%</p>
            ) : (
              <p className="text-lg font-bold">—</p>
            )}
          </div>
        ))}
      </div>
      <p className="text-xs text-gray-400 dark:text-gray-500">
        Assumes uniform average on each of the next N classifiers. Green ≤100%, amber ≤110%, red
        &gt;110% (not feasible).
      </p>
    </div>
  )
}
