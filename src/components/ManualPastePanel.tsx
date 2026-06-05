import { useState } from 'react'
import { parsePastedTable } from '../lib/textParser'
import { useAppStore } from '../store/useAppStore'
import type { Division } from '../types/index'
import type { ValidatedShooterRecord } from '../lib/validation'
import { DivisionSchema } from '../lib/validation'
import { formatDivision } from '../lib/formatters'

const DIVISIONS = DivisionSchema.options

export default function ManualPastePanel() {
  const { pastedRecord, setPastedRecord } = useAppStore()
  const [isOpen, setIsOpen] = useState(false)
  const [division, setDivision] = useState<Division>('CarryOptics')
  const [text, setText] = useState('')
  const [status, setStatus] = useState<string | null>(null)
  const [isError, setIsError] = useState(false)

  function handleProcess() {
    setStatus(null)
    const result = parsePastedTable(text, division)
    if (!result.ok) {
      setIsError(true)
      setStatus(`Could not parse any rows. Make sure you pasted the classifier table from USPSA.`)
      return
    }

    const now = new Date().toISOString()
    const base: ValidatedShooterRecord = pastedRecord ?? {
      memberNumber: '',
      name: 'Pasted record',
      membershipType: 'Unknown',
      currentClasses: {},
      classifiers: {},
      fetchedAt: now,
      source: 'paste',
    }

    const updated: ValidatedShooterRecord = {
      ...base,
      classifiers: {
        ...base.classifiers,
        [division]: result.classifiers,
      },
    }

    setPastedRecord(updated)
    setIsError(false)
    setStatus(
      `Parsed ${result.parsedRows} row${result.parsedRows !== 1 ? 's' : ''}` +
        (result.skippedRows > 0 ? `, skipped ${result.skippedRows}` : '') +
        `. Division ${formatDivision(division)} added to record.`,
    )
    setText('')
  }

  function handleReset() {
    setPastedRecord(null)
    setStatus(null)
    setText('')
  }

  return (
    <div className="rounded-md border border-gray-200 dark:border-gray-700">
      <button
        type="button"
        onClick={() => setIsOpen((o) => !o)}
        aria-expanded={isOpen}
        className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-md"
      >
        <span>Paste classifier data manually</span>
        <span aria-hidden="true">{isOpen ? '▲' : '▼'}</span>
      </button>

      {isOpen && (
        <div className="px-4 pb-4 space-y-3 border-t border-gray-200 dark:border-gray-700 pt-3">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Open your USPSA classification page, select and copy the classifier table for one
            division, then paste it below. Select the division before pasting.
          </p>

          <div className="flex gap-3 flex-wrap">
            <div className="flex flex-col gap-1">
              <label
                htmlFor="paste-division"
                className="text-xs font-medium text-gray-600 dark:text-gray-400"
              >
                Division
              </label>
              <select
                id="paste-division"
                value={division}
                onChange={(e) => setDivision(e.target.value as Division)}
                className="rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-2 py-1 text-base sm:text-sm"
              >
                {DIVISIONS.map((d) => (
                  <option key={d} value={d}>
                    {formatDivision(d)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={8}
            placeholder="Paste classifier table here…"
            aria-label="Paste classifier data"
            className="w-full rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 placeholder-gray-400 dark:placeholder-gray-500 px-3 py-2 text-base sm:text-xs font-mono resize-y"
          />

          <div className="flex gap-2 flex-wrap">
            <button
              type="button"
              onClick={handleProcess}
              disabled={!text.trim()}
              className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Process pasted data
            </button>
            {pastedRecord && (
              <button
                type="button"
                onClick={handleReset}
                className="rounded-md border border-gray-300 dark:border-gray-600 px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
              >
                Reset paste
              </button>
            )}
          </div>

          {status && (
            <p
              role="status"
              className={`text-sm ${isError ? 'text-red-600 dark:text-red-400' : 'text-green-700 dark:text-green-400'}`}
            >
              {status}
            </p>
          )}

          {pastedRecord && (
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Divisions in pasted record:{' '}
              {Object.keys(pastedRecord.classifiers).join(', ') || 'none'}
            </p>
          )}
        </div>
      )}
    </div>
  )
}
