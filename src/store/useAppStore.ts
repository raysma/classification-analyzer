import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Division } from '../types/index'
import type { ValidatedShooterRecord } from '../lib/validation'

interface AppState {
  memberNumber: string
  selectedDivision: Division | null
  lastLookupAt: string | null
  pastedRecord: ValidatedShooterRecord | null
  warnings: string[]

  setMemberNumber: (n: string) => void
  setSelectedDivision: (d: Division | null) => void
  setLastLookupAt: (at: string) => void
  setPastedRecord: (r: ValidatedShooterRecord | null) => void
  setWarnings: (w: string[]) => void
  dismissWarnings: () => void
  reset: () => void
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      memberNumber: '',
      selectedDivision: null,
      lastLookupAt: null,
      pastedRecord: null,
      warnings: [],

      setMemberNumber: (memberNumber) => set({ memberNumber }),
      setSelectedDivision: (selectedDivision) => set({ selectedDivision }),
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
        }),
    }),
    {
      name: 'classification-analyzer-app',
      partialize: (state) => ({
        selectedDivision: state.selectedDivision,
      }),
    },
  ),
)
