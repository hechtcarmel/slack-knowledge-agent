export interface LogEntry {
  timestamp: string;
  level: string;
  logger: string;
  message: string;
  [key: string]: any;
}

export class Logger {
  private context: Record<string, any> = {};

  constructor(private name: string) {}

  static create(name: string): Logger {
    return new Logger(name);
  }

  child(context: Record<string, any>): Logger {
    const child = new Logger(this.name);
    child.context = { ...this.context, ...context };
    return child;
  }

  private log(level: string, message: string, error?: Error, meta?: any): void {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      logger: this.name,
      message,
      ...this.context,
      ...meta,
    };

    if (error) {
      entry.error = {
        name: error.name,
        message: error.message,
        stack: error.stack,
      };
    }

    // Filter out sensitive data
    this.sanitizeEntry(entry);

    // eslint-disable-next-line no-console
    console.log(JSON.stringify(entry));
  }

  private sanitizeEntry(entry: LogEntry): void {
    const sensitiveKeys = [
      'password',
      'token',
      'secret',
      'key',
      'api_key',
      'apikey',
      'authorization',
      'auth',
      'credential',
      'credentials',
    ];

    const sanitize = (obj: any): void => {
      if (typeof obj !== 'object' || obj === null) return;

      for (const [key, value] of Object.entries(obj)) {
        if (
          sensitiveKeys.some(sensitive => key.toLowerCase().includes(sensitive))
        ) {
          obj[key] = '[REDACTED]';
        } else if (typeof value === 'object') {
          sanitize(value);
        }
      }
    };

    sanitize(entry);
  }

  debug(message: string, meta?: any): void {
    if (process.env.NODE_ENV === 'development') {
      this.log('DEBUG', message, undefined, meta);
    }
  }

  info(message: string, meta?: any): void {
    this.log('INFO', message, undefined, meta);
  }

  warn(message: string, meta?: any): void {
    this.log('WARN', message, undefined, meta);
  }

  error(message: string, error?: Error, meta?: any): void {
    this.log('ERROR', message, error, meta);
  }
}
