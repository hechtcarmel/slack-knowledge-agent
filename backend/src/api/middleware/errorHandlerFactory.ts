import { Request, Response, NextFunction, ErrorRequestHandler, RequestHandler } from 'express';
import { Logger } from '@/utils/logger.js';
import { errorResponseBuilder } from '@/utils/errorResponseBuilder.js';

/**
 * Error handler factory options
 */
export interface ErrorHandlerOptions {
  /** Whether to include stack traces in development */
  includeStack?: boolean;
  /** Whether to log errors */
  logErrors?: boolean;
  /** Custom error logger */
  logger?: Logger;
  /** Environment mode */
  environment?: 'development' | 'production' | 'test';
  /** Whether to send detailed error information */
  sendDetails?: boolean;
}

/**
 * Error handler factory
 *
 * Creates customized error handling middleware based on configuration.
 * Supports different error handling strategies for different environments.
 */
export class ErrorHandlerFactory {
  private static defaultOptions: ErrorHandlerOptions = {
    includeStack: process.env.NODE_ENV === 'development',
    logErrors: true,
    environment: (process.env.NODE_ENV as any) || 'development',
    sendDetails: process.env.NODE_ENV !== 'production',
  };

  /**
   * Create a standard error handler middleware
   */
  public static createErrorHandler(
    options: ErrorHandlerOptions = {}
  ): ErrorRequestHandler {
    const config = { ...this.defaultOptions, ...options };
    const logger = config.logger || Logger.create('ErrorHandler');

    return (
      error: Error,
      req: Request,
      res: Response,
      next: NextFunction
    ): void => {
      // If response already sent, delegate to default Express error handler
      if (res.headersSent) {
        return next(error);
      }

      try {
        // Create error context from request
        const context = errorResponseBuilder.createErrorContext(req);

        // Add stack trace in development
        if (config.includeStack && config.environment === 'development') {
          context.stack = error.stack;
        }

        // Send error response
        errorResponseBuilder.sendErrorResponse(res, error, req, context);
      } catch (handlerError) {
        // If error handler itself fails, log and send generic response
        logger.error('Error handler failed', handlerError as Error, {
          originalError: error.message,
          path: req.path,
          method: req.method,
        });

        if (!res.headersSent) {
          res.status(500).json({
            error: {
              message: 'Internal server error',
              code: 'HANDLER_ERROR',
            },
            timestamp: new Date().toISOString(),
            path: req.path,
          });
        }
      }
    };
  }

  /**
   * Create a 404 handler middleware
   */
  public static createNotFoundHandler(
    options: ErrorHandlerOptions = {}
  ): (req: Request, res: Response) => void {
    const config = { ...this.defaultOptions, ...options };
    const logger = config.logger || Logger.create('NotFoundHandler');

    return (req: Request, res: Response): void => {
      if (config.logErrors) {
        logger.warn('Route not found', {
          method: req.method,
          path: req.path,
          query: req.query,
          ip: req.ip,
          userAgent: req.get('User-Agent'),
        });
      }

      const context = errorResponseBuilder.createErrorContext(req);

      res.status(404).json({
        error: {
          message: `Route ${req.method} ${req.path} not found`,
          code: 'NOT_FOUND',
          requestId: context.requestId,
        },
        timestamp: new Date().toISOString(),
        path: req.path,
        method: req.method,
      });
    };
  }

  /**
   * Create an async error handler wrapper
   */
  public static createAsyncHandler<T extends Request = Request>(
    handler: (req: T, res: Response, next: NextFunction) => Promise<any>
  ): (req: T, res: Response, next: NextFunction) => void {
    return (req: T, res: Response, next: NextFunction): void => {
      Promise.resolve(handler(req, res, next)).catch(next);
    };
  }

  /**
   * Create validation error handler
   */
  public static createValidationErrorHandler(
    options: ErrorHandlerOptions = {}
  ): ErrorRequestHandler {
    const config = { ...this.defaultOptions, ...options };
    const logger = config.logger || Logger.create('ValidationErrorHandler');

    return (
      error: Error,
      req: Request,
      res: Response,
      next: NextFunction
    ): void => {
      // Only handle validation errors
      if (
        error.name !== 'ValidationError' &&
        !error.message?.includes('validation')
      ) {
        return next(error);
      }

      if (config.logErrors) {
        logger.warn('Validation error', {
          error: error.message,
          path: req.path,
          method: req.method,
          body: req.body,
        });
      }

      const context = errorResponseBuilder.createErrorContext(req);

      res.status(400).json({
        error: {
          message: 'Validation failed',
          code: 'VALIDATION_ERROR',
          details: config.sendDetails ? error.message : undefined,
          requestId: context.requestId,
        },
        timestamp: new Date().toISOString(),
        path: req.path,
        method: req.method,
      });
    };
  }

  /**
   * Create rate limit error handler
   */
  public static createRateLimitHandler(
    options: ErrorHandlerOptions = {}
  ): ErrorRequestHandler {
    const config = { ...this.defaultOptions, ...options };
    const logger = config.logger || Logger.create('RateLimitHandler');

    return (
      error: any,
      req: Request,
      res: Response,
      next: NextFunction
    ): void => {
      // Check if this is a rate limit error
      if (error.status !== 429 && !error.message?.includes('rate limit')) {
        return next(error);
      }

      if (config.logErrors) {
        logger.warn('Rate limit exceeded', {
          path: req.path,
          method: req.method,
          ip: req.ip,
          userAgent: req.get('User-Agent'),
        });
      }

      const context = errorResponseBuilder.createErrorContext(req);

      res.status(429).json({
        error: {
          message: 'Rate limit exceeded. Please try again later.',
          code: 'RATE_LIMIT_EXCEEDED',
          requestId: context.requestId,
          retryAfter: error.retryAfter,
        },
        timestamp: new Date().toISOString(),
        path: req.path,
        method: req.method,
      });
    };
  }
}

/**
 * Pre-configured error handlers for common use cases
 */
export const errorHandlers: {
  production: ErrorRequestHandler;
  development: ErrorRequestHandler;
  test: ErrorRequestHandler;
  notFound: RequestHandler;
  validation: ErrorRequestHandler;
  rateLimit: ErrorRequestHandler;
} = {
  /**
   * Standard error handler for production
   */
  production: ErrorHandlerFactory.createErrorHandler({
    includeStack: false,
    sendDetails: false,
    environment: 'production',
  }),

  /**
   * Detailed error handler for development
   */
  development: ErrorHandlerFactory.createErrorHandler({
    includeStack: true,
    sendDetails: true,
    environment: 'development',
  }),

  /**
   * Minimal error handler for testing
   */
  test: ErrorHandlerFactory.createErrorHandler({
    includeStack: false,
    logErrors: false,
    environment: 'test',
  }),

  /**
   * 404 handler
   */
  notFound: ErrorHandlerFactory.createNotFoundHandler(),

  /**
   * Validation error handler
   */
  validation: ErrorHandlerFactory.createValidationErrorHandler(),

  /**
   * Rate limit handler
   */
  rateLimit: ErrorHandlerFactory.createRateLimitHandler(),
};

/**
 * Async handler wrapper for route handlers
 */
export const asyncHandler = ErrorHandlerFactory.createAsyncHandler;
