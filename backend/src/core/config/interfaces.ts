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
  bodyLimit: string;
}

export interface SlackConfig {
  botToken: string;
  userToken: string;
  signingSecret: string;
  maxRetries: number;
  retryBackoffMs: number;
  channelCacheExpiryMs: number;
}

export interface LLMConfig {
  openaiApiKey?: string;
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

export interface SecurityConfig {
  enableHelmet: boolean;
  trustedProxies: string[];
}

export interface WebhookConfig {
  enableSignatureValidation: boolean;
  duplicateEventTtlMs: number;
  processingTimeoutMs: number;
  enableThreading: boolean;
  enableDms: boolean;
  maxResponseLength: number;
}

export interface MemoryConfig {
  enabled: boolean;
  maxTokens: number;
  maxMessages: number;
  sessionTTLMinutes: number;
  cleanupIntervalMinutes: number;
}

export interface SessionConfig {
  maxSessions: number;
  maxSessionsPerUser: number;
}

/**
 * Main application configuration interface
 */
export interface AppConfiguration {
  server: ServerConfig;
  slack: SlackConfig;
  llm: LLMConfig;
  query: QueryConfig;
  security: SecurityConfig;
  webhook: WebhookConfig;
  memory: MemoryConfig;
  session: SessionConfig;
}

/**
 * Environment variables mapping interface
 */
export interface EnvironmentVariables {
  // Server
  NODE_ENV: 'development' | 'production' | 'test';
  PORT: number;
  BODY_LIMIT: string;

  // Slack
  SLACK_BOT_TOKEN: string;
  SLACK_USER_TOKEN: string;
  SLACK_SIGNING_SECRET: string;

  // LLM
  OPENAI_API_KEY?: string;
  ANTHROPIC_API_KEY?: string;
  DEFAULT_LLM_PROVIDER: 'openai' | 'anthropic';
  LLM_MODEL: string;
  MAX_CONTEXT_TOKENS: number;

  // Query limits
  MAX_HISTORY_DAYS: number;
  DEFAULT_QUERY_LIMIT: number;
  MAX_QUERY_LIMIT: number;

  // Webhook
  WEBHOOK_ENABLE_SIGNATURE_VALIDATION: boolean;
  WEBHOOK_DUPLICATE_EVENT_TTL_MS: number;
  WEBHOOK_PROCESSING_TIMEOUT_MS: number;
  WEBHOOK_ENABLE_THREADING: boolean;
  WEBHOOK_ENABLE_DMS: boolean;
  WEBHOOK_MAX_RESPONSE_LENGTH: number;

  // Memory
  MEMORY_ENABLED: boolean;
  MEMORY_MAX_TOKENS: number;
  MEMORY_MAX_MESSAGES: number;
  MEMORY_SESSION_TTL_MINUTES: number;
  MEMORY_CLEANUP_INTERVAL_MINUTES: number;

  // Session
  SESSION_MAX_SESSIONS: number;
  SESSION_MAX_SESSIONS_PER_USER: number;
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
  security: {
    enableHelmet: true,
    trustedProxies: [],
  },
  webhook: {
    enableSignatureValidation: true,
    duplicateEventTtlMs: 5 * 60 * 1000, // 5 minutes
    processingTimeoutMs: 25 * 1000, // 25 seconds
    enableThreading: true,
    enableDms: true,
    maxResponseLength: 4000,
  },
  memory: {
    enabled: true,
    maxTokens: 2000,
    maxMessages: 20,
    sessionTTLMinutes: 60,
    cleanupIntervalMinutes: 10,
  },
  session: {
    maxSessions: 1000,
    maxSessionsPerUser: 10,
  },
} as const;