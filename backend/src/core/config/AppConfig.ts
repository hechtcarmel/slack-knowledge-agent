import { z } from 'zod';
import dotenv from 'dotenv';
import { Logger } from '@/utils/logger.js';
import {
  AppConfiguration,
  EnvironmentVariables,
  ConfigValidationResult,
  CONFIG_DEFAULTS,
  ServerConfig,
  SlackConfig,
  LLMConfig,
  QueryConfig,
  LoggingConfig,
  SecurityConfig,
  WebhookConfig,
  MemoryConfig,
  SessionConfig,
} from './interfaces.js';

// Load environment variables
dotenv.config();

/**
 * Zod schema for environment variable validation
 */
const EnvironmentSchema = z.object({
  // Server
  NODE_ENV: z
    .enum(['development', 'production', 'test'])
    .default('development'),
  PORT: z.string().transform(Number).default('3000'),
  REQUEST_TIMEOUT: z.string().transform(Number).default('30000'),
  BODY_LIMIT: z.string().default('10mb'),

  // Slack
  SLACK_BOT_TOKEN: z.string().startsWith('xoxb-'),
  SLACK_USER_TOKEN: z.string().startsWith('xoxp-'),
  SLACK_SIGNING_SECRET: z.string().min(1),
  SLACK_APP_TOKEN: z.string().startsWith('xapp-').optional(),

  // LLM
  OPENAI_API_KEY: z.string().startsWith('sk-'),
  ANTHROPIC_API_KEY: z.string().startsWith('sk-ant-').optional(),
  DEFAULT_LLM_PROVIDER: z.enum(['openai', 'anthropic']).default('openai'),
  LLM_MODEL: z.string().default('gpt-4o'),
  MAX_CONTEXT_TOKENS: z.string().transform(Number).default('8000'),

  // Query limits
  MAX_HISTORY_DAYS: z.string().transform(Number).default('90'),
  DEFAULT_QUERY_LIMIT: z.string().transform(Number).default('50'),
  MAX_QUERY_LIMIT: z.string().transform(Number).default('200'),

  // Security
  ENABLE_RATE_LIMIT: z
    .string()
    .transform(s => s === 'true')
    .default('false'),
  RATE_LIMIT_WINDOW_MS: z.string().transform(Number).default('900000'),
  RATE_LIMIT_MAX_REQUESTS: z.string().transform(Number).default('100'),

  // Webhook
  WEBHOOK_ENABLE_SIGNATURE_VALIDATION: z
    .string()
    .transform(s => s === 'true')
    .default('true'),
  WEBHOOK_DUPLICATE_EVENT_TTL_MS: z
    .string()
    .transform(Number)
    .default('300000'),
  WEBHOOK_PROCESSING_TIMEOUT_MS: z.string().transform(Number).default('25000'),
  WEBHOOK_ENABLE_THREADING: z
    .string()
    .transform(s => s === 'true')
    .default('true'),
  WEBHOOK_ENABLE_DMS: z
    .string()
    .transform(s => s === 'true')
    .default('true'),
  WEBHOOK_MAX_RESPONSE_LENGTH: z.string().transform(Number).default('4000'),

  // Memory Configuration
  MEMORY_ENABLED: z
    .string()
    .transform(s => s === 'true')
    .default('true'),
  MEMORY_MAX_TOKENS: z.string().transform(Number).default('200000'),
  MEMORY_MAX_MESSAGES: z.string().transform(Number).default('200'),
  MEMORY_SESSION_TTL_MINUTES: z.string().transform(Number).default('120'),
  MEMORY_CLEANUP_INTERVAL_MINUTES: z.string().transform(Number).default('10'),
  MEMORY_COMPRESSION_ENABLED: z
    .string()
    .transform(s => s === 'true')
    .default('false'),
  MEMORY_COMPRESSION_THRESHOLD: z.string().transform(Number).default('0.8'),

  // Session Configuration
  SESSION_MAX_SESSIONS: z.string().transform(Number).default('1000'),
  SESSION_MAX_SESSIONS_PER_USER: z.string().transform(Number).default('10'),
});

