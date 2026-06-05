import { describe, it, expect } from 'vitest'
import type { VercelRequest } from '@vercel/node'
import { getClientIp } from './clientIp'

function req(headers: Record<string, string | string[]>, remoteAddress = '9.9.9.9'): VercelRequest {
  return { headers, socket: { remoteAddress } } as unknown as VercelRequest
}

describe('getClientIp', () => {
  it('prefers x-real-ip over x-forwarded-for', () => {
    expect(getClientIp(req({ 'x-real-ip': '5.5.5.5', 'x-forwarded-for': '1.1.1.1' }))).toBe(
      '5.5.5.5',
    )
  })

  it('uses the LAST x-forwarded-for hop, not the spoofable leftmost', () => {
    // attacker prepends a fake IP; Vercel appends the real one as the last hop
    expect(getClientIp(req({ 'x-forwarded-for': '6.6.6.6, 8.8.8.8' }))).toBe('8.8.8.8')
  })

  it('a rotating spoofed leftmost XFF maps to the same trusted IP', () => {
    const a = getClientIp(req({ 'x-forwarded-for': 'rotating-1, 8.8.8.8' }))
    const b = getClientIp(req({ 'x-forwarded-for': 'rotating-2, 8.8.8.8' }))
    expect(a).toBe('8.8.8.8')
    expect(b).toBe('8.8.8.8')
  })

  it('falls back to the socket address when no proxy headers are present', () => {
    expect(getClientIp(req({}))).toBe('9.9.9.9')
  })

  it('returns "unknown" when nothing is available', () => {
    expect(getClientIp(req({}, ''))).toBe('unknown')
  })
})
