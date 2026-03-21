import { Component, ReactNode, ErrorInfo } from 'react';

interface ErrorBoundaryProps {
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
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-sky-600 to-indigo-700" role="alert">
          <div className="max-w-2xl w-full bg-white rounded-xl shadow-2xl p-8">
            <h2 className="text-2xl font-bold text-red-600 mb-4">❌ Une erreur est survenue</h2>
            <p className="text-gray-700 mb-6">
              Quelque chose s'est mal passé. L'équipe technique a été notifiée.
            </p>
            
            {this.state.error && (
              <details className="mb-6 bg-gray-50 rounded-lg p-4 border border-gray-200">
                <summary className="cursor-pointer text-sm font-semibold text-gray-700 hover:text-sky-600">
                  Détails techniques
                </summary>
                <pre className="mt-3 text-xs text-gray-800 overflow-auto max-h-64 bg-white p-3 rounded border border-gray-200">
                  <strong>Erreur:</strong> {this.state.error.toString()}
                  {this.state.errorInfo && (
                    <>
                      {'\n\n'}
                      <strong>Stack trace:</strong>
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
                🔄 Réessayer
              </button>
              <button 
                onClick={() => window.location.href = '/'} 
                className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg font-semibold hover:bg-gray-300 transition-all"
              >
                🏠 Retour à l'accueil
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
