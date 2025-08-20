import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { Logger } from '@/utils/logger.js';
import { ValidationError } from '@/utils/errors.js';

const logger = Logger.create('ValidationMiddleware');

export function validateRequest<T extends z.ZodType<any, any>>(schema: T) {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      // Validate query parameters and body
      const validationData = {
        ...req.query,
        ...req.body,
      };

      const result = schema.safeParse(validationData);

      if (!result.success) {
        const errorDetails = result.error.errors.map(err => ({
          field: err.path.join('.'),
          message: err.message,
          code: err.code,
        }));

        logger.warn('Request validation failed', {
          path: req.path,
          method: req.method,
          errors: errorDetails,
        });

        res.status(400).json({
          status: 'error',
          message: 'Request validation failed',
          errors: errorDetails,
        });
        return;
      }

      // Replace request body with validated data
      req.body = result.data;
      next();
    } catch (error) {
      logger.error('Validation middleware error', error as Error);

      if (error instanceof ValidationError) {
        res.status(error.statusCode).json({
          status: 'error',
          message: error.message,
          code: error.code,
        });
        return;
      }

      res.status(500).json({
        status: 'error',
        message: 'Internal validation error',
      });
    }
  };
}
