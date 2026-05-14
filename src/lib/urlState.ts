import { useEffect, useRef } from 'react'
import type { Division } from '../types/index'
import { DivisionSchema } from './validation'

const DIVISIONS = DivisionSchema.options

export interface UrlState {
  memberNumber: string | null
  division: Division | null
}

export function readUrlState(): UrlState {
  const params = new URLSearchParams(window.location.search)
  const m = params.get('m')
  const divRaw = params.get('div')
  const division = divRaw && (DIVISIONS as readonly string[]).includes(divRaw)
    ? (divRaw as Division)
    : null
  return { memberNumber: m || null, division }
}

export function writeUrlState(state: Partial<UrlState>) {
  const params = new URLSearchParams(window.location.search)
  if (state.memberNumber !== undefined) {
    if (state.memberNumber) {
      params.set('m', state.memberNumber)
    } else {
      params.delete('m')
    }
  }
  if (state.division !== undefined) {
    if (state.division) {
      params.set('div', state.division)
    } else {
      params.delete('div')
    }
  }
  const newSearch = params.toString()
  const newUrl = newSearch ? `${window.location.pathname}?${newSearch}` : window.location.pathname
  window.history.replaceState(null, '', newUrl)
}

export function useUrlSync(memberNumber: string, division: Division | null) {
  const isFirstRender = useRef(true)

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false
      return
    }
    writeUrlState({ memberNumber: memberNumber || null, division })
  }, [memberNumber, division])
}
