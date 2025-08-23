import { useCallback } from 'react';
import { notificationService } from '@/services/NotificationService';

export interface ErrorContext {
  component?: string;
  action?: string;
  metadata?: Record<string, unknown>;
}

export interface ErrorHandlerOptions {
  showNotification?: boolean;
  notificationDuration?: number;
  logToConsole?: boolean;
  onError?: (error: Error, context?: ErrorContext) => void;
}

/**
 * Custom hook for centralized error handling
 * Provides consistent error reporting, logging, and user notification
 */
export function useErrorHandler(options: ErrorHandlerOptions = {}) {
  const {
    showNotification = true,
    notificationDuration = 5000,
    logToConsole = true,
    onError,
  } = options;

  const handleError = useCallback(
    (error: Error | string, context?: ErrorContext) => {
      const errorObj = typeof error === 'string' ? new Error(error) : error;

      // Log to console in development
      if (logToConsole && import.meta.env.DEV) {
        console.error('Error handled:', {
          error: errorObj,
          context,
          stack: errorObj.stack,
        });
      }

      // Show user notification
      if (showNotification) {
        const message = getErrorMessage(errorObj);
        notificationService.error(message, {
          duration: notificationDuration,
        });
      }

      // Call custom error handler
      onError?.(errorObj, context);

      // In production, you might want to send to error reporting service
      if (import.meta.env.PROD) {
        // Example: sendToErrorReportingService(errorObj, context);
      }
    },
    [showNotification, notificationDuration, logToConsole, onError]
  );

  const handleApiError = useCallback(
    (error: unknown, context?: ErrorContext) => {
      let errorMessage = 'An unexpected error occurred';

      if (error instanceof Error) {
        errorMessage = error.message;
      } else if (typeof error === 'string') {
        errorMessage = error;
      } else if (error && typeof error === 'object' && 'message' in error) {
        errorMessage = String((error as { message: unknown }).message);
      }

      handleError(new Error(errorMessage), {
        ...context,
        action: 'api_request',
      });
    },
    [handleError]
  );

  const handleAsyncError = useCallback(
    <T>(
      asyncFn: () => Promise<T>,
      context?: ErrorContext
    ): Promise<T | null> => {
      return asyncFn().catch(error => {
        handleError(error, context);
        return null;
      });
    },
    [handleError]
  );

  return {
    handleError,
    handleApiError,
    handleAsyncError,
  };
}

/**
 * Extract user-friendly error message from Error object
 */
function getErrorMessage(error: Error): string {
  // Handle specific error types
  if (error.message.includes('fetch')) {
    return 'Network error - please check your connection';
  }

  if (error.message.includes('401')) {
    return 'Authentication error - please refresh the page';
  }

  if (error.message.includes('403')) {
    return 'Permission denied';
  }

  if (error.message.includes('404')) {
    return 'Resource not found';
  }

  if (error.message.includes('500')) {
    return 'Server error - please try again later';
  }

  // Return original message for other errors
  return error.message || 'An unexpected error occurred';
}
