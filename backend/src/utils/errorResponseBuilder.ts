import { Request, Response } from 'express';
import { BaseError } from './errors.js';
import { Logger } from './logger.js';

/**
 * Standard error response format
 */
export interface ErrorResponse {
  error: {
    message: string;
    code: string;
    details?: any;
    requestId?: string;
  };
  timestamp: string;
  path: string;
  method: string;
}

/**
 * Error context for enhanced logging
 */
export interface ErrorContext {
  requestId?: string;
  userId?: string;
  sessionId?: string;
  userAgent?: string;
  ip?: string;
  correlationId?: string;
  [key: string]: any;
}

/**
 * Error response builder utility
 *
 * Provides consistent error response formatting and context enrichment
 * across the application.
 */
export class ErrorResponseBuilder {
  private logger = Logger.create('ErrorResponseBuilder');

  /**
   * Build a standardized error response
   */
  public buildErrorResponse(
    error: Error,
    req: Request,
    context: ErrorContext = {}
  ): ErrorResponse {
    const requestId = context.requestId || this.generateRequestId();

    // Extract error details based on error type
    const { message, code, statusCode, details } =
      this.extractErrorDetails(error);

    // Build the response
    const errorResponse: ErrorResponse = {
      error: {
        message,
        code,
        requestId,
        ...(details && { details }),
      },
      timestamp: new Date().toISOString(),
      path: req.path,
      method: req.method,
    };

    // Log the error with context
    this.logError(error, req, context, requestId, statusCode);

    return errorResponse;
  }

  /**
   * Send error response to client
   */
  public sendErrorResponse(
    res: Response,
    error: Error,
    req: Request,
    context: ErrorContext = {}
  ): void {
    if (res.headersSent) {
      return;
    }

    const { statusCode } = this.extractErrorDetails(error);
    const errorResponse = this.buildErrorResponse(error, req, context);

    res.status(statusCode).json(errorResponse);
  }

  /**
   * Extract error details from different error types
   */
  private extractErrorDetails(error: Error): {
    message: string;
    code: string;
    statusCode: number;
    details?: any;
  } {
    // Handle custom BaseError types
    if (error instanceof BaseError) {
      return {
        message: error.message,
        code: error.code,
        statusCode: error.statusCode,
        details: error.details,
      };
    }

    // Handle validation errors (Zod, Joi, etc.)
    if (error.name === 'ValidationError') {
      return {
        message: 'Validation failed',
        code: 'VALIDATION_ERROR',
        statusCode: 400,
        details: error.message,
      };
    }

    // Handle JSON parsing errors
    if (error instanceof SyntaxError && 'body' in error) {
      return {
        message: 'Invalid JSON in request body',
        code: 'INVALID_JSON',
        statusCode: 400,
      };
    }

    // Handle timeout errors
    if (error.message?.includes('timeout') || error.name === 'TimeoutError') {
      return {
        message: 'Request timeout',
        code: 'TIMEOUT_ERROR',
        statusCode: 408,
      };
    }

    // Handle rate limit errors
    if (
      error.message?.includes('rate limit') ||
      error.name === 'TooManyRequestsError'
    ) {
      return {
        message: 'Rate limit exceeded',
        code: 'RATE_LIMIT_ERROR',
        statusCode: 429,
      };
    }

    // Handle authentication errors
    if (
      error.message?.includes('unauthorized') ||
      error.name === 'UnauthorizedError'
    ) {
      return {
        message: 'Authentication required',
        code: 'AUTH_ERROR',
        statusCode: 401,
      };
    }

    // Handle permission errors
    if (
      error.message?.includes('forbidden') ||
      error.name === 'ForbiddenError'
    ) {
      return {
        message: 'Insufficient permissions',
        code: 'PERMISSION_ERROR',
        statusCode: 403,
      };
    }

    // Default to internal server error
    return {
      message:
        process.env.NODE_ENV === 'production'
          ? 'Internal server error'
          : error.message,
      code: 'INTERNAL_SERVER_ERROR',
      statusCode: 500,
    };
  }

  /**
   * Log error with context and correlation information
   */
  private logError(
    error: Error,
    req: Request,
    context: ErrorContext,
    requestId: string,
    statusCode: number
  ): void {
    const logLevel = statusCode >= 500 ? 'error' : 'warn';
    const logMethod =
      logLevel === 'error' ? this.logger.error : this.logger.warn;

    const logContext = {
      requestId,
      method: req.method,
      path: req.path,
      query: req.query,
      userAgent: req.get('User-Agent'),
      ip: req.ip,
      statusCode,
      ...context,
    };

    if (logLevel === 'error') {
      this.logger.error('Request failed with server error', error, logContext);
    } else {
      this.logger.warn('Request failed with client error', logContext);
    }
  }

  /**
   * Generate a unique request ID
   */
  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Create error context from request
   */
  public createErrorContext(req: Request): ErrorContext {
    return {
      userAgent: req.get('User-Agent'),
      ip: req.ip,
      requestId: req.get('X-Request-ID') || this.generateRequestId(),
      correlationId: req.get('X-Correlation-ID'),
    };
  }
}

/**
 * Global error response builder instance
 */
export const errorResponseBuilder = new ErrorResponseBuilder();