/**
 * Unified application configuration manager
 *
 * This class provides a single source of truth for all application configuration.
 * It validates environment variables, applies defaults, and provides typed access
 * to configuration values.
 */
export class AppConfig {
  private static instance: AppConfig | null = null;
  private config: AppConfiguration;
  private logger = Logger.create('AppConfig');

  private constructor() {
    this.config = this.buildConfiguration();
  }

  /**
   * Get the singleton instance of AppConfig
   */
  public static getInstance(): AppConfig {
    if (!AppConfig.instance) {
      AppConfig.instance = new AppConfig();
    }
    return AppConfig.instance;
  }

  /**
   * Get the complete application configuration
   */
  public getConfig(): AppConfiguration {
    return this.config;
  }

  /**
   * Get server configuration
   */
  public getServerConfig(): ServerConfig {
    return this.config.server;
  }

  /**
   * Get Slack configuration
   */
  public getSlackConfig(): SlackConfig {
    return this.config.slack;
  }

  /**
   * Get LLM configuration
   */
  public getLLMConfig(): LLMConfig {
    return this.config.llm;
  }

  /**
   * Get query configuration
   */
  public getQueryConfig(): QueryConfig {
    return this.config.query;
  }

  /**
   * Get logging configuration
   */
  public getLoggingConfig(): LoggingConfig {
    return this.config.logging;
  }

  /**
   * Get security configuration
   */
  public getSecurityConfig(): SecurityConfig {
    return this.config.security;
  }

  /**
   * Get webhook configuration
   */
  public getWebhookConfig(): WebhookConfig {
    return this.config.webhook;
  }

  /**
   * Get memory configuration
   */
  public getMemoryConfig(): MemoryConfig {
    return this.config.memory;
  }

  /**
   * Get session configuration
   */
  public getSessionConfig(): SessionConfig {
    return this.config.session;
  }

