import { useTheme } from '../lib/useTheme'
import type { Theme } from '../lib/useTheme'

const THEME_CYCLE: Theme[] = ['light', 'system', 'dark']
const THEME_LABEL: Record<Theme, string> = { light: 'Light', system: 'Auto', dark: 'Dark' }
const THEME_ICON: Record<Theme, string> = { light: '☀', system: '◑', dark: '☾' }

function nextTheme(t: Theme): Theme {
  const i = THEME_CYCLE.indexOf(t)
  return THEME_CYCLE[(i + 1) % THEME_CYCLE.length] ?? 'system'
}

export default function ThemeToggle() {
  const { theme, setTheme } = useTheme()
  const next = nextTheme(theme)

  return (
    <button
      type="button"
      onClick={() => setTheme(next)}
      aria-label={`Theme: ${THEME_LABEL[theme]}. Click to switch to ${THEME_LABEL[next]}.`}
      title={`Theme: ${THEME_LABEL[theme]} · Click for ${THEME_LABEL[next]}`}
      className="rounded-md border border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-800 px-2.5 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700"
    >
      <span aria-hidden>{THEME_ICON[theme]}</span>
    </button>
  )
}
