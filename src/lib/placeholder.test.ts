import { describe, it, expect } from 'vitest'

describe('scaffold', () => {
  it('types are importable', async () => {
    const { } = await import('../types/index')
    expect(true).toBe(true)
  })
})