  /**
   * Validate the current configuration
   */
  public validateConfiguration(): ConfigValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      // Validate environment variables against schema
      EnvironmentSchema.parse(process.env);
    } catch (error) {
      if (error instanceof z.ZodError) {
        errors.push(
          ...error.errors.map(e => `${e.path.join('.')}: ${e.message}`)
        );
      } else {
        errors.push(`Unexpected validation error: ${error}`);
      }
    }

    // Additional business logic validations
    this.performBusinessValidations(errors, warnings);

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Get masked configuration for logging (removes sensitive data)
   */
  public getMaskedConfig(): Partial<AppConfiguration> {
    return {
      server: this.config.server,
      query: this.config.query,
      logging: this.config.logging,
      security: this.config.security,
      slack: {
        ...this.config.slack,
        botToken: this.maskToken(this.config.slack.botToken),
        userToken: this.maskToken(this.config.slack.userToken),
        signingSecret: '[MASKED]',
        appToken: this.config.slack.appToken ? '[MASKED]' : undefined,
      },
      llm: {
        ...this.config.llm,
        openaiApiKey: this.maskToken(this.config.llm.openaiApiKey),
        anthropicApiKey: this.config.llm.anthropicApiKey
          ? '[MASKED]'
          : undefined,
      },
    };
  }

  /**
   * Reload configuration from environment variables
   */
  public reloadConfiguration(): void {
    this.logger.info('Reloading configuration from environment');
    this.config = this.buildConfiguration();
  }

  /**
   * Build the complete configuration from environment variables and defaults
   */
  private buildConfiguration(): AppConfiguration {
    let env: EnvironmentVariables;

    try {
      env = EnvironmentSchema.parse(process.env);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errorMessages = error.errors.map(
          e => `${e.path.join('.')}: ${e.message}`
        );
        throw new Error(
          `Configuration validation failed:\n${errorMessages.join('\n')}`
        );
      }
      throw error;
    }

    // Build configuration sections
    const serverConfig: ServerConfig = {
      port: env.PORT,
      environment: env.NODE_ENV,
      corsOrigins: this.determineCorsOrigins(env.NODE_ENV),
      requestTimeout: env.REQUEST_TIMEOUT,
      bodyLimit: env.BODY_LIMIT,
    };

    const slackConfig: SlackConfig = {
      botToken: env.SLACK_BOT_TOKEN,
      userToken: env.SLACK_USER_TOKEN,
      signingSecret: env.SLACK_SIGNING_SECRET,
      appToken: env.SLACK_APP_TOKEN,
      maxRetries: CONFIG_DEFAULTS.slack.maxRetries,
      retryBackoffMs: CONFIG_DEFAULTS.slack.retryBackoffMs,
      channelCacheExpiryMs: CONFIG_DEFAULTS.slack.channelCacheExpiryMs,
    };

    const llmConfig: LLMConfig = {
      openaiApiKey: env.OPENAI_API_KEY,
      anthropicApiKey: env.ANTHROPIC_API_KEY,
      defaultProvider: env.DEFAULT_LLM_PROVIDER,
      defaultModel: env.LLM_MODEL,
      maxContextTokens: env.MAX_CONTEXT_TOKENS,
      defaultTemperature: CONFIG_DEFAULTS.llm.defaultTemperature,
      defaultMaxTokens: CONFIG_DEFAULTS.llm.defaultMaxTokens,
      requestTimeoutMs: CONFIG_DEFAULTS.llm.requestTimeoutMs,
    };

    const queryConfig: QueryConfig = {
      maxHistoryDays: env.MAX_HISTORY_DAYS,
      defaultQueryLimit: env.DEFAULT_QUERY_LIMIT,
      maxQueryLimit: env.MAX_QUERY_LIMIT,
      maxConcurrentQueries: CONFIG_DEFAULTS.query.maxConcurrentQueries,
      queryTimeoutMs: CONFIG_DEFAULTS.query.queryTimeoutMs,
    };

    const loggingConfig: LoggingConfig = {
      level: CONFIG_DEFAULTS.logging.level,
      enableConsole: CONFIG_DEFAULTS.logging.enableConsole,
      enableFileLogging: CONFIG_DEFAULTS.logging.enableFileLogging,
      logDirectory: CONFIG_DEFAULTS.logging.logDirectory,
      maxFileSize: CONFIG_DEFAULTS.logging.maxFileSize,
      maxFiles: CONFIG_DEFAULTS.logging.maxFiles,
    };

    const securityConfig: SecurityConfig = {
      enableHelmet: CONFIG_DEFAULTS.security.enableHelmet,
      enableRateLimit: env.ENABLE_RATE_LIMIT,
      rateLimitWindowMs: env.RATE_LIMIT_WINDOW_MS,
      rateLimitMaxRequests: env.RATE_LIMIT_MAX_REQUESTS,
      trustedProxies: [...CONFIG_DEFAULTS.security.trustedProxies],
    };

    const webhookConfig: WebhookConfig = {
      enableSignatureValidation: env.WEBHOOK_ENABLE_SIGNATURE_VALIDATION,
      duplicateEventTtlMs: env.WEBHOOK_DUPLICATE_EVENT_TTL_MS,
      processingTimeoutMs: env.WEBHOOK_PROCESSING_TIMEOUT_MS,
      enableThreading: env.WEBHOOK_ENABLE_THREADING,
      enableDms: env.WEBHOOK_ENABLE_DMS,
      maxResponseLength: env.WEBHOOK_MAX_RESPONSE_LENGTH,
    };

    const memoryConfig: MemoryConfig = {
      enabled: env.MEMORY_ENABLED,
      maxTokens: env.MEMORY_MAX_TOKENS,
      maxMessages: env.MEMORY_MAX_MESSAGES,
      sessionTTLMinutes: env.MEMORY_SESSION_TTL_MINUTES,
      cleanupIntervalMinutes: env.MEMORY_CLEANUP_INTERVAL_MINUTES,
      compressionEnabled: env.MEMORY_COMPRESSION_ENABLED,
      compressionThreshold: env.MEMORY_COMPRESSION_THRESHOLD,
    };

    const sessionConfig: SessionConfig = {
      maxSessions: env.SESSION_MAX_SESSIONS,
      maxSessionsPerUser: env.SESSION_MAX_SESSIONS_PER_USER,
    };

    return {
      server: serverConfig,
      slack: slackConfig,
      llm: llmConfig,
      query: queryConfig,
      logging: loggingConfig,
      security: securityConfig,
      webhook: webhookConfig,
      memory: memoryConfig,
      session: sessionConfig,
    };
  }

  /**
   * Determine CORS origins based on environment
   */
  private determineCorsOrigins(environment: string): string[] {
    if (environment === 'production') {
      // In production, this should come from environment variables
      const origins = process.env.CORS_ORIGINS;
      return origins ? origins.split(',').map(o => o.trim()) : [];
    }
    return [...CONFIG_DEFAULTS.server.corsOrigins];
  }

  /**
   * Perform additional business logic validations
   */
  private performBusinessValidations(
    errors: string[],
    warnings: string[]
  ): void {
    const { slack, llm } = this.config;

    // Check Slack token formats
    if (!slack.botToken.startsWith('xoxb-')) {
      errors.push('SLACK_BOT_TOKEN must start with xoxb-');
    }
    if (!slack.userToken.startsWith('xoxp-')) {
      errors.push('SLACK_USER_TOKEN must start with xoxp-');
    }

    // Check LLM provider and model compatibility
    if (
      llm.defaultProvider === 'openai' &&
      !llm.defaultModel.toLowerCase().includes('gpt')
    ) {
      warnings.push(
        'OpenAI provider specified but model does not appear to be a GPT model'
      );
    }
    if (
      llm.defaultProvider === 'anthropic' &&
      !llm.defaultModel.toLowerCase().includes('claude')
    ) {
      warnings.push(
        'Anthropic provider specified but model does not appear to be a Claude model'
      );
    }

    // Check if Anthropic is configured when specified as default
    if (llm.defaultProvider === 'anthropic' && !llm.anthropicApiKey) {
      errors.push(
        'Anthropic provider specified but ANTHROPIC_API_KEY not provided'
      );
    }

    // Validate query limits
    if (this.config.query.defaultQueryLimit > this.config.query.maxQueryLimit) {
      errors.push('DEFAULT_QUERY_LIMIT cannot be greater than MAX_QUERY_LIMIT');
    }
  }

  /**
   * Mask sensitive tokens for logging
   */
  private maskToken(token: string): string {
    if (!token || token.length < 8) {
      return '[INVALID_TOKEN]';
    }
    return `${token.substring(0, 6)}...${token.substring(token.length - 4)}`;
  }
}

/**
 * Convenience function to get the global app configuration
 */
export function getAppConfig(): AppConfig {
  return AppConfig.getInstance();
}

/**
 * Convenience function to validate configuration on startup
 */
export function validateAppConfiguration(): void {
  const appConfig = getAppConfig();
  const validation = appConfig.validateConfiguration();

  if (!validation.isValid) {
    const logger = Logger.create('ConfigValidation');
    logger.error(
      'Configuration validation failed',
      new Error('Invalid configuration'),
      {
        errors: validation.errors,
        warnings: validation.warnings,
      }
    );

    console.error('🚨 Configuration Error - Server cannot start\n');
    console.error('❌ Configuration errors:');
    validation.errors.forEach(error => console.error(`   • ${error}`));

    if (validation.warnings.length > 0) {
      console.warn('\n⚠️  Configuration warnings:');
      validation.warnings.forEach(warning => console.warn(`   • ${warning}`));
    }

    throw new Error('Configuration validation failed');
  }

  if (validation.warnings.length > 0) {
    const logger = Logger.create('ConfigValidation');
    logger.warn('Configuration warnings detected', {
      warnings: validation.warnings,
    });
  }
}
