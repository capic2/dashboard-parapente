import React, { Component, ReactNode, ErrorInfo } from 'react';
import { withTranslation, WithTranslation } from 'react-i18next';

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
    console.error('ErrorBoundary caught an error:', error, errorInfo);
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
        <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-sky-600 to-indigo-700" role="alert">
          <div className="max-w-2xl w-full bg-white rounded-xl shadow-2xl p-8">
            <h2 className="text-2xl font-bold text-red-600 mb-4">❌ {t('errors.errorOccurred')}</h2>
            <p className="text-gray-700 mb-6">
              {t('errors.errorMessage')}
            </p>

            {this.state.error && (
              <details className="mb-6 bg-gray-50 rounded-lg p-4 border border-gray-200">
                <summary className="cursor-pointer text-sm font-semibold text-gray-700 hover:text-sky-600">
                  {t('errors.technicalDetails')}
                </summary>
                <pre className="mt-3 text-xs text-gray-800 overflow-auto max-h-64 bg-white p-3 rounded border border-gray-200">
                  <strong>{t('errors.errorLabel')}</strong> {this.state.error.toString()}
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
                className="px-6 py-3 bg-sky-600 text-white rounded-lg font-semibold hover:bg-sky-700 transition-all hover:shadow-lg"
              >
                🔄 {t('common.retry')}
              </button>
              <button
                onClick={() => window.location.href = '/'}
                className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg font-semibold hover:bg-gray-300 transition-all"
              >
                🏠 {t('common.backToHome')}
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

const ErrorBoundaryWithTranslation: React.ComponentType<Omit<ErrorBoundaryProps, keyof WithTranslation>> = withTranslation()(ErrorBoundary);
export default ErrorBoundaryWithTranslation;
