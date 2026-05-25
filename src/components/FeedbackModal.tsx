import { useState, type FormEvent } from 'react'
import { createPortal } from 'react-dom'
import { useAppStore } from '../store/useAppStore'
import { submitFeedback, FeedbackError } from '../api/feedback'
import type { FeedbackInput, FeedbackType } from '../lib/validation'

interface Props {
  onClose: () => void
}

const TITLE_MIN = 3
const TITLE_MAX = 120
const DESC_MIN = 10
const DESC_MAX = 4000

const TYPE_LABELS: Array<{ value: FeedbackType; label: string }> = [
  { value: 'bug', label: 'Bug' },
  { value: 'feature_request', label: 'Feature request' },
  { value: 'other', label: 'Other' },
]

function friendlyError(code: string): string {
  switch (code) {
    case 'feedback_not_configured':
      return 'Feedback is temporarily unavailable — the server is missing a credential. Please try again later.'
    case 'rate_limited':
      return 'You’ve submitted several reports recently. Please wait a few minutes and try again.'
    case 'github_rate_limited':
      return 'GitHub is currently rate-limiting our requests. Please try again in a few minutes.'
    case 'github_auth_failed':
      return 'The feedback service couldn’t authenticate with GitHub. We’ve been notified.'
    case 'github_rejected':
      return 'GitHub rejected the submission. Try shortening the title or description.'
    case 'github_unavailable':
      return 'GitHub is unavailable right now. Please try again in a few minutes.'
    case 'upstream_timeout':
      return 'The request timed out talking to GitHub. Please try again.'
    case 'invalid_input':
      return 'Some of the fields didn’t pass validation. Adjust them and try again.'
    case 'network_error':
      return 'Network error sending your feedback. Check your connection and try again.'
    default:
      return `Something went wrong (${code}). Please try again.`
  }
}

function buildContext(anonymous: boolean): FeedbackInput['context'] {
  const timestamp = new Date().toISOString()
  if (anonymous) {
    return {
      appSha: null,
      url: null,
      memberNumber: null,
      division: null,
      userAgent: null,
      viewport: null,
      timestamp,
    }
  }
  const state = useAppStore.getState()
  const sha = (import.meta.env['VITE_APP_SHA'] as string | undefined) ?? null
  return {
    appSha: sha,
    url: window.location.href,
    memberNumber: state.memberNumber || null,
    division: state.selectedDivision,
    userAgent: navigator.userAgent.slice(0, 500),
    viewport: `${window.innerWidth}x${window.innerHeight}`,
    timestamp,
  }
}

export default function FeedbackModal({ onClose }: Props) {
  const [type, setType] = useState<FeedbackType>('bug')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [anonymous, setAnonymous] = useState(false)
  const [errorCode, setErrorCode] = useState<string | null>(null)
  const [success, setSuccess] = useState<{ issueUrl: string; issueNumber: number } | null>(null)

  const trimmedTitle = title.trim()
  const trimmedDesc = description.trim()
  const titleValid = trimmedTitle.length >= TITLE_MIN && trimmedTitle.length <= TITLE_MAX
  const descValid = trimmedDesc.length >= DESC_MIN && trimmedDesc.length <= DESC_MAX
  const formValid = titleValid && descValid

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!formValid || submitting) return
    setSubmitting(true)
    setErrorCode(null)
    try {
      const result = await submitFeedback({
        type,
        title: trimmedTitle,
        description: trimmedDesc,
        context: buildContext(anonymous),
      })
      setSuccess(result)
    } catch (err) {
      if (err instanceof FeedbackError) {
        setErrorCode(err.code)
      } else {
        setErrorCode('unknown_error')
      }
    } finally {
      setSubmitting(false)
    }
  }

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-lg max-h-[80vh] overflow-y-auto rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="feedback-modal-title"
      >
        <div className="sticky top-0 flex items-center justify-between border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-5 py-4">
          <h2 id="feedback-modal-title" className="text-base font-semibold text-gray-900 dark:text-gray-100">
            Send feedback
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close feedback"
            className="rounded p-1 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              className="w-5 h-5"
              aria-hidden="true"
            >
              <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
            </svg>
          </button>
        </div>

        {success ? (
          <div className="px-5 py-6 space-y-4">
            <p className="text-sm text-gray-700 dark:text-gray-300">
              Thanks! Your feedback was filed as{' '}
              <a
                href={success.issueUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-blue-600 dark:text-blue-400 hover:underline"
              >
                issue #{success.issueNumber}
              </a>
              .
            </p>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={onClose}
                className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
              >
                Close
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="px-5 py-4 space-y-4">
            <div className="space-y-1">
              <label
                htmlFor="feedback-type"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300"
              >
                Type
              </label>
              <select
                id="feedback-type"
                value={type}
                onChange={(e) => setType(e.target.value as FeedbackType)}
                disabled={submitting}
                className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-3 py-2 text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {TYPE_LABELS.map((t) => (
                  <option
                    key={t.value}
                    value={t.value}
                    className="bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                  >
                    {t.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label
                htmlFor="feedback-title"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300"
              >
                Title
              </label>
              <input
                id="feedback-title"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                disabled={submitting}
                maxLength={TITLE_MAX}
                placeholder="Short summary"
                className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 px-3 py-2 text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 text-right">
                {trimmedTitle.length}/{TITLE_MAX}
              </p>
            </div>

            <div className="space-y-1">
              <label
                htmlFor="feedback-description"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300"
              >
                Description
              </label>
              <textarea
                id="feedback-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                disabled={submitting}
                rows={6}
                maxLength={DESC_MAX}
                placeholder="What happened, what you expected, steps to reproduce…"
                className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 px-3 py-2 text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 text-right">
                {trimmedDesc.length}/{DESC_MAX}
              </p>
            </div>

            <div className="rounded-md bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 px-3 py-2 text-xs text-amber-800 dark:text-amber-200 space-y-2">
              <p>
                Submissions become public GitHub Issues. We attach your app version, the current
                URL (which may contain your member number), division, browser, and viewport size
                to help reproduce issues. Don&apos;t include anything that you don&apos;t want to
                be made public.
              </p>
              <label className="flex items-start gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={anonymous}
                  onChange={(e) => setAnonymous(e.target.checked)}
                  disabled={submitting}
                  className="mt-0.5 rounded border-amber-300 dark:border-amber-700 text-blue-600 focus:ring-blue-500"
                />
                <span>
                  Submit anonymously — don&apos;t attach app version, URL, member number, division,
                  browser, or viewport size.
                </span>
              </label>
            </div>

            {errorCode && (
              <div
                role="alert"
                className="rounded-md bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 px-3 py-2 text-sm text-red-800 dark:text-red-200"
              >
                {friendlyError(errorCode)}
              </div>
            )}

            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                disabled={submitting}
                className="rounded-md px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!formValid || submitting}
                aria-busy={submitting}
                className="relative inline-flex items-center justify-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <span className={submitting ? 'invisible' : ''}>Submit</span>
                {submitting && (
                  <svg
                    className="absolute animate-spin h-4 w-4"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>,
    document.body,
  )
}
