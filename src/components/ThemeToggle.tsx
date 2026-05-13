import { useEffect, useState } from 'react'

type Theme = 'light' | 'dark' | 'system'

function getSystemPrefersDark(): boolean {
  return window.matchMedia('(prefers-color-scheme: dark)').matches
}

function applyTheme(theme: Theme) {
  const dark = theme === 'dark' || (theme === 'system' && getSystemPrefersDark())
  document.documentElement.classList.toggle('dark', dark)
}

export default function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(() => {
    return (localStorage.getItem('theme') as Theme | null) ?? 'system'
  })

  useEffect(() => {
    applyTheme(theme)
    localStorage.setItem('theme', theme)
  }, [theme])

  // Listen for system preference changes when in 'system' mode
  useEffect(() => {
    if (theme !== 'system') return
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = () => applyTheme('system')
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [theme])

  const label = theme === 'dark' ? 'Dark' : theme === 'light' ? 'Light' : 'System'

  function cycle() {
    setTheme((t) => (t === 'system' ? 'light' : t === 'light' ? 'dark' : 'system'))
  }

  return (
    <button
      type="button"
      onClick={cycle}
      aria-label={`Toggle theme, current: ${label}`}
      title={`Theme: ${label}`}
      className="rounded-md border border-gray-300 dark:border-gray-600 px-2 py-1 text-xs text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800"
    >
      {theme === 'dark' ? '🌙' : theme === 'light' ? '☀️' : '🖥'}
    </button>
  )
}
