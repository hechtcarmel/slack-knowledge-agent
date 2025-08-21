export interface LoggingConfig {
  level: string;
  fileLogging: {
    enabled: boolean;
    directory: string;
    maxFileSize: string;
    retention: {
      app: string;
      error: string;
      application: string;
      exceptions: string;
    };
  };
  console: {
    enabled: boolean;
    colorize: boolean;
    level: string;
  };
}

export const loggingConfig: LoggingConfig = {
  level: process.env.LOG_LEVEL || 'info',
  fileLogging: {
    enabled: process.env.FILE_LOGGING !== 'false', // Enable by default
    directory: process.env.LOG_DIR || 'logs',
    maxFileSize: process.env.LOG_MAX_SIZE || '50m',
    retention: {
      app: process.env.LOG_RETENTION_APP || '14d',
      error: process.env.LOG_RETENTION_ERROR || '30d',
      application: process.env.LOG_RETENTION_APPLICATION || '7d',
      exceptions: process.env.LOG_RETENTION_EXCEPTIONS || '30d',
    },
  },
  console: {
    enabled: process.env.CONSOLE_LOGGING !== 'false',
    colorize: process.env.NODE_ENV !== 'production',
    level: process.env.NODE_ENV === 'development' ? 'debug' : 'info',
  },
};
