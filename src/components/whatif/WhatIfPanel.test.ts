import { describe, it, expect, beforeEach } from 'vitest'
import { useAppStore } from '../../store/useAppStore'
import { getCurrentWindow, bestSixOfRecentEight, classFor } from '../../lib/rules'
import { classifierKey } from '../../lib/classifierKey'
import type { ValidatedClassifier } from '../../lib/validation'

// Mirrors the computation WhatIfPanel does inline on every render.
function panelCompute(windowScores: ValidatedClassifier[]) {
  const scenarioScores = useAppStore.getState().buildScenarioScores(windowScores)
  const scenarioWindow = getCurrentWindow(scenarioScores)
  const scenarioWindowScores = scenarioWindow.getScores()
  const { included, dropped } = bestSixOfRecentEight(scenarioWindowScores)
  const includedIds = new Set(included.map(classifierKey))
  const droppedIds = new Set(dropped.map(classifierKey))
  const scenarioPct = scenarioWindow.classificationScore()
  const displayScores = [...scenarioWindowScores].sort((a, b) => {
    const dateCmp = b.date.localeCompare(a.date)
    return dateCmp !== 0 ? dateCmp : b.percent - a.percent
  })
  return { displayScores, includedIds, droppedIds, scenarioPct }
}

function mk(date: string, code: string, percent: number): ValidatedClassifier {
  return { date, classifierCode: code, percent, flag: 'Y', source: 'club' }
}

describe('WhatIfPanel — calculator-sent hypothetical (real date + code)', () => {
  beforeEach(() => {
    useAppStore.setState({ hypotheticalScores: [] })
  })

  it('evicts the oldest score when an 8-score window receives a new hypothetical', () => {
    const window: ValidatedClassifier[] = [
      mk('2024-01-01', '99-08', 70),
      mk('2024-03-01', '99-10', 75),
      mk('2024-06-01', '99-11', 80),
      mk('2024-09-01', '99-12', 82),
      mk('2025-01-01', '03-03', 78),
      mk('2025-04-01', '03-05', 90),
      mk('2025-08-01', '06-03', 65),
      mk('2025-12-01', '08-02', 88),
    ]

    useAppStore.getState().addHypothetical({
      id: 'cal-1',
      percent: 95,
      date: '2026-05-26',
      classifierCode: '22-07',
    })

    const { displayScores, includedIds, droppedIds, scenarioPct } = panelCompute(window)

    // Window stays size 8 — the oldest (2024-01-01, 70%) is evicted
    expect(displayScores).toHaveLength(8)
    expect(displayScores.find((s) => s.date === '2024-01-01')).toBeUndefined()
    expect(displayScores.find((s) => s.classifierCode === '22-07')).toBeDefined()

    // Hypothetical is at the top (newest date)
    expect(displayScores[0]?.classifierCode).toBe('22-07')

    // Best-6-of-8 now includes 95/90/88/82/80/78; drops 75 and 65
    expect(includedIds.size).toBe(6)
    expect(droppedIds.size).toBe(2)
    const droppedPcts = [...droppedIds]
      .map((k) => Number(k.split(':')[2]))
      .sort((a, b) => a - b)
    expect(droppedPcts).toEqual([65, 75])

    expect(scenarioPct).not.toBeNull()
    expect(classFor(scenarioPct!)).toBe('M')
  })

  it('MRO: hypothetical 22-07 evicts an existing 22-07 in the window', () => {
    const window: ValidatedClassifier[] = [
      mk('2024-01-01', '99-08', 70),
      mk('2024-03-01', '99-10', 75),
      mk('2024-06-01', '99-11', 80),
      mk('2024-09-01', '99-12', 82),
      mk('2025-01-01', '22-07', 60), // ← existing 22-07 we want to evict
      mk('2025-04-01', '03-05', 90),
      mk('2025-08-01', '06-03', 65),
      mk('2025-12-01', '08-02', 88),
    ]

    useAppStore.getState().addHypothetical({
      id: 'cal-1',
      percent: 95,
      date: '2026-05-26',
      classifierCode: '22-07',
    })

    const { displayScores } = panelCompute(window)
    expect(displayScores).toHaveLength(8)
    // Old 22-07 (60%) gone; new 22-07 (95%) present
    const allCodes = displayScores.map((s) => `${s.classifierCode}:${s.percent}`)
    expect(allCodes).toContain('22-07:95')
    expect(allCodes).not.toContain('22-07:60')
    // Oldest (2024-01-01) stays this time, because MRO already made room
    expect(displayScores.find((s) => s.date === '2024-01-01')).toBeDefined()
  })

  it('legacy form hypothetical (no date/code) still uses the 9999 sentinel and grows the window', () => {
    const window: ValidatedClassifier[] = [
      mk('2024-01-01', '99-08', 70),
      mk('2024-03-01', '99-10', 75),
      mk('2024-06-01', '99-11', 80),
    ]

    useAppStore.getState().addHypothetical({ id: 'form-1', percent: 95 })

    const { displayScores, scenarioPct } = panelCompute(window)
    expect(displayScores).toHaveLength(4)
    expect(displayScores[0]?.date.startsWith('9999-')).toBe(true)
    expect(scenarioPct).toBeCloseTo((70 + 75 + 80 + 95) / 4, 4)
  })
})
