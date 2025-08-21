import React, { Component, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
}

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    // Update state so the next render will show the fallback UI
    return {
      hasError: true,
      error
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Log error details
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    
    // Update state with error info
    this.setState({
      error,
      errorInfo
    });

    // Call custom error handler if provided
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }

    // In production, you might want to log to an error reporting service
    if (process.env.NODE_ENV === 'production') {
      // Example: logErrorToService(error, errorInfo);
    }
  }

  handleRetry = () => {
    // Reset error state to retry rendering
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null
    });
  };

  handleReload = () => {
    // Reload the page
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      // Custom fallback UI
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default fallback UI
      return (
        <div className="min-h-screen bg-background flex items-center justify-center p-4">
          <Card className="w-full max-w-md">
            <CardHeader className="text-center">
              <div className="mx-auto mb-4 w-12 h-12 bg-destructive/10 rounded-full flex items-center justify-center">
                <AlertTriangle className="h-6 w-6 text-destructive" />
              </div>
              <CardTitle className="text-xl">Something went wrong</CardTitle>
              <CardDescription>
                An unexpected error occurred in the application
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Error details for development */}
              {process.env.NODE_ENV === 'development' && this.state.error && (
                <div className="space-y-2">
                  <details className="text-sm">
                    <summary className="cursor-pointer font-medium text-muted-foreground hover:text-foreground">
                      Error Details
                    </summary>
                    <div className="mt-2 p-3 bg-muted rounded-md">
                      <p className="font-semibold text-destructive mb-2">
                        {this.state.error.name}: {this.state.error.message}
                      </p>
                      <pre className="text-xs overflow-auto whitespace-pre-wrap">
                        {this.state.error.stack}
                      </pre>
                    </div>
                  </details>
                  
                  {this.state.errorInfo && (
                    <details className="text-sm">
                      <summary className="cursor-pointer font-medium text-muted-foreground hover:text-foreground">
                        Component Stack
                      </summary>
                      <div className="mt-2 p-3 bg-muted rounded-md">
                        <pre className="text-xs overflow-auto whitespace-pre-wrap">
                          {this.state.errorInfo.componentStack}
                        </pre>
                      </div>
                    </details>
                  )}
                </div>
              )}

              {/* Action buttons */}
              <div className="flex flex-col sm:flex-row gap-3">
                <Button
                  onClick={this.handleRetry}
                  className="flex-1"
                  variant="default"
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Try Again
                </Button>
                <Button
                  onClick={this.handleReload}
                  variant="outline"
                  className="flex-1"
                >
                  <Home className="h-4 w-4 mr-2" />
                  Reload Page
                </Button>
              </div>

              {/* Help text */}
              <div className="text-center text-sm text-muted-foreground">
                <p>
                  If this problem persists, try refreshing the page or contact support.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;

// Higher-order component for wrapping components with error boundary
export function withErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  errorBoundaryProps?: Omit<ErrorBoundaryProps, 'children'>
) {
  const WrappedComponent = (props: P) => (
    <ErrorBoundary {...errorBoundaryProps}>
      <Component {...props} />
    </ErrorBoundary>
  );
  
  WrappedComponent.displayName = `withErrorBoundary(${Component.displayName || Component.name})`;
  
  return WrappedComponent;
}

// Hook for error reporting in functional components
export function useErrorHandler() {
  return (error: Error, errorInfo?: any) => {
    console.error('Manual error report:', error, errorInfo);
    
    // In production, log to error reporting service
    if (process.env.NODE_ENV === 'production') {
      // Example: logErrorToService(error, errorInfo);
    }
    
    // Re-throw the error so it can be caught by error boundary
    throw error;
  };
}
