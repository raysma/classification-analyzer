import type { VercelRequest } from '@vercel/node'

// Vercel sets `x-real-ip` to the true client IP and appends that same IP as the
// LAST hop of `x-forwarded-for`. A client-supplied `x-forwarded-for` is preserved
// and prepended-to, so the leftmost entry is attacker-controlled — trusting it lets
// a caller rotate a fake IP per request and defeat per-IP rate limiting. Prefer
// `x-real-ip`, fall back to the last XFF hop, then the socket address.
export function getClientIp(req: VercelRequest): string {
  const realIp = req.headers['x-real-ip']
  if (typeof realIp === 'string' && realIp.trim()) return realIp.trim()

  const xff = req.headers['x-forwarded-for']
  if (typeof xff === 'string' && xff.trim()) {
    const hops = xff.split(',')
    const last = hops[hops.length - 1]?.trim()
    if (last) return last
  }

  return req.socket.remoteAddress?.trim() || 'unknown'
}
