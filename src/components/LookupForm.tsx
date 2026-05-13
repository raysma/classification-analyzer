import { useState, type FormEvent } from 'react'
import { useAppStore } from '../store/useAppStore'

const MEMBER_RE = /^[A-Z]{1,3}\d+$/

interface Props {
  onSubmit: (memberNumber: string) => void
  isLoading: boolean
}

export default function LookupForm({ onSubmit, isLoading }: Props) {
  const storedMember = useAppStore((s) => s.memberNumber)
  const [input, setInput] = useState(storedMember)
  const [error, setError] = useState<string | null>(null)

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const value = input.trim().toUpperCase()
    if (!MEMBER_RE.test(value)) {
      setError('Enter a valid member number, e.g. A12345, TY53124, FY12345, or L5727')
      return
    }
    setError(null)
    onSubmit(value)
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2 max-w-md">
      <label htmlFor="member-input" className="text-sm font-medium text-gray-700 dark:text-gray-300">
        Member number
      </label>
      <div className="flex gap-2">
        <input
          id="member-input"
          type="text"
          value={input}
          onChange={(e) => {
            setInput(e.target.value.toUpperCase())
            setError(null)
          }}
          placeholder="e.g. A12345 / TY53124 / FY12345 / L5727"
          className="flex-1 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          aria-describedby={error ? 'member-error' : undefined}
          disabled={isLoading}
          autoComplete="off"
          autoCapitalize="characters"
        />
        <button
          type="submit"
          disabled={isLoading || !input.trim()}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? 'Loading…' : 'Look up'}
        </button>
      </div>
      {error && (
        <p id="member-error" role="alert" className="text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
    </form>
  )
}
