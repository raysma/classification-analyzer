import type { Division } from '../types/index'

interface Props {
  divisions: Division[]
  scoreCounts: Partial<Record<Division, number>>
  selected: Division | null
  onSelect: (d: Division) => void
}

export default function DivisionTabs({ divisions, scoreCounts, selected, onSelect }: Props) {
  if (divisions.length === 0) return null

  return (
    <div role="tablist" aria-label="Divisions" className="flex flex-wrap gap-2">
      {divisions.map((div) => {
        const isSelected = div === selected
        const count = scoreCounts[div] ?? 0
        return (
          <button
            key={div}
            role="tab"
            aria-selected={isSelected}
            onClick={() => onSelect(div)}
            className={[
              'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
              isSelected
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700',
            ].join(' ')}
          >
            {div}
            <span className="ml-1.5 text-xs opacity-75">({count})</span>
          </button>
        )
      })}
    </div>
  )
}
