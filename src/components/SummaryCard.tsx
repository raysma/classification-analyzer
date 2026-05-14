import { classFor, nextClassThreshold } from '../lib/rules'
import { formatDivision } from '../lib/formatters'
import type { ClassLetter } from '../types/index'

const CLASS_COLORS: Record<ClassLetter, string> = {
  GM: 'bg-yellow-400 text-yellow-900',
  M: 'bg-purple-500 text-white',
  A: 'bg-blue-500 text-white',
  B: 'bg-green-500 text-white',
  C: 'bg-orange-400 text-white',
  D: 'bg-red-400 text-white',
  U: 'bg-gray-300 text-gray-700',
}

interface Props {
  currentPercent: number | null
  windowSize: number
  division: string
  allTimeHighPercent?: number
}

export default function SummaryCard({ currentPercent, windowSize, division, allTimeHighPercent }: Props) {
  const letter = currentPercent !== null ? classFor(currentPercent) : 'U'
  const threshold = nextClassThreshold(letter)
  const gap = threshold !== null && currentPercent !== null ? threshold - currentPercent : null

  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-4 flex flex-col gap-3">
      <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
        {formatDivision(division)} — Current classification
      </p>

      {currentPercent !== null ? (
        <div className="flex items-center gap-4">
          <span
            className={`inline-flex items-center justify-center w-16 h-16 rounded-full text-2xl font-bold ${CLASS_COLORS[letter]}`}
            aria-label={`Class ${letter}`}
          >
            {letter}
          </span>
          <div>
            <p className="text-3xl font-bold tabular-nums">{currentPercent.toFixed(2)}%</p>
            {gap !== null && gap > 0 && (
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {gap.toFixed(2)}% to {classFor(threshold!)} ({threshold}% threshold)
              </p>
            )}
            {allTimeHighPercent !== undefined && (
              <p className="text-sm text-gray-500 dark:text-gray-400">
                All-time high:{' '}
                <span className="font-medium text-gray-700 dark:text-gray-300">
                  {allTimeHighPercent.toFixed(2)}%
                </span>
              </p>
            )}
            {letter === 'GM' && (
              <p className="text-sm text-yellow-600 dark:text-yellow-400 font-medium">
                Grand Master — top class!
              </p>
            )}
          </div>
        </div>
      ) : (
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {windowSize < 4
            ? `${windowSize} of 4 scores needed — add ${4 - windowSize} more to get an initial classification.`
            : 'No classification yet.'}
        </p>
      )}

      <p className="text-xs text-gray-400 dark:text-gray-500">
        {windowSize} score{windowSize !== 1 ? 's' : ''} in window
      </p>
    </div>
  )
}
