import { getRedis } from './redis.js'

// Best-effort response cache backed by the shared Redis client. Both helpers are
// no-ops (cache always misses) when Redis is unconfigured, and swallow Redis
// errors so a cache outage never breaks a lookup — it just costs a fresh fetch.
// @upstash/redis serializes/deserializes JSON values automatically.

export async function cacheGet<T>(key: string): Promise<T | null> {
  const redis = getRedis()
  if (!redis) return null
  try {
    return (await redis.get<T>(key)) ?? null
  } catch {
    return null
  }
}

export async function cacheSet<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
  const redis = getRedis()
  if (!redis) return
  try {
    await redis.set(key, value, { ex: ttlSeconds })
  } catch {
    // ignore — caching is best-effort
  }
}
