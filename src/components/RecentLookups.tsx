import { useAppStore } from '../store/useAppStore'

const RELATIVE_FORMATTER =
  typeof Intl !== 'undefined' && typeof Intl.RelativeTimeFormat === 'function'
    ? new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' })
    : null

function formatRelative(iso: string): string {
  if (!RELATIVE_FORMATTER) return ''
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return ''
  const diffSec = Math.round((then - Date.now()) / 1000)
  const abs = Math.abs(diffSec)
  if (abs < 60) return RELATIVE_FORMATTER.format(diffSec, 'second')
  if (abs < 3600) return RELATIVE_FORMATTER.format(Math.round(diffSec / 60), 'minute')
  if (abs < 86400) return RELATIVE_FORMATTER.format(Math.round(diffSec / 3600), 'hour')
  if (abs < 2592000) return RELATIVE_FORMATTER.format(Math.round(diffSec / 86400), 'day')
  if (abs < 31536000) return RELATIVE_FORMATTER.format(Math.round(diffSec / 2592000), 'month')
  return RELATIVE_FORMATTER.format(Math.round(diffSec / 31536000), 'year')
}

interface Props {
  onSelect: (memberNumber: string) => void
  disabled?: boolean
}

export default function RecentLookups({ onSelect, disabled = false }: Props) {
  const recentLookups = useAppStore((s) => s.recentLookups)
  const removeRecentLookup = useAppStore((s) => s.removeRecentLookup)

  if (recentLookups.length === 0) return null

  return (
    <section aria-labelledby="recent-lookups-heading" className="max-w-md">
      <h2
        id="recent-lookups-heading"
        className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-2"
      >
        Recent lookups
      </h2>
      <ul className="rounded-md border border-gray-200 dark:border-gray-700 divide-y divide-gray-200 dark:divide-gray-700 overflow-hidden bg-white dark:bg-gray-900">
        {recentLookups.map((entry) => (
          <li key={entry.memberNumber} className="flex items-stretch">
            <button
              type="button"
              onClick={() => onSelect(entry.memberNumber)}
              disabled={disabled}
              className="flex-1 min-w-0 text-left px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500"
            >
              <div className="flex items-baseline gap-2 min-w-0">
                <span className="font-mono text-sm font-medium truncate">
                  {entry.memberNumber}
                </span>
                <span className="text-sm text-gray-600 dark:text-gray-300 truncate">
                  {entry.name}
                </span>
              </div>
              <span className="text-xs text-gray-400 dark:text-gray-500">
                {formatRelative(entry.lastLookedUpAt)}
              </span>
            </button>
            <button
              type="button"
              onClick={() => removeRecentLookup(entry.memberNumber)}
              aria-label={`Remove ${entry.memberNumber} from recent lookups`}
              className="px-3 text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-gray-50 dark:hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-red-500"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
                className="h-4 w-4"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0"
                />
              </svg>
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}
