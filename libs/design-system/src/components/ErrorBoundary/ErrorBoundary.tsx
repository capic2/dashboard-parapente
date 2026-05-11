import type { ReactNode, ErrorInfo } from 'react';
import React, { Component } from 'react';
import type { WithTranslation } from 'react-i18next';
import { withTranslation } from 'react-i18next';

interface ErrorBoundaryProps extends WithTranslation {
  children: ReactNode;
  fallback?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    this.setState({
      error,
      errorInfo,
    });
  }

  handleReset = (): void => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  render(): ReactNode {
    const { t } = this.props;

    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div
          className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-sky-600 to-indigo-700"
          role="alert"
        >
          <div className="max-w-2xl w-full bg-white dark:bg-gray-800 rounded-xl shadow-2xl p-8">
            <h2 className="flex items-center gap-2 text-2xl font-bold text-red-600 dark:text-red-400 mb-4">
              <svg
                aria-hidden="true"
                className="h-6 w-6 shrink-0"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2}
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z"
                />
              </svg>
              {t('errors.errorOccurred')}
            </h2>
            <p className="text-gray-700 dark:text-gray-300 mb-6">
              {t('errors.errorMessage')}
            </p>

            {this.state.error &&
              typeof window !== 'undefined' &&
              window.location.hostname === 'localhost' && (
                <details className="mb-6 bg-gray-50 dark:bg-gray-900 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                  <summary className="cursor-pointer text-sm font-semibold text-gray-700 dark:text-gray-300 hover:text-sky-600">
                    {t('errors.technicalDetails')}
                  </summary>
                  <pre className="mt-3 text-xs text-gray-800 dark:text-gray-200 overflow-auto max-h-64 bg-white dark:bg-gray-800 p-3 rounded border border-gray-200 dark:border-gray-700">
                    <strong>{t('errors.errorLabel')}</strong>{' '}
                    {this.state.error.toString()}
                    {this.state.errorInfo && (
                      <>
                        {'\n\n'}
                        <strong>{t('errors.stackTrace')}</strong>
                        {this.state.errorInfo.componentStack}
                      </>
                    )}
                  </pre>
                </details>
              )}

            <div className="flex gap-3 flex-wrap">
              <button
                onClick={this.handleReset}
                className="cursor-pointer px-6 py-3 bg-sky-600 text-white rounded-lg font-semibold hover:bg-sky-700 transition-colors hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2"
              >
                {t('common.retry')}
              </button>
              <button
                onClick={() => (window.location.href = '/')}
                className="cursor-pointer px-6 py-3 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-lg font-semibold hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-800"
              >
                {t('common.backToHome')}
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

const ErrorBoundaryWithTranslation: React.ComponentType<
  Omit<ErrorBoundaryProps, keyof WithTranslation>
> = withTranslation()(ErrorBoundary);
export default ErrorBoundaryWithTranslation;
