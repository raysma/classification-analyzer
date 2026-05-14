import { useTheme } from '../lib/useTheme'
import type { Theme } from '../lib/useTheme'

const THEME_OPTIONS: { value: Theme; icon: string; label: string }[] = [
  { value: 'light', icon: '☀', label: 'Light' },
  { value: 'system', icon: '◑', label: 'Auto' },
  { value: 'dark', icon: '☾', label: 'Dark' },
]

export default function ThemeToggle() {
  const { theme, setTheme } = useTheme()

  return (
    <select
      value={theme}
      onChange={(e) => setTheme(e.target.value as Theme)}
      aria-label="Color theme"
      className="rounded border border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-800 py-1 pl-1.5 pr-6 text-xs text-gray-600 dark:text-gray-300 cursor-pointer"
    >
      {THEME_OPTIONS.map(({ value, icon, label }) => (
        <option key={value} value={value}>
          {icon} {label}
        </option>
      ))}
    </select>
  )
}
