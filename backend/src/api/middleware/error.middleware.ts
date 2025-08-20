import { Request, Response, NextFunction } from 'express';
import { BaseError } from '@/utils/errors.js';
import { Logger } from '@/utils/logger.js';

const logger = Logger.create('ErrorMiddleware');

export function errorHandler(
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  if (res.headersSent) {
    return next(error);
  }
  
  logger.error('Request failed', error, {
    method: req.method,
    path: req.path,
    query: req.query,
    ip: req.ip,
    userAgent: req.get('User-Agent')
  });
  
  if (error instanceof BaseError) {
    res.status(error.statusCode).json({
      error: {
        message: error.message,
        code: error.code,
        details: error.details
      },
      timestamp: new Date().toISOString(),
      path: req.path
    });
    return;
  }
  
  // Handle known error types
  if (error.name === 'ValidationError') {
    res.status(400).json({
      error: {
        message: 'Validation failed',
        code: 'VALIDATION_ERROR',
        details: error.message
      },
      timestamp: new Date().toISOString(),
      path: req.path
    });
    return;
  }
  
  if (error.name === 'SyntaxError' && 'body' in error) {
    res.status(400).json({
      error: {
        message: 'Invalid JSON in request body',
        code: 'INVALID_JSON',
      },
      timestamp: new Date().toISOString(),
      path: req.path
    });
    return;
  }
  
  // Generic server error
  res.status(500).json({
    error: {
      message: 'Internal server error',
      code: 'INTERNAL_SERVER_ERROR'
    },
    timestamp: new Date().toISOString(),
    path: req.path
  });
}

export function notFoundHandler(req: Request, res: Response): void {
  logger.warn('Route not found', {
    method: req.method,
    path: req.path,
    ip: req.ip
  });
  
  res.status(404).json({
    error: {
      message: `Route ${req.method} ${req.path} not found`,
      code: 'NOT_FOUND'
    },
    timestamp: new Date().toISOString(),
    path: req.path
  });
}