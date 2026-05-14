import { useState } from 'react'
import { useAppStore } from '../../store/useAppStore'

export default function HypotheticalScoreForm() {
  const { hypotheticalScores, addHypothetical } = useAppStore()
  const [input, setInput] = useState('')
  const [error, setError] = useState<string | null>(null)

  const isFull = hypotheticalScores.length >= 8

  function handleAdd() {
    const val = parseFloat(input)
    if (isNaN(val) || val < 0 || val > 110) {
      setError('Enter a percent between 0 and 110')
      return
    }
    setError(null)
    addHypothetical({ id: `${Date.now()}-${Math.random()}`, percent: val })
    setInput('')
  }

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-gray-600 dark:text-gray-400">
        Add hypothetical score (max 8)
      </p>
      <div className="flex gap-2">
        <input
          type="number"
          min={0}
          max={110}
          step={0.01}
          value={input}
          onChange={(e) => {
            setInput(e.target.value)
            setError(null)
          }}
          placeholder="e.g. 69.69"
          disabled={isFull}
          aria-label="Hypothetical score percent"
          className="w-28 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-2 py-1 text-sm"
        />
        <button
          type="button"
          onClick={handleAdd}
          disabled={isFull || !input.trim()}
          className="rounded-md bg-indigo-600 px-3 py-1 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Add
        </button>
      </div>
      {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
      {isFull && <p className="text-xs text-gray-400">Maximum 8 hypothetical scores reached.</p>}
    </div>
  )
}
