import type { ClassLetter } from '../../types/index'

const LETTER_CLASSES: Record<ClassLetter, string> = {
  GM: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  M: 'bg-sky-100 text-sky-800 dark:bg-sky-900 dark:text-sky-200',
  A: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200',
  B: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200',
  C: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
  D: 'bg-slate-200 text-slate-800 dark:bg-slate-700 dark:text-slate-200',
  U: 'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-200',
}

export default function LetterPill({ letter }: { letter: ClassLetter }) {
  return (
    <span
      className={`inline-flex items-center justify-center rounded px-2 py-0.5 text-sm font-semibold ${LETTER_CLASSES[letter]}`}
    >
      {letter}
    </span>
  )
}
