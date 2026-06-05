import { useState, type FormEvent } from 'react'

const MEMBER_RE = /^[A-Z]{1,3}\d+$/

interface Props {
  onSubmit: (memberNumber: string) => void
  isLoading: boolean
  initialMember?: string
}

export default function LookupForm({ onSubmit, isLoading, initialMember = '' }: Props) {
  const [input, setInput] = useState(initialMember)
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
        USPSA member number
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
          placeholder="e.g. A69420"
          className="flex-1 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 placeholder-gray-400 dark:placeholder-gray-500 px-3 py-2 text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          aria-describedby={error ? 'member-error' : undefined}
          disabled={isLoading}
          autoComplete="off"
          autoCapitalize="characters"
        />
        <button
          type="submit"
          disabled={isLoading || !input.trim()}
          aria-busy={isLoading}
          className="relative inline-flex items-center justify-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <span className={isLoading ? 'invisible' : ''}>Look up</span>
          {isLoading && (
            <svg className="absolute animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" aria-hidden="true">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
          )}
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
