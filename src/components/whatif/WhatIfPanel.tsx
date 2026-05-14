import { useAppStore } from '../../store/useAppStore'
import HypotheticalScoreForm from './HypotheticalScoreForm'
import { getCurrentWindow, classFor, bestSixOfRecentEight } from '../../lib/rules'
import { formatDivision } from '../../lib/formatters'
import type { ValidatedClassifier } from '../../lib/validation'

interface Props {
  windowScores: ValidatedClassifier[]
  currentPercent: number | null
  division: string
}

export default function WhatIfPanel({ windowScores, currentPercent, division }: Props) {
  const { hypotheticalScores, removeHypothetical, resetScenario, buildScenarioScores } =
    useAppStore()

  const scenarioScores = buildScenarioScores(windowScores)
  const scenarioWindow = getCurrentWindow(scenarioScores)
  const scenarioWindowScores = scenarioWindow.getScores()
  const { included: scenIncluded, dropped: scenDropped } = bestSixOfRecentEight(scenarioWindowScores)
  const scenIncludedIds = new Set(scenIncluded.map((s) => `${s.date}:${s.classifierCode}`))
  const scenDroppedIds = new Set(scenDropped.map((s) => `${s.date}:${s.classifierCode}`))

  const scenarioPct = scenarioWindow.classificationScore()
  const scenarioClass = scenarioPct !== null ? classFor(scenarioPct) : null
  const delta =
    currentPercent !== null && scenarioPct !== null ? scenarioPct - currentPercent : null

  // Map hypo classifierCode → h.id for the remove button
  const hypoCodeToId = new Map(hypotheticalScores.map((h) => [`hypo-${h.id}`, h.id]))
  const hypoCodeSet = new Set(hypoCodeToId.keys())

  // Real scores that got pushed out of the window because hypotheticals took their spots
  const scenWindowIds = new Set(scenarioWindowScores.map((s) => `${s.date}:${s.classifierCode}`))
  const pushedOut = windowScores.filter(
    (s) => !scenWindowIds.has(`${s.date}:${s.classifierCode}`),
  )

  // Display order: hypotheticals first (newest), then real scores newest-to-oldest
  const displayScores = [...scenarioWindowScores].sort((a, b) => {
    const dateCmp = b.date.localeCompare(a.date)
    return dateCmp !== 0 ? dateCmp : b.percent - a.percent
  })

  const hasChanges = hypotheticalScores.length > 0

  return (
    <div className="space-y-4 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">
          What-if simulator — {formatDivision(division)}
        </h3>
        {hasChanges && (
          <button
            type="button"
            onClick={resetScenario}
            className="text-xs text-gray-500 dark:text-gray-400 underline hover:text-gray-700 dark:hover:text-gray-200"
          >
            Reset
          </button>
        )}
      </div>

      {/* Projected result */}
      <div className="flex items-center gap-4 rounded-md bg-gray-50 dark:bg-gray-800 px-4 py-3">
        <div>
          <p className="text-xs text-gray-500 dark:text-gray-400">Projected</p>
          {scenarioPct !== null ? (
            <p className="text-xl font-bold tabular-nums">
              {scenarioPct.toFixed(4)}%{' '}
              <span className="text-sm font-medium text-gray-500 dark:text-gray-400">
                ({scenarioClass})
              </span>
            </p>
          ) : (
            <p className="text-sm text-gray-400">Not enough scores</p>
          )}
        </div>
        {delta !== null && (
          <div
            className={`text-sm font-medium ${delta >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}
          >
            {delta >= 0 ? '+' : ''}
            {delta.toFixed(4)}%
          </div>
        )}
        <div className="ml-auto text-xs text-gray-400">
          vs actual {currentPercent !== null ? `${currentPercent.toFixed(4)}%` : '—'}
        </div>
      </div>

      {/* Window scores with Y/F labels */}
      <div className="space-y-1">
        <p className="text-xs font-medium text-gray-600 dark:text-gray-400">
          {hasChanges ? 'Projected window' : 'Current window'} — 8 most recent, best 6 used
        </p>

        {displayScores.length === 0 && (
          <p className="text-xs text-gray-400">No scores in window.</p>
        )}

        {displayScores.map((s) => {
          const id = `${s.date}:${s.classifierCode}`
          const isHypo = hypoCodeSet.has(s.classifierCode)
          const isIncluded = scenIncludedIds.has(id)
          const isDropped = scenDroppedIds.has(id)
          const hypoId = hypoCodeToId.get(s.classifierCode)

          return (
            <div key={id} className="flex items-center gap-2 text-xs px-1 py-0.5">
              <span
                className={`w-4 shrink-0 font-semibold text-center ${
                  isIncluded
                    ? 'text-green-600 dark:text-green-400'
                    : isDropped
                      ? 'text-amber-500 dark:text-amber-400'
                      : 'text-gray-400'
                }`}
              >
                {isIncluded ? 'Y' : isDropped ? 'F' : ''}
              </span>
              <span
                className={
                  isHypo
                    ? 'text-indigo-600 dark:text-indigo-400'
                    : isDropped
                      ? 'text-gray-400 dark:text-gray-500'
                      : 'text-gray-700 dark:text-gray-300'
                }
              >
                {isHypo ? 'Hypothetical' : s.date}
                {!isHypo && ` · ${s.classifierCode}`} · {s.percent.toFixed(4)}%
              </span>
              {isHypo && hypoId && (
                <button
                  type="button"
                  onClick={() => removeHypothetical(hypoId)}
                  aria-label={`Remove hypothetical ${s.percent.toFixed(4)}%`}
                  className="ml-auto text-gray-400 hover:text-red-500"
                >
                  ×
                </button>
              )}
            </div>
          )
        })}

        {/* Scores pushed out of the window by hypotheticals */}
        {pushedOut.map((s) => (
          <div
            key={`out-${s.date}:${s.classifierCode}`}
            className="flex items-center gap-2 text-xs px-1 py-0.5 opacity-40"
          >
            <span className="w-4 shrink-0 text-center text-gray-400">E</span>
            <span className="line-through">
              {s.date} · {s.classifierCode} · {s.percent.toFixed(4)}%
            </span>
          </div>
        ))}
      </div>

      <HypotheticalScoreForm />
    </div>
  )
}
