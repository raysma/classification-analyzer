import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import FeedbackModal from './FeedbackModal'

const originalFetch = globalThis.fetch

beforeEach(() => {
  Object.defineProperty(window, 'innerWidth', { value: 1440, configurable: true })
  Object.defineProperty(window, 'innerHeight', { value: 900, configurable: true })
})

afterEach(() => {
  globalThis.fetch = originalFetch
  vi.restoreAllMocks()
})

describe('FeedbackModal', () => {
  it('disables submit while title or description are below the minimum', () => {
    render(<FeedbackModal onClose={() => {}} />)
    const submit = screen.getByRole('button', { name: /submit/i })
    expect(submit).toBeDisabled()

    fireEvent.change(screen.getByLabelText(/title/i), { target: { value: 'short' } })
    expect(submit).toBeDisabled()

    fireEvent.change(screen.getByLabelText(/description/i), {
      target: { value: 'short desc' },
    })
    expect(submit).not.toBeDisabled()
  })

  it('shows a friendly error when the server returns an error code', async () => {
    globalThis.fetch = vi.fn<typeof fetch>(
      async () =>
        new Response(JSON.stringify({ error: 'rate_limited' }), { status: 429 }),
    )
    render(<FeedbackModal onClose={() => {}} />)
    fireEvent.change(screen.getByLabelText(/title/i), {
      target: { value: 'A reasonable title' },
    })
    fireEvent.change(screen.getByLabelText(/description/i), {
      target: { value: 'A reasonable description of the issue.' },
    })
    fireEvent.click(screen.getByRole('button', { name: /submit/i }))

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/several reports recently/i)
    })
  })

  it('sends a fully-null context when the anonymous checkbox is checked', async () => {
    const fetchSpy = vi.fn<typeof fetch>(
      async () =>
        new Response(
          JSON.stringify({
            ok: true,
            issueUrl: 'https://github.com/o/r/issues/9',
            issueNumber: 9,
          }),
          { status: 200 },
        ),
    )
    globalThis.fetch = fetchSpy
    render(<FeedbackModal onClose={() => {}} />)
    fireEvent.change(screen.getByLabelText(/title/i), {
      target: { value: 'A reasonable title' },
    })
    fireEvent.change(screen.getByLabelText(/description/i), {
      target: { value: 'A reasonable description of the issue.' },
    })
    fireEvent.click(screen.getByLabelText(/submit anonymously/i))
    fireEvent.click(screen.getByRole('button', { name: /submit/i }))

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalled()
    })
    const init = fetchSpy.mock.calls[0]![1] as RequestInit
    const sent = JSON.parse(String(init.body)) as {
      context: Record<string, unknown>
    }
    expect(sent.context.appSha).toBeNull()
    expect(sent.context.url).toBeNull()
    expect(sent.context.memberNumber).toBeNull()
    expect(sent.context.division).toBeNull()
    expect(sent.context.userAgent).toBeNull()
    expect(sent.context.viewport).toBeNull()
    expect(typeof sent.context.timestamp).toBe('string')
  })

  it('renders the success pane with an issue link on 200', async () => {
    globalThis.fetch = vi.fn<typeof fetch>(
      async () =>
        new Response(
          JSON.stringify({
            ok: true,
            issueUrl: 'https://github.com/o/r/issues/7',
            issueNumber: 7,
          }),
          { status: 200 },
        ),
    )
    render(<FeedbackModal onClose={() => {}} />)
    fireEvent.change(screen.getByLabelText(/title/i), {
      target: { value: 'A reasonable title' },
    })
    fireEvent.change(screen.getByLabelText(/description/i), {
      target: { value: 'A reasonable description of the issue.' },
    })
    fireEvent.click(screen.getByRole('button', { name: /submit/i }))

    await waitFor(() => {
      const link = screen.getByRole('link', { name: /issue #7/i })
      expect(link).toHaveAttribute('href', 'https://github.com/o/r/issues/7')
    })
  })
})
