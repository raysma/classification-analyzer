import type { VercelRequest } from '@vercel/node'
import { timingSafeEqual } from 'node:crypto'

// Debug payloads (raw scraped HTML snippets, Zod issue lists, upstream error
// bodies) are useful when diagnosing a parser break, but they leak internal
// detail. Preview deployments are publicly reachable, so gating on `!IS_PROD`
// alone exposed them. Instead, emit debug detail only when DEBUG_SNIPPET_TOKEN
// is configured AND the request presents the matching token (header or query).
// When the env var is unset (the default), debug output is never produced.
export function debugAuthorized(req: VercelRequest): boolean {
  const expected = process.env['DEBUG_SNIPPET_TOKEN'] ?? ''
  if (!expected) return false

  const header = req.headers['x-debug-token']
  const query = req.query['debug']
  const provided =
    (typeof header === 'string' && header) || (typeof query === 'string' && query) || ''
  if (!provided) return false

  const a = Buffer.from(expected)
  const b = Buffer.from(provided)
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}
