import { createPortal } from 'react-dom'
import type { ReactNode } from 'react'
import changelogRaw from '../../CHANGELOG.md?raw'

interface Props {
  onClose: () => void
}

interface ParsedEntry {
  date: string
  sections: Array<{
    heading: string
    items: string[]
  }>
}

function parseChangelog(raw: string): ParsedEntry[] {
  const entries: ParsedEntry[] = []
  let current: ParsedEntry | null = null
  let currentSection: { heading: string; items: string[] } | null = null

  for (const line of raw.split('\n')) {
    if (line.startsWith('## ')) {
      if (currentSection && current) current.sections.push(currentSection)
      if (current) entries.push(current)
      current = { date: line.slice(3).trim(), sections: [] }
      currentSection = null
    } else if (line.startsWith('### ')) {
      if (currentSection && current) current.sections.push(currentSection)
      currentSection = { heading: line.slice(4).trim(), items: [] }
    } else if (line.startsWith('- ') && currentSection) {
      currentSection.items.push(line.slice(2))
    }
  }

  if (currentSection && current) current.sections.push(currentSection)
  if (current) entries.push(current)

  return entries
}

const INLINE_PATTERN = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g

function renderInline(text: string): ReactNode[] {
  const parts = text.split(INLINE_PATTERN).filter((p) => p !== '')
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return (
        <strong key={i} className="font-semibold text-gray-900 dark:text-gray-100">
          {part.slice(2, -2)}
        </strong>
      )
    }
    if (part.startsWith('`') && part.endsWith('`')) {
      return (
        <code
          key={i}
          className="rounded bg-gray-100 dark:bg-gray-800 px-1 py-0.5 text-[0.85em] font-mono text-gray-800 dark:text-gray-200"
        >
          {part.slice(1, -1)}
        </code>
      )
    }
    if (part.startsWith('*') && part.endsWith('*')) {
      return (
        <em key={i} className="italic">
          {part.slice(1, -1)}
        </em>
      )
    }
    return <span key={i}>{part}</span>
  })
}

const entries = parseChangelog(changelogRaw)

export default function ChangelogModal({ onClose }: Props) {
  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-lg max-h-[80vh] overflow-y-auto rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 flex items-center justify-between border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-5 py-4">
          <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
            What&apos;s New
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close changelog"
            className="rounded p-1 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              className="w-5 h-5"
              aria-hidden="true"
            >
              <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
            </svg>
          </button>
        </div>

        <div className="px-5 py-4 space-y-8">
          {entries.map((entry) => (
            <div key={entry.date}>
              <p className="text-base font-semibold text-gray-500 dark:text-gray-400 mb-4">
                {entry.date}
              </p>
              {entry.sections.map((section) => (
                <div key={section.heading} className="mb-5 last:mb-0">
                  <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                    {section.heading}
                  </p>
                  <ul className="space-y-2">
                    {section.items.map((item, i) => (
                      <li key={i} className="flex gap-2 text-sm">
                        <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-gray-300 dark:bg-gray-600" />
                        <span className="text-gray-600 dark:text-gray-400">
                          {renderInline(item)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>,
    document.body,
  )
}
