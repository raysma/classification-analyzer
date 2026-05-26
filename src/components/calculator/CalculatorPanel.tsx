import { useMemo, useState } from 'react'
import type { Division } from '../../types/index'
import { DivisionSchema } from '../../lib/validation'
import { formatDivision } from '../../lib/formatters'
import { listActiveClassifiers } from '../../lib/hhf'
import { classifyHF } from '../../lib/calculator'
import { useAppStore } from '../../store/useAppStore'
import LetterPill from './LetterPill'
import type { Tab } from '../../lib/urlState'

interface Props {
  hasRecord: boolean
  onNavigate: (tab: Tab) => void
}

const DIVISIONS = DivisionSchema.options

export default function CalculatorPanel({ hasRecord, onNavigate }: Props) {
  const selectedDivision = useAppStore((s) => s.selectedDivision)
  const setSelectedDivision = useAppStore((s) => s.setSelectedDivision)
  const addHypothetical = useAppStore((s) => s.addHypothetical)
  const hypoCount = useAppStore((s) => s.hypotheticalScores.length)

  const classifiers = useMemo(() => listActiveClassifiers(), [])

  const [division, setDivision] = useState<Division>(selectedDivision ?? 'CarryOptics')
  const [code, setCode] = useState<string>(classifiers[0]?.code ?? '')
  const [hfInput, setHfInput] = useState<string>('')

  const hfValue = (() => {
    const trimmed = hfInput.trim()
    if (!trimmed) return null
    const n = Number(trimmed)
    return Number.isFinite(n) ? n : null
  })()

  const result = classifyHF(hfValue, code, division)
  const scenarioFull = hypoCount >= 8
  const willResetScenario = hasRecord && hypoCount > 0 && division !== selectedDivision

  const sendDisabledReason = (() => {
    if (!result) return 'Enter a hit factor to compute a percentage first.'
    if (!hasRecord) return 'Look up a shooter first to send hypotheticals to What-If.'
    if (scenarioFull) return 'What-If already has the maximum of 8 hypothetical scores.'
    return null
  })()

  function handleSend() {
    if (!result || !hasRecord || scenarioFull) return
    setSelectedDivision(division)
    addHypothetical({
      id: `${Date.now()}-${Math.random()}`,
      percent: result.pct,
    })
    onNavigate('whatif')
  }

  return (
    <div className="space-y-4 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
      <div className="space-y-1">
        <h2 className="text-base font-semibold">Classifier calculator</h2>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Enter a classifier hit factor to see the percentage and class letter,
          then optionally send it to What-If as a hypothetical score.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <label className="space-y-1">
          <span className="block text-xs font-medium text-gray-600 dark:text-gray-400">
            Division
          </span>
          <select
            value={division}
            onChange={(e) => setDivision(e.target.value as Division)}
            aria-label="Division"
            className="w-full rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-2 py-1 text-base sm:text-sm"
          >
            {DIVISIONS.map((d) => (
              <option key={d} value={d}>
                {formatDivision(d)}
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-1 sm:col-span-1">
          <span className="block text-xs font-medium text-gray-600 dark:text-gray-400">
            Classifier
          </span>
          <select
            value={code}
            onChange={(e) => setCode(e.target.value)}
            aria-label="Classifier"
            className="w-full rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-2 py-1 text-base sm:text-sm"
          >
            {classifiers.map((c) => (
              <option key={c.code} value={c.code}>
                {c.code} — {c.name}
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-1">
          <span className="block text-xs font-medium text-gray-600 dark:text-gray-400">
            Hit factor
          </span>
          <input
            type="number"
            inputMode="decimal"
            step="0.0001"
            min="0"
            value={hfInput}
            onChange={(e) => setHfInput(e.target.value)}
            placeholder="e.g. 9.0749"
            aria-label="Hit factor"
            className="w-full rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-2 py-1 text-base sm:text-sm"
          />
        </label>
      </div>

      {result ? (
        <div className="flex flex-wrap items-center gap-3 rounded-md bg-gray-50 dark:bg-gray-800 px-4 py-3">
          <LetterPill letter={result.letter} />
          <p className="text-xl font-bold tabular-nums">
            {result.pct.toFixed(4)}%
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            HHF {result.hhf.toFixed(4)} · {formatDivision(division)}
          </p>
        </div>
      ) : hfInput.trim() ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Enter a positive hit factor for an active classifier to see a result.
        </p>
      ) : null}

      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleSend}
            disabled={sendDisabledReason !== null}
            title={sendDisabledReason ?? undefined}
            className="rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Send to What-If
          </button>
          {sendDisabledReason && (
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {sendDisabledReason}
            </p>
          )}
        </div>
        {willResetScenario && (
          <p className="text-xs text-amber-700 dark:text-amber-400">
            Sending will switch the selected division to {formatDivision(division)},
            which clears the existing What-If scenario.
          </p>
        )}
      </div>
    </div>
  )
}
