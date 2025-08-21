import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import path from 'path';
import { loggingConfig } from '@/config/logging.js';

export interface LogEntry {
  timestamp: string;
  level: string;
  logger: string;
  message: string;
  [key: string]: any;
}

// Winston logger configuration
const logDir = path.join(process.cwd(), loggingConfig.fileLogging.directory);

// Custom format for file logging
const fileFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.json(),
  winston.format.prettyPrint()
);

// Custom format for console logging
const consoleFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.colorize(),
  winston.format.printf(({ timestamp, level, message, logger, ...meta }) => {
    const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
    return `${timestamp} [${level}] ${logger}: ${message}${metaStr}`;
  })
);

// Build transports array based on configuration
const transports: winston.transport[] = [];

// Console transport
if (loggingConfig.console.enabled) {
  transports.push(
    new winston.transports.Console({
      level: loggingConfig.console.level,
      format: loggingConfig.console.colorize
        ? consoleFormat
        : winston.format.simple(),
    })
  );
}

// File transports (if enabled)
if (loggingConfig.fileLogging.enabled) {
  // Combined logs (all levels) with daily rotation
  transports.push(
    new DailyRotateFile({
      filename: path.join(logDir, 'app-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      maxSize: loggingConfig.fileLogging.maxFileSize,
      maxFiles: loggingConfig.fileLogging.retention.app,
      format: fileFormat,
      level: 'debug',
    })
  );

  // Error logs separately with daily rotation
  transports.push(
    new DailyRotateFile({
      filename: path.join(logDir, 'error-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      maxSize: loggingConfig.fileLogging.maxFileSize,
      maxFiles: loggingConfig.fileLogging.retention.error,
      format: fileFormat,
      level: 'error',
    })
  );

  // Application-specific logs for important events
  transports.push(
    new DailyRotateFile({
      filename: path.join(logDir, 'application-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      maxSize: '20m',
      maxFiles: loggingConfig.fileLogging.retention.application,
      format: fileFormat,
      level: 'warn',
    })
  );
}

// Build exception handlers array
const exceptionHandlers: winston.transport[] = [];
const rejectionHandlers: winston.transport[] = [];

if (loggingConfig.fileLogging.enabled) {
  exceptionHandlers.push(
    new DailyRotateFile({
      filename: path.join(logDir, 'exceptions-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      maxSize: '20m',
      maxFiles: loggingConfig.fileLogging.retention.exceptions,
      format: fileFormat,
    })
  );

  rejectionHandlers.push(
    new DailyRotateFile({
      filename: path.join(logDir, 'rejections-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      maxSize: '20m',
      maxFiles: loggingConfig.fileLogging.retention.exceptions,
      format: fileFormat,
    })
  );
}

// Create winston logger instance
const winstonLogger = winston.createLogger({
  level: loggingConfig.level,
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true })
  ),
  transports,
  exceptionHandlers,
  rejectionHandlers,
});

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
    const logData = {
      logger: this.name,
      message,
      ...this.context,
      ...meta,
    };

    if (error) {
      logData.error = {
        name: error.name,
        message: error.message,
        stack: error.stack,
      };
    }

    // Filter out sensitive data
    this.sanitizeLogData(logData);

    // Use winston logger with appropriate level
    switch (level.toLowerCase()) {
      case 'debug':
        winstonLogger.debug(logData);
        break;
      case 'info':
        winstonLogger.info(logData);
        break;
      case 'warn':
        winstonLogger.warn(logData);
        break;
      case 'error':
        winstonLogger.error(logData);
        break;
      default:
        winstonLogger.info(logData);
    }
  }

  private sanitizeLogData(logData: any): void {
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

    sanitize(logData);
  }

  debug(message: string, meta?: any): void {
    this.log('DEBUG', message, undefined, meta);
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
