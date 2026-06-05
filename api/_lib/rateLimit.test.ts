import { describe, it, expect, beforeEach } from 'vitest'
import { checkRateLimit } from './rateLimit'

// With no Redis env configured, checkRateLimit uses the in-memory fallback.
beforeEach(() => {
  delete process.env['UPSTASH_REDIS_REST_URL']
  delete process.env['UPSTASH_REDIS_REST_TOKEN']
  delete process.env['KV_REST_API_URL']
  delete process.env['KV_REST_API_TOKEN']
})

describe('checkRateLimit (in-memory fallback)', () => {
  it('allows up to max requests then blocks', async () => {
    const cfg = { prefix: 'test-a', max: 3, windowSeconds: 60 }
    expect(await checkRateLimit('1.1.1.1', cfg)).toBe(true)
    expect(await checkRateLimit('1.1.1.1', cfg)).toBe(true)
    expect(await checkRateLimit('1.1.1.1', cfg)).toBe(true)
    expect(await checkRateLimit('1.1.1.1', cfg)).toBe(false)
  })

  it('counts each IP independently', async () => {
    const cfg = { prefix: 'test-b', max: 1, windowSeconds: 60 }
    expect(await checkRateLimit('2.2.2.2', cfg)).toBe(true)
    expect(await checkRateLimit('2.2.2.2', cfg)).toBe(false)
    expect(await checkRateLimit('3.3.3.3', cfg)).toBe(true)
  })

  it('keeps separate counters per prefix', async () => {
    expect(await checkRateLimit('4.4.4.4', { prefix: 'test-c', max: 1, windowSeconds: 60 })).toBe(
      true,
    )
    // same IP, different endpoint prefix — independent budget
    expect(await checkRateLimit('4.4.4.4', { prefix: 'test-d', max: 1, windowSeconds: 60 })).toBe(
      true,
    )
  })
})
