import { useEffect, useState } from 'react'
import type { ValidatedShooterRecord } from './lib/validation'
import { Analytics } from '@vercel/analytics/react'
import { SpeedInsights } from '@vercel/speed-insights/react'
import { useQuery } from '@tanstack/react-query'
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client'
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister'
import { QueryClient } from '@tanstack/react-query'
import { useAppStore } from './store/useAppStore'
import { fetchClassification, ClassificationError } from './api/classification'
import LookupForm from './components/LookupForm'
import RecentLookups from './components/RecentLookups'
import DivisionTabs from './components/DivisionTabs'
import ClassifierTable from './components/ClassifierTable'
import SummaryCard from './components/SummaryCard'
import ProgressChart from './components/ProgressChart'
import ManualPastePanel from './components/ManualPastePanel'
import ClassUpInsights from './components/ClassUpInsights'
import WhatIfPanel from './components/whatif/WhatIfPanel'
import CalculatorPanel from './components/calculator/CalculatorPanel'
import ThemeToggle from './components/ThemeToggle'
import ErrorBoundary from './components/ErrorBoundary'
import ChangelogModal from './components/ChangelogModal'
import FeedbackModal from './components/FeedbackModal'
import { readUrlState, useUrlSync, type Tab } from './lib/urlState'
import {
  getCurrentWindow,
  bestSixOfRecentEight,
  getClassificationHistory,
  crossDivisionFloorClass,
} from './lib/rules'
import { classifierKey } from './lib/classifierKey'
import { formatDivision } from './lib/formatters'
import type { Division } from './types/index'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      gcTime: 60 * 60 * 1000,
      retry: 0,
    },
  },
})

const persister = createSyncStoragePersister({
  storage: typeof window !== 'undefined' ? window.localStorage : undefined,
  key: 'classification-query-cache-v4',
})

function RecordBarHeader({
  record,
  expanded,
  onToggle,
}: {
  record: ValidatedShooterRecord
  expanded: boolean
  onToggle: () => void
}) {
  return (
    <div className="px-4 py-3 flex items-center justify-between gap-3 flex-wrap">
      <div className="flex items-baseline gap-3 flex-wrap min-w-0">
        <span className="text-lg font-semibold truncate">{record.name}</span>
        {record.source !== 'paste' && (
          <>
            <span className="font-mono text-sm text-gray-600 dark:text-gray-300">
              {record.memberNumber}
            </span>
            <span className="text-sm text-gray-500 dark:text-gray-400">
              {record.membershipType}
            </span>
          </>
        )}
        {record.source === 'paste' && (
          <span className="rounded-full bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300 px-2 py-0.5 text-xs font-medium">
            Manual paste
          </span>
        )}
      </div>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        aria-controls="lookup-section"
        className="text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline shrink-0"
      >
        {expanded ? 'Done' : 'Change'}
      </button>
    </div>
  )
}

const TABS: Array<{ id: Tab; label: string }> = [
  { id: 'overview', label: 'Overview' },
  { id: 'whatif', label: 'What-If' },
  { id: 'scores', label: 'Scores' },
  { id: 'calculator', label: 'Calculator' },
]

