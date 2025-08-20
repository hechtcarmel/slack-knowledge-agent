import { RetryOptions } from '@/types/index.js';
import { Logger } from './logger.js';

const logger = Logger.create('RetryManager');

export class RetryManager {
  async executeWithRetry<T>(
    fn: () => Promise<T>,
    options: RetryOptions = {}
  ): Promise<T> {
    const {
      maxAttempts = 3,
      backoffMs = 1000,
      backoffMultiplier = 2,
      shouldRetry = this.defaultShouldRetry,
    } = options;

    let lastError: Error;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const result = await fn();

        if (attempt > 1) {
          logger.info('Operation succeeded after retry', {
            attempt,
            totalAttempts: maxAttempts,
          });
        }

        return result;
      } catch (error) {
        lastError = error as Error;

        logger.warn('Operation failed, checking retry conditions', {
          attempt,
          maxAttempts,
          error: lastError.message,
        });

        if (attempt === maxAttempts || !shouldRetry(error)) {
          logger.error('Operation failed permanently', lastError, {
            attempt,
            maxAttempts,
            willRetry: false,
          });
          throw error;
        }

        const delay = backoffMs * Math.pow(backoffMultiplier, attempt - 1);

        logger.info('Retrying operation after delay', {
          attempt,
          maxAttempts,
          delayMs: delay,
          nextAttempt: attempt + 1,
        });

        await this.sleep(delay);
      }
    }

    throw lastError!;
  }

  private defaultShouldRetry(error: any): boolean {
    // Retry on network errors
    if (
      error.code === 'ECONNREFUSED' ||
      error.code === 'ETIMEDOUT' ||
      error.code === 'ENOTFOUND' ||
      error.code === 'ECONNRESET'
    ) {
      return true;
    }

    // Retry on 5xx status codes (server errors)
    if (error.statusCode && error.statusCode >= 500) {
      return true;
    }

    // Retry on specific HTTP status codes
    if (
      error.status === 429 || // Rate limit
      error.status === 502 || // Bad Gateway
      error.status === 503 || // Service Unavailable
      error.status === 504
    ) {
      // Gateway Timeout
      return true;
    }

    // Don't retry on client errors (4xx except 429)
    if (
      error.statusCode &&
      error.statusCode >= 400 &&
      error.statusCode < 500 &&
      error.statusCode !== 429
    ) {
      return false;
    }

    return false;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
