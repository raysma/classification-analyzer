import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Division } from '../types/index'
import type { ValidatedShooterRecord, ValidatedClassifier } from '../lib/validation'

export interface HypotheticalScore {
  id: string
  percent: number
}

interface AppState {
  memberNumber: string
  selectedDivision: Division | null
  lastLookupAt: string | null
  pastedRecord: ValidatedShooterRecord | null
  warnings: string[]

  // Scenario (what-if) state — reset on division change
  hypotheticalScores: HypotheticalScore[]

  setMemberNumber: (n: string) => void
  setSelectedDivision: (d: Division | null) => void
  setLastLookupAt: (at: string) => void
  setPastedRecord: (r: ValidatedShooterRecord | null) => void
  setWarnings: (w: string[]) => void
  dismissWarnings: () => void
  reset: () => void

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
          date: `9999-${String(i + 1).padStart(2, '0')}-01`,
          classifierCode: `hypo-${h.id}`,
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
      }),
      merge: (persistedState, currentState) => {
        const persisted = (persistedState ?? {}) as Partial<AppState>
        return {
          ...currentState,
          selectedDivision: persisted.selectedDivision ?? currentState.selectedDivision,
        }
      },
    },
  ),
)
