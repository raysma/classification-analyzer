import { getRedis } from './redis.js'

export interface RateLimitConfig {
  prefix: string
  max: number
  windowSeconds: number
}

// Per-instance fallback used when Redis is unconfigured or unreachable. This is
// the same fixed-window counter the endpoints used before; it is imperfect
// across cold-start instances but degrades safely rather than failing open.
const memoryStore = new Map<string, { count: number; resetAt: number }>()

function memoryCheck(key: string, max: number, windowMs: number): boolean {
  const now = Date.now()
  const entry = memoryStore.get(key)
  if (!entry || now >= entry.resetAt) {
    memoryStore.set(key, { count: 1, resetAt: now + windowMs })
    return true
  }
  if (entry.count >= max) return false
  entry.count++
  return true
}

// Durable fixed-window limiter keyed on the trusted client IP. INCR returns the
// new count; the TTL is set only on the first hit of a window so the window
// slides forward correctly. Returns true when the request is allowed.
export async function checkRateLimit(ip: string, cfg: RateLimitConfig): Promise<boolean> {
  const key = `${cfg.prefix}:${ip}`
  const redis = getRedis()
  if (!redis) return memoryCheck(key, cfg.max, cfg.windowSeconds * 1000)

  try {
    const count = await redis.incr(key)
    if (count === 1) await redis.expire(key, cfg.windowSeconds)
    return count <= cfg.max
  } catch {
    // Never let a Redis outage take the endpoint down — fall back to memory.
    return memoryCheck(key, cfg.max, cfg.windowSeconds * 1000)
  }
}
