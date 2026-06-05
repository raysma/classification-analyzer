import { Redis } from '@upstash/redis'

// A single REST Redis client shared by the rate limiter and the response cache.
// Resolved lazily and cached for the lifetime of the warm function instance.
// Supports both the Upstash-native env names and the Vercel KV integration's
// (KV_REST_API_*) — they are the same Upstash REST endpoint under the hood.
// When neither is configured (local dev, or before the integration is added),
// this returns null and callers fall back to in-memory / no-op behavior.

let client: Redis | null | undefined

export function getRedis(): Redis | null {
  if (client !== undefined) return client

  const url = process.env['UPSTASH_REDIS_REST_URL'] ?? process.env['KV_REST_API_URL'] ?? ''
  const token = process.env['UPSTASH_REDIS_REST_TOKEN'] ?? process.env['KV_REST_API_TOKEN'] ?? ''

  client = url && token ? new Redis({ url, token }) : null
  return client
}
