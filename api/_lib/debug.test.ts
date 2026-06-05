import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import type { VercelRequest } from '@vercel/node'
import { debugAuthorized } from './debug'

const original = process.env['DEBUG_SNIPPET_TOKEN']

function req(
  headers: Record<string, string> = {},
  query: Record<string, string> = {},
): VercelRequest {
  return { headers, query } as unknown as VercelRequest
}

afterEach(() => {
  if (original === undefined) delete process.env['DEBUG_SNIPPET_TOKEN']
  else process.env['DEBUG_SNIPPET_TOKEN'] = original
})

describe('debugAuthorized', () => {
  beforeEach(() => {
    delete process.env['DEBUG_SNIPPET_TOKEN']
  })

  it('is false when no token is configured, even with a request token', () => {
    expect(debugAuthorized(req({ 'x-debug-token': 'anything' }))).toBe(false)
  })

  it('is false when configured but the request omits the token', () => {
    process.env['DEBUG_SNIPPET_TOKEN'] = 'secret'
    expect(debugAuthorized(req())).toBe(false)
  })

  it('is false when the token does not match', () => {
    process.env['DEBUG_SNIPPET_TOKEN'] = 'secret'
    expect(debugAuthorized(req({ 'x-debug-token': 'wrong' }))).toBe(false)
  })

  it('accepts a matching header token', () => {
    process.env['DEBUG_SNIPPET_TOKEN'] = 'secret'
    expect(debugAuthorized(req({ 'x-debug-token': 'secret' }))).toBe(true)
  })

  it('accepts a matching query token', () => {
    process.env['DEBUG_SNIPPET_TOKEN'] = 'secret'
    expect(debugAuthorized(req({}, { debug: 'secret' }))).toBe(true)
  })
})