function TabNav({ currentTab, onChange }: { currentTab: Tab; onChange: (t: Tab) => void }) {
  return (
    <div role="tablist" aria-label="Sections" className="flex gap-1 border-b border-gray-200 dark:border-gray-800">
      {TABS.map((tab) => {
        const isActive = currentTab === tab.id
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(tab.id)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition ${
              isActive
                ? 'border-blue-600 text-gray-900 dark:text-gray-100'
                : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:border-gray-300 dark:hover:border-gray-600'
            }`}
          >
            {tab.label}
          </button>
        )
      })}
    </div>
  )
}

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
    } else if (error.code === 'fetch_failed') {
      const statusStr = error.upstreamStatus ? ` (HTTP ${error.upstreamStatus})` : ''
      message = `Fetch failed${statusStr}. The scraping service may be unavailable — try again or use manual paste.`
      snippet = error.responseSnippet
    } else if (error.code === 'parse_failed') {
      message = 'Could not parse the USPSA page — the site may have changed or returned an unexpected page. Try again or use manual paste.'
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
  const [showChangelog, setShowChangelog] = useState(false)
  const [showFeedback, setShowFeedback] = useState(false)
  const [tab, setTab] = useState<Tab>(() => readUrlState().tab)
  const [lookupExpanded, setLookupExpanded] = useState(true)
  const [recordPresent, setRecordPresent] = useState(false)

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
    addRecentLookup,
  } = useAppStore()

  // Restore URL state on mount — auto-fetch if member number is in URL
  useEffect(() => {
    const { memberNumber: urlMember, division: urlDiv } = readUrlState()
    if (urlMember && !memberNumber) setMemberNumber(urlMember)
    if (urlDiv) setSelectedDivision(urlDiv)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const { data, isFetching, error } = useQuery({
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

  const divisionKeys = record ? (Object.keys(record.classifiers) as Division[]) : []
  // Default to the first division until the user explicitly picks one. Derived
  // during render rather than synced via an effect (react-hooks/set-state-in-effect).
  const effectiveDivision = selectedDivision ?? divisionKeys[0] ?? null

  useUrlSync(memberNumber, effectiveDivision, tab)

  useEffect(() => {
    if (data?.record && data.record.source === 'fetch') {
      addRecentLookup(data.record.memberNumber, data.record.name)
    }
  }, [data?.record, addRecentLookup])

  // Once we have a record, collapse the lookup form so it doesn't dominate
  // vertical space (user reopens with the Change button). Adjusted during render
  // on the absent→present transition rather than in an effect.
  const hasRecord = !!record
  if (hasRecord !== recordPresent) {
    setRecordPresent(hasRecord)
    if (hasRecord) setLookupExpanded(false)
  }

  function handleLookup(member: string) {
    setMemberNumber(member)
    setSelectedDivision(null)
    setWarnings([])
    setPastedRecord(null)
    queryClient.invalidateQueries({ queryKey: ['classification', member] })
  }

  const scoreCounts: Partial<Record<Division, number>> = {}
  for (const div of divisionKeys) {
    scoreCounts[div] = record?.classifiers[div]?.length ?? 0
  }

  const activeClassifiers =
    record && effectiveDivision ? [...(record.classifiers[effectiveDivision] ?? [])] : []

  const rollingWindow = activeClassifiers.length > 0 ? getCurrentWindow(activeClassifiers) : null
  const currentPercent = rollingWindow?.classificationScore() ?? null
  const windowScores = rollingWindow?.getScores() ?? []
  const { included, dropped } = bestSixOfRecentEight(windowScores)
  const history = activeClassifiers.length > 0 ? getClassificationHistory(activeClassifiers) : []
  const allTimeHighPercent = history.length > 0 ? Math.max(...history.map((h) => h.percent)) : undefined

  const includedIds = new Set(included.map(classifierKey))
  const droppedIds = new Set(dropped.map(classifierKey))
  const windowIds = new Set(windowScores.map(classifierKey))
  const excludedIds = new Set(
    activeClassifiers.filter((c) => !windowIds.has(classifierKey(c))).map(classifierKey),
  )

  return (
    <div className="min-h-screen bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100">
      <header className="border-b border-gray-200 dark:border-gray-800 px-4 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <img src="/favicon.svg" alt="" width="24" height="24" className="select-none" />
            <h1 className="text-xl font-bold">Classification Analyzer</h1>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6 space-y-6">
        {record ? (
          <div className="rounded-md border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 overflow-hidden">
            <RecordBarHeader
              record={record}
              expanded={lookupExpanded}
              onToggle={() => setLookupExpanded((v) => !v)}
            />
            <div
              id="lookup-section"
              className={`grid transition-[grid-template-rows] duration-300 ease-out motion-reduce:transition-none ${
                lookupExpanded ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
              }`}
              aria-hidden={!lookupExpanded}
            >
              <div className="overflow-hidden">
                <div className="border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-950 px-4 py-4 space-y-6">
                  <LookupForm onSubmit={handleLookup} isLoading={isFetching && !data} initialMember={readUrlState().memberNumber ?? ''} />
                  <RecentLookups onSelect={handleLookup} disabled={isFetching} />

                  {isFetching && !data && memberNumber && (
                    <p className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-2">
                      <svg className="animate-spin h-4 w-4 shrink-0" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Fetching {memberNumber} from USPSA…
                    </p>
                  )}
                  <ManualPastePanel />
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            <LookupForm onSubmit={handleLookup} isLoading={isFetching && !data} initialMember={readUrlState().memberNumber ?? ''} />
            <RecentLookups onSelect={handleLookup} disabled={isFetching} />

            {isFetching && !data && memberNumber && (
              <p className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-2">
                <svg className="animate-spin h-4 w-4 shrink-0" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Fetching {memberNumber} from USPSA…
              </p>
            )}
            <ManualPastePanel />
          </div>
        )}

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

        <div className="space-y-4">
          {record && (
            <DivisionTabs
              divisions={divisionKeys}
              scoreCounts={scoreCounts}
              selected={effectiveDivision}
              onSelect={(d) => setSelectedDivision(d)}
            />
          )}

          <TabNav currentTab={tab} onChange={setTab} />

          {tab === 'calculator' && (
            <CalculatorPanel hasRecord={!!record} onNavigate={setTab} />
          )}

          {record && tab === 'overview' && effectiveDivision && activeClassifiers.length === 0 && (
            <p className="text-sm text-gray-500 dark:text-gray-400">
              No classifiers found for {formatDivision(effectiveDivision)}.
            </p>
          )}

          {record && tab === 'overview' && effectiveDivision && activeClassifiers.length > 0 && (
            <SummaryCard
              projectedPercent={currentPercent}
              windowSize={windowScores.length}
              division={effectiveDivision}
              crossDivisionFloor={crossDivisionFloorClass(record.classifiers, effectiveDivision)}
              {...(allTimeHighPercent !== undefined ? { allTimeHighPercent } : {})}
              {...(record.currentClasses[effectiveDivision]
                ? { officialClass: record.currentClasses[effectiveDivision] }
                : {})}
            />
          )}

          {record && tab === 'overview' && effectiveDivision && activeClassifiers.length > 0 && (
            <ClassUpInsights
              classifiers={activeClassifiers}
              division={effectiveDivision}
              {...(record.currentClasses[effectiveDivision]
                ? { officialClass: record.currentClasses[effectiveDivision] }
                : {})}
            />
          )}

          {record && tab === 'overview' && effectiveDivision && activeClassifiers.length >= 4 && history.length > 0 && (
            <ProgressChart classifiers={activeClassifiers} history={history} />
          )}

          {record && tab === 'overview' && effectiveDivision && activeClassifiers.length > 0 && activeClassifiers.length < 4 && (
            <p className="text-sm text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950 rounded-md px-3 py-2">
              Only {activeClassifiers.length} of 4 classifiers in {formatDivision(effectiveDivision)} — needs{' '}
              {4 - activeClassifiers.length} more for an initial classification.
            </p>
          )}

          {record && tab === 'whatif' && effectiveDivision && windowScores.length > 0 && (
            <WhatIfPanel
              windowScores={windowScores}
              currentPercent={currentPercent}
            />
          )}

          {record && tab === 'whatif' && effectiveDivision && windowScores.length === 0 && (
            <p className="text-sm text-gray-500 dark:text-gray-400">
              No scores in window for {formatDivision(effectiveDivision)} — nothing to simulate.
            </p>
          )}

          {record && tab === 'scores' && effectiveDivision && activeClassifiers.length > 0 && (
            <ClassifierTable
              classifiers={activeClassifiers}
              highlightedIds={includedIds}
              droppedIds={droppedIds}
              excludedIds={excludedIds}
            />
          )}

          {record && tab === 'scores' && effectiveDivision && activeClassifiers.length === 0 && (
            <p className="text-sm text-gray-500 dark:text-gray-400">
              No classifiers found for {formatDivision(effectiveDivision)}.
            </p>
          )}
        </div>

        <footer className="border-t border-gray-200 dark:border-gray-700 pt-4 pb-6 text-center text-xs text-gray-400 dark:text-gray-500 space-y-2">
          <p>Crafted with love for the shooting community.</p>
          <div className="flex items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => setShowChangelog(true)}
              className="hover:text-gray-600 dark:hover:text-gray-300"
            >
              What&apos;s new
            </button>
            <span aria-hidden="true">·</span>
            <button
              type="button"
              onClick={() => setShowFeedback(true)}
              className="hover:text-gray-600 dark:hover:text-gray-300"
            >
              Feedback
            </button>
            <span aria-hidden="true">·</span>
            <a
              href="https://github.com/raysma/classification-analyzer"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-gray-600 dark:hover:text-gray-300"
            >
              GitHub
            </a>
          </div>
        </footer>
        {showChangelog && <ChangelogModal onClose={() => setShowChangelog(false)} />}
        {showFeedback && <FeedbackModal onClose={() => setShowFeedback(false)} />}
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
      <Analytics />
      <SpeedInsights />
    </ErrorBoundary>
  )
}
