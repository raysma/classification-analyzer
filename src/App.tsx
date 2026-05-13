import { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client'
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister'
import { QueryClient } from '@tanstack/react-query'
import { useAppStore } from './store/useAppStore'
import { fetchClassification, ClassificationError } from './api/classification'
import LookupForm from './components/LookupForm'
import DivisionTabs from './components/DivisionTabs'
import ClassifierTable from './components/ClassifierTable'
import SummaryCard from './components/SummaryCard'
import ProgressChart from './components/ProgressChart'
import ManualPastePanel from './components/ManualPastePanel'
import ClassUpInsights from './components/ClassUpInsights'
import WhatIfPanel from './components/whatif/WhatIfPanel'
import ThemeToggle from './components/ThemeToggle'
import ErrorBoundary from './components/ErrorBoundary'
import { readUrlState, useUrlSync } from './lib/urlState'
import { getCurrentWindow, bestSixOfRecentEight, getClassificationHistory } from './lib/rules'
import type { Division } from './types/index'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      gcTime: 60 * 60 * 1000,
      retry: 1,
    },
  },
})

const persister = createSyncStoragePersister({
  storage: typeof window !== 'undefined' ? window.localStorage : undefined,
  key: 'classification-query-cache-v3',
})

function ErrorBanner({ error }: { error: unknown }) {
  if (!error) return null
  let message = 'An unexpected error occurred.'
  let isPrivate = false
  let snippet: string | undefined
  if (error instanceof ClassificationError) {
    isPrivate = error.code === 'record_not_viewable'
    if (error.code === 'member_not_found') message = 'No member found with that number.'
    else if (isPrivate) message = "This shooter's record is set to private."
    else if (error.code === 'upstream_timeout') message = 'Request timed out — try again.'
    else if (error.code === 'upstream_error') {
      const statusStr = error.upstreamStatus
        ? ` (HTTP ${error.upstreamStatus}${error.upstreamStatusText ? ' ' + error.upstreamStatusText : ''})`
        : ''
      message = `USPSA returned an error${statusStr}. Try again in a minute, or use the manual paste below.`
      snippet = error.responseSnippet
    } else message = `Error: ${error.code}`
  } else if (error instanceof Error) {
    message = error.message
  }
  return (
    <div
      role="alert"
      className="rounded-md bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 px-4 py-3 text-sm text-red-800 dark:text-red-200"
    >
      <p>
        {message}
        {isPrivate && (
          <span className="ml-1">
            <a
              href="https://uspsa.org/support"
              target="_blank"
              rel="noopener noreferrer"
              className="underline"
            >
              Contact USPSA support
            </a>{' '}
            to make your record public.
          </span>
        )}
      </p>
      {snippet && (
        <details className="mt-2">
          <summary className="cursor-pointer text-xs font-medium opacity-70 hover:opacity-100">
            Response details
          </summary>
          <pre className="mt-1 text-xs overflow-auto max-h-36 whitespace-pre-wrap break-all rounded bg-red-100 dark:bg-red-900 px-2 py-1">
            {snippet}
          </pre>
        </details>
      )}
    </div>
  )
}

