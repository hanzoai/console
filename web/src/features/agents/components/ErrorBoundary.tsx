import React, { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import { Alert } from '@/src/features/agents/components/ui/alert';
import { Button } from '@/src/features/agents/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/src/features/agents/components/ui/card';
import { WarningFilled, Restart } from '@/src/features/agents/components/ui/icon-bridge';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  resetOnPropsChange?: boolean;
  resetKeys?: Array<string | number>;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  errorId: string;
}

/**
 * Error Boundary component for graceful error handling in MCP UI components
 * Provides fallback UI and error reporting capabilities
 */
export class ErrorBoundary extends Component<Props, State> {
  private resetTimeoutId: number | null = null;

  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: ''
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    // Update state so the next render will show the fallback UI
    return {
      hasError: true,
      error,
      errorId: `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log error details
    console.error('ErrorBoundary caught an error:', error, errorInfo);

    this.setState({
      error,
      errorInfo
    });

    // Call optional error handler
    this.props.onError?.(error, errorInfo);

    // Auto-reset after 30 seconds for transient errors
    this.resetTimeoutId = window.setTimeout(() => {
      this.handleReset();
    }, 30000);
  }

  componentDidUpdate(prevProps: Props) {
    const { resetOnPropsChange, resetKeys } = this.props;
    const { hasError } = this.state;

    // Reset error state when specified props change
    if (hasError && resetOnPropsChange && resetKeys) {
      const hasResetKeyChanged = resetKeys.some((key, index) =>
        prevProps.resetKeys?.[index] !== key
      );

      if (hasResetKeyChanged) {
        this.handleReset();
      }
    }
  }

  componentWillUnmount() {
    if (this.resetTimeoutId) {
      clearTimeout(this.resetTimeoutId);
    }
  }

  handleReset = () => {
    if (this.resetTimeoutId) {
      clearTimeout(this.resetTimeoutId);
      this.resetTimeoutId = null;
    }

    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: ''
    });
  };

  render() {
    const { hasError, error, errorInfo } = this.state;
    const { children, fallback } = this.props;

    if (hasError) {
      // Custom fallback UI
      if (fallback) {
        return fallback;
      }

      // Default error UI
      return (
        <Card className="border-destructive">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <WarningFilled size={20} />
              Something went wrong
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert variant="destructive">
              <div className="space-y-2">
                <p className="font-medium">
                  {error?.name || 'Error'}: {error?.message || 'An unexpected error occurred'}
                </p>

                {process.env.NODE_ENV === 'development' && errorInfo && (
                  <details className="mt-2">
                    <summary className="cursor-pointer text-sm font-medium">
                      Technical Details (Development)
                    </summary>
                    <pre className="mt-2 text-xs bg-muted p-2 rounded overflow-auto max-h-40">
                      {error?.stack}
                      {'\n\nComponent Stack:'}
                      {errorInfo.componentStack}
                    </pre>
                  </details>
                )}
              </div>
            </Alert>

            <div className="flex gap-2">
              <Button onClick={this.handleReset} variant="outline" size="sm">
                <Restart size={16} className="mr-2" />
                Try Again
              </Button>

              <Button
                onClick={() => window.location.reload()}
                variant="secondary"
                size="sm"
              >
                Reload Page
              </Button>
            </div>

            <p className="text-body-small">
              Error ID: {this.state.errorId}
            </p>
          </CardContent>
        </Card>
      );
    }

    return children;
  }
}

/**
 * Higher-order component for wrapping components with error boundary
 */
export function withErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  errorBoundaryProps?: Omit<Props, 'children'>
) {
  const WrappedComponent = (props: P) => (
    <ErrorBoundary {...errorBoundaryProps}>
      <Component {...props} />
    </ErrorBoundary>
  );

  WrappedComponent.displayName = `withErrorBoundary(${Component.displayName || Component.name})`;

  return WrappedComponent;
}

/**
 * Hook for error boundary integration in functional components
 */
export function useErrorHandler() {
  return (error: Error, errorInfo?: ErrorInfo) => {
    // In a real app, you might want to send this to an error reporting service
    console.error('Manual error report:', error, errorInfo);

    // For now, just throw to trigger the nearest error boundary
    throw error;
  };
}

/**
 * MCP-specific error boundary with specialized error handling
 */
export function MCPErrorBoundary({
  children,
  nodeId,
  componentName
}: {
  children: ReactNode;
  nodeId?: string;
  componentName?: string;
}) {
  const handleError = (error: Error, errorInfo: ErrorInfo) => {
    // Log MCP-specific error context
    console.error(`MCP Error in ${componentName || 'Unknown Component'}:`, {
      nodeId,
      error: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      timestamp: new Date().toISOString()
    });
  };

  const fallback = (
    <Alert variant="destructive" className="m-4">
      <WarningFilled className="h-4 w-4" />
      <div>
        <h4 className="font-medium">MCP Component Error</h4>
        <p className="text-sm mt-1">
          {componentName ? `The ${componentName} component` : 'This MCP component'}
          {' '}encountered an error and couldn't be displayed.
          {nodeId && ` (Node: ${nodeId})`}
        </p>
        <Button
          variant="outline"
          size="sm"
          className="mt-2"
          onClick={() => window.location.reload()}
        >
          Refresh Page
        </Button>
      </div>
    </Alert>
  );

  return (
    <ErrorBoundary
      onError={handleError}
      fallback={fallback}
      resetOnPropsChange={true}
      resetKeys={[nodeId, componentName].filter(Boolean) as string[]}
    >
      {children}
    </ErrorBoundary>
  );
}
