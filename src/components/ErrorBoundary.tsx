import { Component, type ReactNode } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  override render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-white dark:bg-gray-950 p-8">
          <div className="max-w-md space-y-4 text-center">
            <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">
              Something went wrong
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              An unexpected error occurred. You can try refreshing the page.
            </p>
            {this.state.error && (
              <pre className="text-left text-xs bg-gray-100 dark:bg-gray-800 rounded p-3 overflow-auto">
                {this.state.error.message}
              </pre>
            )}
            <div className="flex gap-3 justify-center">
              <button
                onClick={() => window.location.reload()}
                className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
              >
                Reload
              </button>
              <a
                href="https://github.com/raysma/classification-analyzer/issues"
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-md border border-gray-300 dark:border-gray-600 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
              >
                Report issue
              </a>
            </div>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
