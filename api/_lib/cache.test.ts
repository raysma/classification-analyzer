import { describe, it, expect, beforeEach } from 'vitest'
import { cacheGet, cacheSet } from './cache'

// With no Redis env configured, the cache is a no-op: gets miss, sets do nothing.
beforeEach(() => {
  delete process.env['UPSTASH_REDIS_REST_URL']
  delete process.env['UPSTASH_REDIS_REST_TOKEN']
  delete process.env['KV_REST_API_URL']
  delete process.env['KV_REST_API_TOKEN']
})

describe('cache (no-op when Redis unconfigured)', () => {
  it('cacheGet returns null', async () => {
    expect(await cacheGet('whatever')).toBeNull()
  })

  it('cacheSet does not throw and a subsequent get still misses', async () => {
    await expect(cacheSet('k', { a: 1 }, 60)).resolves.toBeUndefined()
    expect(await cacheGet('k')).toBeNull()
  })
})
