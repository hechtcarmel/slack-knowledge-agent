export abstract class BaseError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number,
    public details?: any
  ) {
    super(message);
    this.name = this.constructor.name;

    // Maintains proper stack trace for where error was thrown
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      statusCode: this.statusCode,
      details: this.details,
    };
  }
}

export class SlackError extends BaseError {
  constructor(message: string, code: string, details?: any) {
    super(message, code, 503, details);
  }
}

export class LLMError extends BaseError {
  constructor(message: string, code: string, details?: any) {
    super(message, code, 503, details);
  }
}

export class ValidationError extends BaseError {
  constructor(message: string, details?: any) {
    super(message, 'VALIDATION_ERROR', 400, details);
  }
}

export class ConfigurationError extends BaseError {
  constructor(message: string, details?: any) {
    super(message, 'CONFIG_ERROR', 500, details);
  }
}

export class AuthenticationError extends BaseError {
  constructor(message: string, details?: any) {
    super(message, 'AUTH_ERROR', 401, details);
  }
}

export class RateLimitError extends BaseError {
  constructor(message: string, details?: any) {
    super(message, 'RATE_LIMIT_ERROR', 429, details);
  }
}

export class TimeoutError extends BaseError {
  constructor(message: string, details?: any) {
    super(message, 'TIMEOUT_ERROR', 408, details);
  }
}

export class NotFoundError extends BaseError {
  constructor(message: string, details?: any) {
    super(message, 'NOT_FOUND_ERROR', 404, details);
  }
}

export class InternalServerError extends BaseError {
  constructor(message: string, details?: any) {
    super(message, 'INTERNAL_SERVER_ERROR', 500, details);
  }
}

export class WebhookError extends BaseError {
  constructor(message: string, code: string, details?: any) {
    super(message, code, 500, details);
  }
}
