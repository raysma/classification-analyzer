import { useMemo, useState, type FormEvent } from 'react'
import type { Division } from '../../types/index'
import { DivisionSchema } from '../../lib/validation'
import { formatDivision } from '../../lib/formatters'
import { listActiveClassifiers } from '../../lib/hhf'
import { classifyHF, type ClassificationResult } from '../../lib/calculator'
import { useAppStore } from '../../store/useAppStore'
import LetterPill from './LetterPill'
import type { Tab } from '../../lib/urlState'

interface Props {
  hasRecord: boolean
  onNavigate: (tab: Tab) => void
}

const DIVISIONS = DivisionSchema.options

// Local-calendar today as YYYY-MM-DD. Matches the format USPSA scores use
// (TZ-naive date strings).
function todayLocalISO(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export default function CalculatorPanel({ hasRecord, onNavigate }: Props) {
  const selectedDivision = useAppStore((s) => s.selectedDivision)
  const setSelectedDivision = useAppStore((s) => s.setSelectedDivision)
  const addHypothetical = useAppStore((s) => s.addHypothetical)
  const hypoCount = useAppStore((s) => s.hypotheticalScores.length)

  const classifiers = useMemo(() => listActiveClassifiers(), [])

  const [division, setDivision] = useState<Division>(selectedDivision ?? 'CarryOptics')
  const [code, setCode] = useState<string>(classifiers[0]?.code ?? '')
  const [hfInput, setHfInput] = useState<string>('')
  const [result, setResult] = useState<ClassificationResult | null>(null)
  const [resultDivision, setResultDivision] = useState<Division | null>(null)
  const [resultCode, setResultCode] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  function clearResult() {
    if (result !== null) setResult(null)
    if (resultDivision !== null) setResultDivision(null)
    if (resultCode !== null) setResultCode(null)
    if (error !== null) setError(null)
  }

  function handleCalculate(e?: FormEvent<HTMLFormElement>) {
    e?.preventDefault()
    const trimmed = hfInput.trim()
    if (!trimmed) {
      setResult(null)
      setResultDivision(null)
      setResultCode(null)
      setError('Enter a hit factor.')
      return
    }
    const n = Number(trimmed)
    if (!Number.isFinite(n) || n <= 0) {
      setResult(null)
      setResultDivision(null)
      setResultCode(null)
      setError('Hit factor must be a positive number.')
      return
    }
    const r = classifyHF(n, code, division)
    if (!r) {
      setResult(null)
      setResultDivision(null)
      setResultCode(null)
      setError(`No HHF on file for ${code} in ${formatDivision(division)}.`)
      return
    }
    setError(null)
    setResult(r)
    setResultDivision(division)
    setResultCode(code)
  }

  const scenarioFull = hypoCount >= 8
  const willResetScenario =
    hasRecord && hypoCount > 0 && resultDivision !== null && resultDivision !== selectedDivision

  const sendDisabledReason = (() => {
    if (!result || !resultDivision) return 'Calculate a percentage first.'
    if (!hasRecord) return 'Look up a shooter first to send hypotheticals to What-If.'
    if (scenarioFull) return 'What-If already has the maximum of 8 hypothetical scores.'
    return null
  })()

  function handleSend() {
    if (!result || !resultDivision || !resultCode || !hasRecord || scenarioFull) return
    setSelectedDivision(resultDivision)
    addHypothetical({
      id: `${Date.now()}-${Math.random()}`,
      percent: result.pct,
      date: todayLocalISO(),
      classifierCode: resultCode,
    })
    onNavigate('whatif')
  }

  return (
    <form
      onSubmit={handleCalculate}
      className="space-y-4 rounded-lg border border-gray-200 dark:border-gray-700 p-4"
    >
      <div className="space-y-1">
        <h2 className="text-base font-semibold">Classifier calculator</h2>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Enter a classifier hit factor to see the percentage and class letter,
          then optionally send it to What-If as a hypothetical score.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <label className="block space-y-1 min-w-0">
          <span className="block text-xs font-medium text-gray-600 dark:text-gray-400">
            Division
          </span>
          <select
            value={division}
            onChange={(e) => {
              setDivision(e.target.value as Division)
              clearResult()
            }}
            aria-label="Division"
            className="block w-full min-w-0 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-2 py-1 text-base sm:text-sm"
          >
            {DIVISIONS.map((d) => (
              <option key={d} value={d}>
                {formatDivision(d)}
              </option>
            ))}
          </select>
        </label>

        <label className="block space-y-1 min-w-0">
          <span className="block text-xs font-medium text-gray-600 dark:text-gray-400">
            Classifier
          </span>
          <select
            value={code}
            onChange={(e) => {
              setCode(e.target.value)
              clearResult()
            }}
            aria-label="Classifier"
            className="block w-full min-w-0 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-2 py-1 text-base sm:text-sm"
          >
            {classifiers.map((c) => (
              <option key={c.code} value={c.code}>
                {c.code} — {c.name}
              </option>
            ))}
          </select>
        </label>

        <label className="block space-y-1 min-w-0">
          <span className="block text-xs font-medium text-gray-600 dark:text-gray-400">
            Hit factor
          </span>
          <input
            type="number"
            inputMode="decimal"
            step="0.0001"
            min="0"
            value={hfInput}
            onChange={(e) => {
              setHfInput(e.target.value)
              clearResult()
            }}
            placeholder="e.g. 9.0749"
            aria-label="Hit factor"
            className="block w-full min-w-0 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-2 py-1 text-base sm:text-sm"
          />
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="submit"
          className="rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Calculate
        </button>
        <button
          type="button"
          onClick={handleSend}
          disabled={sendDisabledReason !== null}
          title={sendDisabledReason ?? undefined}
          className="rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Send to What-If
        </button>
        {sendDisabledReason && !error && (
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {sendDisabledReason}
          </p>
        )}
      </div>

      {error && (
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
      )}

      {result && resultDivision && (
        <div className="flex flex-wrap items-center gap-3 rounded-md bg-gray-50 dark:bg-gray-800 px-4 py-3">
          <LetterPill letter={result.letter} />
          <p className="text-xl font-bold tabular-nums">
            {result.pct.toFixed(4)}%
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            HHF {result.hhf.toFixed(4)} · {formatDivision(resultDivision)}
          </p>
        </div>
      )}

      {willResetScenario && resultDivision && (
        <p className="text-xs text-amber-700 dark:text-amber-400">
          Sending will switch the selected division to{' '}
          {formatDivision(resultDivision)}, which clears the existing What-If
          scenario.
        </p>
      )}
    </form>
  )
}
