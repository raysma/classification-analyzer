import { beforeEach, describe, expect, it } from 'vitest'
import { RECENT_LOOKUPS_CAP, useAppStore } from './useAppStore'

function resetStore() {
  useAppStore.setState({ recentLookups: [] })
}

describe('recentLookups', () => {
  beforeEach(() => {
    resetStore()
  })

  it('adds a new entry to the front', () => {
    useAppStore.getState().addRecentLookup('A12345', 'Jane Shooter')
    const recents = useAppStore.getState().recentLookups
    expect(recents).toHaveLength(1)
    expect(recents[0]?.memberNumber).toBe('A12345')
    expect(recents[0]?.name).toBe('Jane Shooter')
    expect(recents[0]?.lastLookedUpAt).toMatch(/T/)
  })

  it('canonicalizes member number to uppercase', () => {
    useAppStore.getState().addRecentLookup('a12345', 'Jane')
    expect(useAppStore.getState().recentLookups[0]?.memberNumber).toBe('A12345')
  })

  it('dedupes by member number and moves the entry to the top with a fresh name + timestamp', async () => {
    useAppStore.getState().addRecentLookup('A12345', 'Jane Old')
    useAppStore.getState().addRecentLookup('L5727', 'Other')
    const firstTimestamp = useAppStore.getState().recentLookups[1]?.lastLookedUpAt
    await new Promise((r) => setTimeout(r, 5))
    useAppStore.getState().addRecentLookup('a12345', 'Jane New')

    const recents = useAppStore.getState().recentLookups
    expect(recents).toHaveLength(2)
    expect(recents[0]?.memberNumber).toBe('A12345')
    expect(recents[0]?.name).toBe('Jane New')
    expect(recents[0]?.lastLookedUpAt).not.toBe(firstTimestamp)
    expect(recents[1]?.memberNumber).toBe('L5727')
  })

  it('caps at RECENT_LOOKUPS_CAP entries, evicting the oldest', () => {
    for (let i = 0; i < RECENT_LOOKUPS_CAP + 5; i++) {
      useAppStore.getState().addRecentLookup(`A${i}`, `Shooter ${i}`)
    }
    const recents = useAppStore.getState().recentLookups
    expect(recents).toHaveLength(RECENT_LOOKUPS_CAP)
    expect(recents[0]?.memberNumber).toBe(`A${RECENT_LOOKUPS_CAP + 4}`)
    expect(recents[RECENT_LOOKUPS_CAP - 1]?.memberNumber).toBe('A5')
    expect(recents.find((r) => r.memberNumber === 'A0')).toBeUndefined()
  })

  it('ignores empty or whitespace-only member numbers', () => {
    useAppStore.getState().addRecentLookup('   ', 'Anon')
    useAppStore.getState().addRecentLookup('', 'Anon')
    expect(useAppStore.getState().recentLookups).toHaveLength(0)
  })

  it('removes an entry by member number, case-insensitive', () => {
    useAppStore.getState().addRecentLookup('A12345', 'Jane')
    useAppStore.getState().addRecentLookup('L5727', 'Joe')
    useAppStore.getState().removeRecentLookup('a12345')

    const recents = useAppStore.getState().recentLookups
    expect(recents).toHaveLength(1)
    expect(recents[0]?.memberNumber).toBe('L5727')
  })

  it('remove is a no-op when the member number is not present', () => {
    useAppStore.getState().addRecentLookup('A12345', 'Jane')
    useAppStore.getState().removeRecentLookup('B99999')
    expect(useAppStore.getState().recentLookups).toHaveLength(1)
  })
})
