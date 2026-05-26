import { useAppStore } from '../../store/useAppStore'
import HypotheticalScoreForm from './HypotheticalScoreForm'
import { getCurrentWindow, classFor, bestSixOfRecentEight } from '../../lib/rules'
import { classifierKey } from '../../lib/classifierKey'
import type { ValidatedClassifier } from '../../lib/validation'

interface Props {
  windowScores: ValidatedClassifier[]
  currentPercent: number | null
}

export default function WhatIfPanel({ windowScores, currentPercent }: Props) {
  const { hypotheticalScores, removeHypothetical, buildScenarioScores } = useAppStore()

  const scenarioScores = buildScenarioScores(windowScores)
  const scenarioWindow = getCurrentWindow(scenarioScores)
  const scenarioWindowScores = scenarioWindow.getScores()
  const { included: scenIncluded, dropped: scenDropped } = bestSixOfRecentEight(scenarioWindowScores)
  const scenIncludedIds = new Set(scenIncluded.map(classifierKey))
  const scenDroppedIds = new Set(scenDropped.map(classifierKey))

  const scenarioPct = scenarioWindow.classificationScore()
  const scenarioClass = scenarioPct !== null ? classFor(scenarioPct) : null
  const delta =
    currentPercent !== null && scenarioPct !== null ? scenarioPct - currentPercent : null

  // Map full classifierKey → hypothetical, so the remove button finds the
  // right entry and the row knows whether to render "Hypothetical" or the
  // real date + code (calculator-sent rows carry real values).
  const hypoByKey = new Map(
    hypotheticalScores.map((h, i) => {
      const date = h.date ?? `9999-${String(i + 1).padStart(2, '0')}-01`
      const code = h.classifierCode ?? `hypo-${h.id}`
      const key = `${date}:${code}:${h.percent}`
      return [key, h]
    }),
  )

  // Display order: hypotheticals first (newest), then real scores newest-to-oldest
  const displayScores = [...scenarioWindowScores].sort((a, b) => {
    const dateCmp = b.date.localeCompare(a.date)
    return dateCmp !== 0 ? dateCmp : b.percent - a.percent
  })

  const hasChanges = hypotheticalScores.length > 0

  return (
    <div className="space-y-4 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
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
          const id = classifierKey(s)
          const hypo = hypoByKey.get(id)
          const isHypo = hypo !== undefined
          const isCalcHypo = isHypo && hypo.date !== undefined && hypo.classifierCode !== undefined
          const isIncluded = scenIncludedIds.has(id)
          const isDropped = scenDroppedIds.has(id)

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
                {isHypo && !isCalcHypo
                  ? `Hypothetical · ${s.percent.toFixed(4)}%`
                  : `${s.date} · ${s.classifierCode} · ${s.percent.toFixed(4)}%`}
              </span>
              {isHypo && hypo && (
                <button
                  type="button"
                  onClick={() => removeHypothetical(hypo.id)}
                  aria-label={`Remove hypothetical ${s.percent.toFixed(4)}%`}
                  className="ml-auto text-gray-400 hover:text-red-500"
                >
                  ×
                </button>
              )}
            </div>
          )
        })}
      </div>

      <HypotheticalScoreForm />
    </div>
  )
}
