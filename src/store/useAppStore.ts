import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Division, RecentLookup } from '../types/index'
import type { ValidatedShooterRecord, ValidatedClassifier } from '../lib/validation'

export interface HypotheticalScore {
  id: string
  percent: number
  // Only set when the hypothetical comes from the Calculator tab. When set,
  // the scenario row is built with the real values so MRO collisions with
  // existing history work the way USPSA would actually score them.
  date?: string
  classifierCode?: string
}

export const RECENT_LOOKUPS_CAP = 10

interface AppState {
  memberNumber: string
  selectedDivision: Division | null
  lastLookupAt: string | null
  pastedRecord: ValidatedShooterRecord | null
  warnings: string[]
  recentLookups: RecentLookup[]

  // Scenario (what-if) state — reset on division change
  hypotheticalScores: HypotheticalScore[]

  setMemberNumber: (n: string) => void
  setSelectedDivision: (d: Division | null) => void
  setLastLookupAt: (at: string) => void
  setPastedRecord: (r: ValidatedShooterRecord | null) => void
  setWarnings: (w: string[]) => void
  dismissWarnings: () => void
  reset: () => void

  addRecentLookup: (memberNumber: string, name: string) => void
  removeRecentLookup: (memberNumber: string) => void

  // Scenario actions
  addHypothetical: (score: HypotheticalScore) => void
  removeHypothetical: (id: string) => void
  resetScenario: () => void
  buildScenarioScores: (windowScores: ValidatedClassifier[]) => ValidatedClassifier[]
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      memberNumber: '',
      selectedDivision: null,
      lastLookupAt: null,
      pastedRecord: null,
      warnings: [],
      recentLookups: [],
      hypotheticalScores: [],

      setMemberNumber: (memberNumber) => set({ memberNumber }),
      setSelectedDivision: (selectedDivision) => {
        if (selectedDivision !== get().selectedDivision) {
          set({ selectedDivision, hypotheticalScores: [] })
        }
      },
      setLastLookupAt: (lastLookupAt) => set({ lastLookupAt }),
      setPastedRecord: (pastedRecord) => set({ pastedRecord }),
      setWarnings: (warnings) => set({ warnings }),
      dismissWarnings: () => set({ warnings: [] }),
      reset: () =>
        set({
          memberNumber: '',
          selectedDivision: null,
          lastLookupAt: null,
          pastedRecord: null,
          warnings: [],
          hypotheticalScores: [],
        }),

      addRecentLookup: (memberNumber, name) => {
        const canonical = memberNumber.trim().toUpperCase()
        if (!canonical) return
        set((state) => {
          const filtered = state.recentLookups.filter(
            (r) => r.memberNumber !== canonical,
          )
          const entry: RecentLookup = {
            memberNumber: canonical,
            name,
            lastLookedUpAt: new Date().toISOString(),
          }
          return { recentLookups: [entry, ...filtered].slice(0, RECENT_LOOKUPS_CAP) }
        })
      },

      removeRecentLookup: (memberNumber) => {
        const canonical = memberNumber.trim().toUpperCase()
        set((state) => ({
          recentLookups: state.recentLookups.filter(
            (r) => r.memberNumber !== canonical,
          ),
        }))
      },

      addHypothetical: (score) =>
        set((state) => ({
          hypotheticalScores:
            state.hypotheticalScores.length >= 8
              ? state.hypotheticalScores
              : [...state.hypotheticalScores, score],
        })),

      removeHypothetical: (id) =>
        set((state) => ({
          hypotheticalScores: state.hypotheticalScores.filter((s) => s.id !== id),
        })),

      resetScenario: () => set({ hypotheticalScores: [] }),

      buildScenarioScores: (windowScores) => {
        const { hypotheticalScores } = get()
        const hypo: ValidatedClassifier[] = hypotheticalScores.map((h, i) => ({
          date: h.date ?? `9999-${String(i + 1).padStart(2, '0')}-01`,
          classifierCode: h.classifierCode ?? `hypo-${h.id}`,
          percent: h.percent,
          flag: 'Y' as const,
          source: 'club' as const,
        }))
        return [...windowScores, ...hypo]
      },
    }),
    {
      name: 'classification-analyzer-app',
      version: 2,
      partialize: (state) => ({
        selectedDivision: state.selectedDivision,
        recentLookups: state.recentLookups,
      }),
      merge: (persistedState, currentState) => {
        const persisted = (persistedState ?? {}) as Partial<AppState>
        return {
          ...currentState,
          selectedDivision: persisted.selectedDivision ?? currentState.selectedDivision,
          recentLookups: Array.isArray(persisted.recentLookups)
            ? persisted.recentLookups
            : currentState.recentLookups,
        }
      },
    },
  ),
)
