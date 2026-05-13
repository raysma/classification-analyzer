import { useAppStore } from '../../store/useAppStore'
import HypotheticalScoreForm from './HypotheticalScoreForm'
import { getCurrentWindow, classFor } from '../../lib/rules'
import type { ValidatedClassifier } from '../../lib/validation'

interface Props {
  windowScores: ValidatedClassifier[]
  currentPercent: number | null
  division: string
}

export default function WhatIfPanel({ windowScores, currentPercent, division }: Props) {
  const {
    excludedExistingIds,
    hypotheticalScores,
    toggleExcluded,
    removeHypothetical,
    resetScenario,
    buildScenarioScores,
  } = useAppStore()

  const scenarioScores = buildScenarioScores(windowScores)
  const scenarioWindow = getCurrentWindow(scenarioScores)
  const scenarioPct = scenarioWindow.classificationScore()
  const scenarioClass = scenarioPct !== null ? classFor(scenarioPct) : null

  const delta =
    currentPercent !== null && scenarioPct !== null
      ? scenarioPct - currentPercent
      : null

  const excludedSet = new Set(excludedExistingIds)

  const hasChanges = excludedExistingIds.length > 0 || hypotheticalScores.length > 0

  return (
    <div className="space-y-4 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">
          What-if simulator — {division}
        </h3>
        {hasChanges && (
          <button
            type="button"
            onClick={resetScenario}
            className="text-xs text-gray-500 dark:text-gray-400 underline hover:text-gray-700"
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
              {scenarioPct.toFixed(2)}%{' '}
              <span className="text-sm font-medium text-gray-500">({scenarioClass})</span>
            </p>
          ) : (
            <p className="text-sm text-gray-400">Not enough scores</p>
          )}
        </div>
        {delta !== null && (
          <div className={`text-sm font-medium ${delta >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
            {delta >= 0 ? '+' : ''}{delta.toFixed(2)}%
          </div>
        )}
        <div className="ml-auto text-xs text-gray-400">
          vs actual {currentPercent !== null ? `${currentPercent.toFixed(2)}%` : '—'}
        </div>
      </div>

      {/* In-window scores with toggle checkboxes */}
      <div className="space-y-1">
        <p className="text-xs font-medium text-gray-600 dark:text-gray-400">
          Current window scores (uncheck to exclude)
        </p>
        {windowScores.length === 0 && (
          <p className="text-xs text-gray-400">No scores in window.</p>
        )}
        {windowScores.map((s) => {
          const id = `${s.date}:${s.classifierCode}`
          const isExcluded = excludedSet.has(id)
          return (
            <label
              key={id}
              className="flex items-center gap-2 text-xs cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 px-1 py-0.5 rounded"
            >
              <input
                type="checkbox"
                checked={!isExcluded}
                onChange={() => toggleExcluded(id)}
                className="rounded"
                aria-label={`Include ${s.date} ${s.classifierCode} (${s.percent.toFixed(2)}%)`}
              />
              <span className={isExcluded ? 'line-through text-gray-400' : ''}>
                {s.date} · {s.classifierCode} · {s.percent.toFixed(2)}%
              </span>
            </label>
          )
        })}
      </div>

      {/* Hypothetical scores */}
      <div className="space-y-2">
        {hypotheticalScores.length > 0 && (
          <div className="space-y-1">
            <p className="text-xs font-medium text-gray-600 dark:text-gray-400">
              Hypothetical scores
            </p>
            {hypotheticalScores.map((h) => (
              <div
                key={h.id}
                className="flex items-center gap-2 text-xs px-1 py-0.5"
              >
                <span className="text-indigo-600 dark:text-indigo-400">
                  Hypothetical · {h.percent.toFixed(2)}%
                </span>
                <button
                  type="button"
                  onClick={() => removeHypothetical(h.id)}
                  aria-label={`Remove hypothetical ${h.percent}%`}
                  className="text-gray-400 hover:text-red-500"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
        <HypotheticalScoreForm />
      </div>
    </div>
  )
}