function AppInner() {
  const {
    memberNumber,
    selectedDivision,
    warnings,
    pastedRecord,
    setMemberNumber,
    setSelectedDivision,
    setPastedRecord,
    setWarnings,
    dismissWarnings,
  } = useAppStore()

  // Restore URL state on mount
  useEffect(() => {
    const { memberNumber: urlMember, division: urlDiv } = readUrlState()
    if (urlMember && !memberNumber) setMemberNumber(urlMember)
    if (urlDiv) setSelectedDivision(urlDiv)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useUrlSync(memberNumber, selectedDivision)

  const { data, isLoading, error } = useQuery({
    queryKey: ['classification', memberNumber],
    queryFn: async () => {
      const result = await fetchClassification(memberNumber)
      setWarnings(result.warnings)
      return result
    },
    enabled: !!memberNumber,
    staleTime: 5 * 60 * 1000,
  })

  // Fetched record takes priority over pasted record
  const record = data?.record ?? pastedRecord ?? null

  // Auto-select first division when data arrives
  useEffect(() => {
    if (record) {
      const divs = Object.keys(record.classifiers) as Division[]
      if (divs.length > 0 && !selectedDivision) {
        setSelectedDivision(divs[0] ?? null)
      }
    }
  }, [record, selectedDivision, setSelectedDivision])

  function handleLookup(member: string) {
    setMemberNumber(member)
    setSelectedDivision(null)
    setWarnings([])
    setPastedRecord(null)
  }

  const divisionKeys = record ? (Object.keys(record.classifiers) as Division[]) : []
  const scoreCounts: Partial<Record<Division, number>> = {}
  for (const div of divisionKeys) {
    scoreCounts[div] = record?.classifiers[div]?.length ?? 0
  }

  const activeClassifiers =
    record && selectedDivision ? (record.classifiers[selectedDivision] ?? []) : []

  const rollingWindow = activeClassifiers.length > 0 ? getCurrentWindow(activeClassifiers) : null
  const currentPercent = rollingWindow?.classificationScore() ?? null
  const windowScores = rollingWindow?.getScores() ?? []
  const { included, dropped } = bestSixOfRecentEight(windowScores)
  const history = activeClassifiers.length > 0 ? getClassificationHistory(activeClassifiers) : []

  const includedIds = new Set(included.map((c) => `${c.date}:${c.classifierCode}`))
  const droppedIds = new Set(dropped.map((c) => `${c.date}:${c.classifierCode}`))
  const windowIds = new Set(windowScores.map((c) => `${c.date}:${c.classifierCode}`))
  const excludedIds = new Set(
    activeClassifiers
      .filter((c) => !windowIds.has(`${c.date}:${c.classifierCode}`))
      .map((c) => `${c.date}:${c.classifierCode}`),
  )

  return (
    <div className="min-h-screen bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100">
      <header className="border-b border-gray-200 dark:border-gray-800 px-4 py-4">
        <div className="max-w-5xl mx-auto flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold">Classification Analyzer</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              USPSA classifier history and class-up insights
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <ThemeToggle />
            <a
              href="#about"
              className="text-xs text-gray-500 dark:text-gray-400 hover:underline"
            >
              About
            </a>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6 space-y-6">
        <LookupForm onSubmit={handleLookup} isLoading={isLoading} />
        <ManualPastePanel />

        {warnings.length > 0 && (
          <div
            role="alert"
            className="flex items-start gap-3 rounded-md bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 px-4 py-3 text-sm text-amber-800 dark:text-amber-200"
          >
            <span className="flex-1">
              Heads up — we couldn&apos;t parse {warnings.length} row
              {warnings.length !== 1 ? 's' : ''}. Display may be incomplete.
            </span>
            <button
              onClick={dismissWarnings}
              aria-label="Dismiss warnings"
              className="shrink-0 font-medium underline"
            >
              Dismiss
            </button>
          </div>
        )}

        <ErrorBanner error={error} />

        {record && (
          <div className="space-y-4">
            <div className="flex items-start gap-4 flex-wrap">
              <div>
                <p className="text-lg font-semibold">{record.name}</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {record.memberNumber} · {record.membershipType}
                </p>
              </div>
              {record.source === 'paste' && (
                <span className="rounded-full bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300 px-2 py-0.5 text-xs font-medium">
                  Manual paste
                </span>
              )}
            </div>

            <DivisionTabs
              divisions={divisionKeys}
              scoreCounts={scoreCounts}
              selected={selectedDivision}
              onSelect={(d) => setSelectedDivision(d)}
            />

            {selectedDivision && activeClassifiers.length === 0 && (
              <p className="text-sm text-gray-500 dark:text-gray-400">
                No classifiers found for {selectedDivision}.
              </p>
            )}

            {selectedDivision && activeClassifiers.length > 0 && (
              <SummaryCard
                currentPercent={currentPercent}
                windowSize={windowScores.length}
                division={selectedDivision}
              />
            )}

            {selectedDivision && activeClassifiers.length >= 4 && history.length > 0 && (
              <ProgressChart classifiers={activeClassifiers} history={history} />
            )}

            {selectedDivision && activeClassifiers.length > 0 && (
              <ClassUpInsights classifiers={activeClassifiers} division={selectedDivision} />
            )}

            {selectedDivision && activeClassifiers.length > 0 && activeClassifiers.length < 4 && (
              <p className="text-sm text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950 rounded-md px-3 py-2">
                Only {activeClassifiers.length} of 4 classifiers in {selectedDivision} — needs{' '}
                {4 - activeClassifiers.length} more for an initial classification.
              </p>
            )}

            {selectedDivision && windowScores.length > 0 && (
              <WhatIfPanel
                windowScores={windowScores}
                currentPercent={currentPercent}
                division={selectedDivision}
              />
            )}

            {selectedDivision && activeClassifiers.length > 0 && (
              <ClassifierTable
                classifiers={activeClassifiers}
                highlightedIds={includedIds}
                droppedIds={droppedIds}
                excludedIds={excludedIds}
              />
            )}
          </div>
        )}

        {/* About section */}
        <section
          id="about"
          className="border-t border-gray-200 dark:border-gray-700 pt-6 space-y-3 text-sm text-gray-600 dark:text-gray-400"
        >
          <h2 className="font-semibold text-gray-800 dark:text-gray-200">About</h2>
          <p>
            Classification Analyzer looks up USPSA shooter records and visualizes score progression
            over time. Enter your member number to fetch your record, or paste a classifier table
            manually.
          </p>
          <div>
            <p className="font-medium text-gray-700 dark:text-gray-300 mb-1">Classification brackets</p>
            <ul className="text-xs space-y-0.5">
              <li>GM: 95–110% &nbsp; M: 85–94.9% &nbsp; A: 75–84.9% &nbsp; B: 60–74.9%</li>
              <li>C: 40–59.9% &nbsp; D: 2–39.9%</li>
            </ul>
          </div>
          <div>
            <p className="font-medium text-gray-700 dark:text-gray-300 mb-1">Flag legend</p>
            <ul className="text-xs space-y-0.5">
              <li>Y = Included in current average &nbsp; F = Dropped (lower score)</li>
              <li>E = Outside window &nbsp; M = Most Recent Override &nbsp; S = Same-Day Average</li>
              <li>I/Q/N = Excluded (admin/DQ/DNF) &nbsp; A = Invalidated (&gt;20% above class)</li>
              <li>P = Pending &nbsp; X = Expired membership</li>
            </ul>
          </div>
          <p>
            Classification window math follows{' '}
            <a
              href="https://uspsa.org/classification/about"
              target="_blank"
              rel="noopener noreferrer"
              className="underline"
            >
              USPSA&apos;s April 2025 rules
            </a>
            : best 6 of most recent 8 (with n=4..6 edge cases).
          </p>
          <p className="text-xs">
            Data is fetched from uspsa.org and cached for 15 minutes. We don&apos;t store member
            numbers beyond the CDN cache. Rules math adapted from{' '}
            <a
              href="https://github.com/uspsaprogress/progress"
              target="_blank"
              rel="noopener noreferrer"
              className="underline"
            >
              uspsaprogress/progress
            </a>{' '}
            (ISC).{' '}
            <a
              href="https://github.com/raysma/classification-analyzer"
              target="_blank"
              rel="noopener noreferrer"
              className="underline"
            >
              Source on GitHub
            </a>
            .
          </p>
        </section>
      </main>
    </div>
  )
}

export default function App() {
  return (
    <ErrorBoundary>
      <PersistQueryClientProvider client={queryClient} persistOptions={{ persister }}>
        <AppInner />
      </PersistQueryClientProvider>
    </ErrorBoundary>
  )
}
