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
                viewBox="0 0 20 20"
                fill="currentColor"
                className="h-4 w-4"
                aria-hidden="true"
              >
                <path
                  fillRule="evenodd"
                  d="M8.75 1A1.75 1.75 0 007 2.75V3H4a.75.75 0 000 1.5h.515l.66 11.226A2.25 2.25 0 007.42 17.75h5.16a2.25 2.25 0 002.245-2.024L15.485 4.5H16a.75.75 0 000-1.5h-3v-.25A1.75 1.75 0 0011.25 1h-2.5zM8.5 3v-.25a.25.25 0 01.25-.25h2.5a.25.25 0 01.25.25V3h-3zm-1.16 2.5h5.32l-.643 10.94a.75.75 0 01-.748.675H7.731a.75.75 0 01-.748-.675L7.34 5.5z"
                  clipRule="evenodd"
                />
              </svg>
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}
