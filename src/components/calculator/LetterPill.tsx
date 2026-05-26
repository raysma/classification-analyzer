import type { ClassLetter } from '../../types/index'

// Same palette as the Overview SummaryCard chip / ClassifierTable percent text
// / ProgressChart bands, so a Calculator result reads as the same class color
// the rest of the app shows.
const LETTER_CLASSES: Record<ClassLetter, string> = {
  GM: 'bg-yellow-400 text-yellow-900',
  M: 'bg-purple-500 text-white',
  A: 'bg-blue-500 text-white',
  B: 'bg-green-500 text-white',
  C: 'bg-orange-400 text-white',
  D: 'bg-red-400 text-white',
  U: 'bg-gray-300 text-gray-700',
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
