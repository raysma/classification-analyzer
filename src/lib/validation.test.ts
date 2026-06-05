import { describe, it, expect } from 'vitest'
import { FeedbackResponseSchema, RecentLookupSchema, ShooterRecordSchema } from './validation'

describe('FeedbackResponseSchema.issueUrl', () => {
  it('accepts a github.com issue URL', () => {
    const r = FeedbackResponseSchema.safeParse({
      ok: true,
      issueUrl: 'https://github.com/raysma/classification-analyzer/issues/1',
      issueNumber: 1,
    })
    expect(r.success).toBe(true)
  })

  it('rejects a non-github URL (e.g. javascript: or other host)', () => {
    for (const issueUrl of [
      'https://evil.example.com/issues/1',
      'http://github.com/x/y/issues/1', // not https
      'javascript:alert(1)',
    ]) {
      expect(FeedbackResponseSchema.safeParse({ ok: true, issueUrl, issueNumber: 1 }).success).toBe(
        false,
      )
    }
  })
})

describe('RecentLookupSchema', () => {
  it('accepts a well-formed entry', () => {
    expect(
      RecentLookupSchema.safeParse({
        memberNumber: 'A12345',
        name: 'Jane Smith',
        lastLookedUpAt: '2026-06-06T00:00:00.000Z',
      }).success,
    ).toBe(true)
  })

  it('rejects malformed/oversized entries', () => {
    expect(RecentLookupSchema.safeParse({ memberNumber: 'A1' }).success).toBe(false)
    expect(
      RecentLookupSchema.safeParse({
        memberNumber: 'A1',
        name: 'x'.repeat(5000),
        lastLookedUpAt: '2026',
      }).success,
    ).toBe(false)
  })
})

describe('ShooterRecordSchema bounds', () => {
  it('rejects an absurdly long name (DoS hardening)', () => {
    const base = {
      memberNumber: 'A12345',
      name: 'x'.repeat(10_000),
      membershipType: 'Annual' as const,
      currentClasses: {},
      classifiers: {},
      fetchedAt: '2026-06-06T00:00:00.000Z',
      source: 'fetch' as const,
    }
    expect(ShooterRecordSchema.safeParse(base).success).toBe(false)
  })
})
