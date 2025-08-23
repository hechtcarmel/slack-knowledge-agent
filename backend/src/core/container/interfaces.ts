/**
 * Dependency injection container interfaces
 *
 * These interfaces define the contracts for the dependency injection system
 * used throughout the application.
 */

/**
 * Service lifecycle types
 */
export type ServiceLifecycle = 'singleton' | 'transient' | 'scoped';

/**
 * Constructor type for dependency injection
 */
export type Constructor<T = any> = new (...args: any[]) => T;

/**
 * Factory function type for creating services
 */
export type Factory<T = any> = (...args: any[]) => T | Promise<T>;

/**
 * Service registration options
 */
export interface ServiceRegistration<T = any> {
  /** The service implementation (constructor or instance) */
  implementation: Constructor<T> | T | Factory<T>;
  /** Service lifecycle - how instances are managed */
  lifecycle: ServiceLifecycle;
  /** Dependencies to inject into constructor */
  dependencies?: (string | symbol)[];
  /** Whether this service should be initialized on container startup */
  eager?: boolean;
  /** Service metadata */
  metadata?: Record<string, any>;
}

/**
 * Container interface
 */
export interface IContainer {
  /**
   * Register a service with the container
   */
  register<T>(
    token: string | symbol,
    registration: ServiceRegistration<T>
  ): void;

  /**
   * Register a singleton service
   */
  registerSingleton<T>(
    token: string | symbol,
    implementation: Constructor<T> | T | Factory<T>,
    dependencies?: (string | symbol)[]
  ): void;

  /**
   * Register a transient service
   */
  registerTransient<T>(
    token: string | symbol,
    implementation: Constructor<T> | Factory<T>,
    dependencies?: (string | symbol)[]
  ): void;

  /**
   * Register a factory function
   */
  registerFactory<T>(
    token: string | symbol,
    factory: Factory<T>,
    lifecycle?: ServiceLifecycle
  ): void;

  /**
   * Register an existing instance
   */
  registerInstance<T>(token: string | symbol, instance: T): void;

  /**
   * Resolve a service from the container
   */
  resolve<T>(token: string | symbol): T;

  /**
   * Check if a service is registered
   */
  isRegistered(token: string | symbol): boolean;

  /**
   * Get all registered service tokens
   */
  getRegisteredTokens(): (string | symbol)[];

  /**
   * Initialize all eager services
   */
  initializeEagerServices(): Promise<void>;

  /**
   * Dispose of all services and cleanup
   */
  dispose(): Promise<void>;

  /**
   * Create a child container with access to parent services
   */
  createChild(): IContainer;

  /**
   * Get container statistics
   */
  getStats(): {
    servicesRegistered: number;
    instancesCreated: number;
    childContainers: number;
  };
}

/**
 * Service tokens for type-safe dependency injection
 */
export const SERVICE_TOKENS = {
  // Configuration
  APP_CONFIG: Symbol('AppConfig'),
  CHANNEL_CONFIG_MANAGER: Symbol('ChannelConfigManager'),

  // Logging
  LOGGER_FACTORY: Symbol('LoggerFactory'),

  // Slack Services
  SLACK_API_CLIENT: Symbol('SlackApiClient'),
  SLACK_SERVICE: Symbol('SlackService'),

  // LLM Services
  LLM_SERVICE: Symbol('LLMService'),
  LLM_PROVIDER_MANAGER: Symbol('LLMProviderManager'),
  QUERY_EXECUTOR: Symbol('QueryExecutor'),
  AGENT_MANAGER: Symbol('AgentManager'),

  // Webhook Services
  WEBHOOK_SERVICE: Symbol('WebhookService'),
  EVENT_PROCESSOR: Symbol('EventProcessor'),
  RESPONSE_POSTER: Symbol('ResponsePoster'),

  // Tools
  SLACK_TOOLS_FACTORY: Symbol('SlackToolsFactory'),

  // Utilities
  RETRY_MANAGER: Symbol('RetryManager'),
  ERROR_HANDLER_FACTORY: Symbol('ErrorHandlerFactory'),

  // HTTP
  EXPRESS_APP: Symbol('ExpressApp'),
} as const;

/**
 * Service initialization interface
 */
export interface IInitializableService {
  initialize(): Promise<void>;
}

/**
 * Service disposal interface
 */
export interface IDisposableService {
  dispose(): Promise<void>;
}

/**
 * Health check interface for services
 */
export interface IHealthCheckable {
  getHealthStatus(): {
    status: 'healthy' | 'degraded' | 'unhealthy';
    details?: Record<string, any>;
  };
}

/**
 * Container configuration options
 */
export interface ContainerOptions {
  /** Enable strict mode (throw on missing dependencies) */
  strict?: boolean;
  /** Enable circular dependency detection */
  detectCircular?: boolean;
  /** Maximum depth for dependency resolution */
  maxDepth?: number;
  /** Enable service lifecycle logging */
  logLifecycle?: boolean;
}
