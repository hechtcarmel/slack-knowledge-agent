/**
 * Configuration interfaces for the Slack Knowledge Agent
 *
 * These interfaces define the structure of configuration objects
 * used throughout the application.
 */

export interface ServerConfig {
  port: number;
  environment: 'development' | 'production' | 'test';
  corsOrigins: string[];
  requestTimeout: number;
  bodyLimit: string;
}

export interface SlackConfig {
  botToken: string;
  userToken: string;
  signingSecret: string;
  appToken?: string;
  maxRetries: number;
  retryBackoffMs: number;
  channelCacheExpiryMs: number;
}

export interface LLMConfig {
  openaiApiKey: string;
  anthropicApiKey?: string;
  defaultProvider: 'openai' | 'anthropic';
  defaultModel: string;
  maxContextTokens: number;
  defaultTemperature: number;
  defaultMaxTokens: number;
  requestTimeoutMs: number;
}

export interface QueryConfig {
  maxHistoryDays: number;
  defaultQueryLimit: number;
  maxQueryLimit: number;
  maxConcurrentQueries: number;
  queryTimeoutMs: number;
}

export interface LoggingConfig {
  level: string;
  enableConsole: boolean;
  enableFileLogging: boolean;
  logDirectory: string;
  maxFileSize: string;
  maxFiles: number;
}

export interface SecurityConfig {
  enableHelmet: boolean;
  enableRateLimit: boolean;
  rateLimitWindowMs: number;
  rateLimitMaxRequests: number;
  trustedProxies: string[];
}

/**
 * Main application configuration interface
 */
export interface AppConfiguration {
  server: ServerConfig;
  slack: SlackConfig;
  llm: LLMConfig;
  query: QueryConfig;
  logging: LoggingConfig;
  security: SecurityConfig;
}

/**
 * Environment variables mapping interface
 */
export interface EnvironmentVariables {
  // Server
  NODE_ENV: string;
  PORT: string;
  REQUEST_TIMEOUT: string;
  BODY_LIMIT: string;

  // Slack
  SLACK_BOT_TOKEN: string;
  SLACK_USER_TOKEN: string;
  SLACK_SIGNING_SECRET: string;
  SLACK_APP_TOKEN?: string;

  // LLM
  OPENAI_API_KEY: string;
  ANTHROPIC_API_KEY?: string;
  DEFAULT_LLM_PROVIDER: string;
  LLM_MODEL: string;
  MAX_CONTEXT_TOKENS: string;

  // Query limits
  MAX_HISTORY_DAYS: string;
  DEFAULT_QUERY_LIMIT: string;
  MAX_QUERY_LIMIT: string;

  // Security
  ENABLE_RATE_LIMIT: string;
  RATE_LIMIT_WINDOW_MS: string;
  RATE_LIMIT_MAX_REQUESTS: string;
}

/**
 * Configuration validation result
 */
export interface ConfigValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Configuration defaults
 */
export const CONFIG_DEFAULTS = {
  server: {
    port: 3000,
    environment: 'development' as const,
    corsOrigins: ['http://localhost:5173', 'http://localhost:3000'],
    requestTimeout: 30000,
    bodyLimit: '10mb',
  },
  slack: {
    maxRetries: 3,
    retryBackoffMs: 1000,
    channelCacheExpiryMs: 5 * 60 * 1000, // 5 minutes
  },
  llm: {
    defaultProvider: 'openai' as const,
    defaultModel: 'gpt-4o-mini',
    maxContextTokens: 8000,
    defaultTemperature: 0.1,
    defaultMaxTokens: 1000,
    requestTimeoutMs: 60000,
  },
  query: {
    maxHistoryDays: 90,
    defaultQueryLimit: 50,
    maxQueryLimit: 200,
    maxConcurrentQueries: 5,
    queryTimeoutMs: 120000,
  },
  logging: {
    level: 'info',
    enableConsole: true,
    enableFileLogging: true,
    logDirectory: './logs',
    maxFileSize: '20m',
    maxFiles: 14,
  },
  security: {
    enableHelmet: true,
    enableRateLimit: false,
    rateLimitWindowMs: 15 * 60 * 1000, // 15 minutes
    rateLimitMaxRequests: 100,
    trustedProxies: [],
  },
} as const;
