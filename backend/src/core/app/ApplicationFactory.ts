import express, { Application as ExpressApplication } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';

import { Application } from './Application.js';
import { Container } from '../container/Container.js';
import { SERVICE_TOKENS } from '../container/interfaces.js';
import {
  AppConfig,
  getAppConfig,
  validateAppConfiguration,
} from '../config/AppConfig.js';
import { ConfigManager } from '../config/ConfigManager.js';
import { Logger } from '@/utils/logger.js';
import { SlackApiClient } from '@/services/api/SlackApiClient.js';
import { SlackService } from '@/services/SlackService.js';
import { LLMService } from '@/services/LLMService.js';
import { errorHandlers } from '@/api/middleware/errorHandlerFactory.js';
import { requestLogger } from '@/api/middleware/logging.middleware.js';

// Import route handlers
import {
  healthRoutes,
  initializeHealthRoutes,
} from '@/api/routes/health.routes.js';
import { slackRouter, initializeSlackRoutes } from '@/routes/slack.js';
import { queryRouter, initializeQueryRoutes } from '@/routes/query.js';
import { chatRouter, initializeChatRoutes } from '@/routes/chat.js';
import { debugRouter, initializeDebugRoutes } from '@/routes/debug.js';

/**
 * Application factory options
 */
export interface ApplicationFactoryOptions {
  /** Skip service validation during startup */
  skipValidation?: boolean;
  /** Custom configuration override */
  configOverride?: Partial<AppConfig>;
  /** Enable request logging */
  enableRequestLogging?: boolean;
}

/**
 * Application factory
 *
 * Creates and configures the complete application with all dependencies,
 * middleware, routes, and services properly wired together.
 */
export class ApplicationFactory {
  private logger = Logger.create('ApplicationFactory');

  /**
   * Create a fully configured application
   */
  public async createApplication(
    options: ApplicationFactoryOptions = {}
  ): Promise<Application> {
    try {
      this.logger.info('Creating application...');

      // Validate configuration first
      if (!options.skipValidation) {
        validateAppConfiguration();
      }

      // Get application configuration
      const appConfig = getAppConfig();

      // Create dependency injection container
      const container = this.createContainer();

      // Register all services in container
      await this.registerServices(container, appConfig);

      // Create Express application
      const expressApp = this.createExpressApp(appConfig, options);

      // Setup middleware
      this.setupMiddleware(expressApp, appConfig, options);

      // Initialize and setup routes
      await this.setupRoutes(expressApp, container);

      // Setup error handling (must be last)
      this.setupErrorHandling(expressApp, appConfig);

      // Create application instance
      const application = new Application({
        app: expressApp,
        container,
        config: appConfig,
      });

      this.logger.info('Application created successfully');
      return application;
    } catch (error) {
      this.logger.error('Failed to create application', error as Error);
      throw error;
    }
  }

  /**
   * Create the dependency injection container
   */
  private createContainer(): Container {
    return new Container(undefined, {
      strict: true,
      detectCircular: true,
      logLifecycle: process.env.NODE_ENV === 'development',
    });
  }

  /**
   * Register all services in the DI container
   */
  private async registerServices(
    container: Container,
    appConfig: AppConfig
  ): Promise<void> {
    this.logger.info('Registering services in container...');

    // Register configuration
    container.registerInstance(SERVICE_TOKENS.APP_CONFIG, appConfig);

    // Register configuration manager
    container.registerSingleton(
      SERVICE_TOKENS.CHANNEL_CONFIG_MANAGER,
      ConfigManager
    );

    // Register Slack API client
    container.registerFactory(
      SERVICE_TOKENS.SLACK_API_CLIENT,
      () => {
        const slackConfig = appConfig.getSlackConfig();
        return new SlackApiClient({
          botToken: slackConfig.botToken,
          userToken: slackConfig.userToken,
          maxRetries: slackConfig.maxRetries,
          retryBackoffMs: slackConfig.retryBackoffMs,
        });
      },
      'singleton'
    );

    // Register Slack service
    container.registerFactory(
      SERVICE_TOKENS.SLACK_SERVICE,
      () => {
        const apiClient = container.resolve(SERVICE_TOKENS.SLACK_API_CLIENT);
        return new SlackService(apiClient);
      },
      'singleton'
    );

    // Register LLM service
    container.registerFactory(
      SERVICE_TOKENS.LLM_SERVICE,
      () => {
        const slackService = container.resolve(SERVICE_TOKENS.SLACK_SERVICE);
        const llmConfig = appConfig.getLLMConfig();
        const queryConfig = appConfig.getQueryConfig();

        return new LLMService(slackService, {
          provider: {
            openaiApiKey: llmConfig.openaiApiKey,
            anthropicApiKey: llmConfig.anthropicApiKey,
            defaultProvider: llmConfig.defaultProvider,
            defaultModel: llmConfig.defaultModel,
            requestTimeoutMs: llmConfig.requestTimeoutMs,
          },
          executor: {
            maxConcurrentQueries: queryConfig.maxConcurrentQueries,
            queryTimeoutMs: queryConfig.queryTimeoutMs,
            defaultMaxTokens: llmConfig.defaultMaxTokens,
            defaultTemperature: llmConfig.defaultTemperature,
          },
          agent: {
            maxIterations: 15,
            verbose: process.env.NODE_ENV === 'development',
            returnIntermediateSteps: true,
            handleParsingErrors: true,
            memoryEnabled: true,
            memoryMaxTokens: 2000,
            memoryMaxMessages: 20,
          },
        });
      },
      'singleton'
    );

    // Mark services as eager (initialize on startup)
    const eagerServices = [
      SERVICE_TOKENS.SLACK_API_CLIENT,
      SERVICE_TOKENS.SLACK_SERVICE,
      SERVICE_TOKENS.LLM_SERVICE,
    ];

    for (const token of eagerServices) {
      const registration = container['services'].get(token);
      if (registration) {
        registration.eager = true;
      }
    }

    this.logger.info('Services registered successfully', {
      serviceCount: container.getRegisteredTokens().length,
    });
  }

  /**
   * Create Express application instance
   */
  private createExpressApp(
    appConfig: AppConfig,
    options: ApplicationFactoryOptions
  ): ExpressApplication {
    const app = express();
    const serverConfig = appConfig.getServerConfig();

    // Trust proxy if configured
    if (appConfig.getSecurityConfig().trustedProxies.length > 0) {
      app.set('trust proxy', appConfig.getSecurityConfig().trustedProxies);
    }

    this.logger.info('Express application created', {
      environment: serverConfig.environment,
      trustProxy: app.get('trust proxy'),
    });

    return app;
  }

  /**
   * Setup Express middleware
   */
  private setupMiddleware(
    app: ExpressApplication,
    appConfig: AppConfig,
    options: ApplicationFactoryOptions
  ): void {
    const serverConfig = appConfig.getServerConfig();
    const securityConfig = appConfig.getSecurityConfig();

    // Security middleware
    if (securityConfig.enableHelmet) {
      app.use(
        helmet({
          contentSecurityPolicy: {
            directives: {
              defaultSrc: ["'self'"],
              styleSrc: ["'self'", "'unsafe-inline'"],
              scriptSrc: ["'self'"],
              imgSrc: ["'self'", 'data:', 'https:'],
            },
          },
        })
      );
    }

    // CORS configuration
    app.use(
      cors({
        origin: serverConfig.corsOrigins,
        credentials: true,
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization', 'x-request-id'],
      })
    );

    // Body parsing middleware
    app.use(express.json({ limit: serverConfig.bodyLimit }));
    app.use(
      express.urlencoded({ extended: true, limit: serverConfig.bodyLimit })
    );

    // Request logging
    if (
      options.enableRequestLogging !== false &&
      serverConfig.environment !== 'test'
    ) {
      app.use(
        morgan('combined', {
          stream: {
            write: (message: string) => {
              this.logger.info('HTTP Request', { message: message.trim() });
            },
          },
        })
      );
    }

    app.use(requestLogger);

    this.logger.info('Middleware configured successfully');
  }

  /**
   * Setup application routes
   */
  private async setupRoutes(
    app: ExpressApplication,
    container: Container
  ): Promise<void> {
    this.logger.info('Setting up routes...');

    // Resolve services for route initialization
    const slackService = container.resolve(SERVICE_TOKENS.SLACK_SERVICE);
    const llmService = container.resolve(SERVICE_TOKENS.LLM_SERVICE);

    // Initialize route handlers
    initializeSlackRoutes(slackService);
    initializeQueryRoutes(llmService, slackService);
    initializeHealthRoutes(slackService, llmService);
    initializeDebugRoutes(slackService);

    // Initialize chat routes (create ConversationService inline for now)
    const { ConversationService } = await import(
      '@/services/ConversationService.js'
    );
    const conversationService = new ConversationService({
      maxConversations: 1000,
      maxMessagesPerConversation: 100,
      conversationTimeoutMs: 24 * 60 * 60 * 1000, // 24 hours
      enablePersistence: false, // In-memory for now
    });
    await conversationService.initialize();
    initializeChatRoutes(conversationService, llmService, slackService);

    // Mount routes
    app.use('/api/health', healthRoutes);
    app.use('/api/slack', slackRouter);
    app.use('/api/query', queryRouter);
    app.use('/api/chat', chatRouter);
    app.use('/api/debug', debugRouter);

    // Placeholder Slack events endpoint
    app.post('/slack/events', (_req, res) => {
      res.status(501).json({
        error: {
          message: 'Slack events endpoint not yet implemented',
          code: 'NOT_IMPLEMENTED',
        },
      });
    });

    // Root endpoint
    const serverConfig = container
      .resolve<AppConfig>(SERVICE_TOKENS.APP_CONFIG)
      .getServerConfig();
    if (serverConfig.environment === 'production') {
      // Serve static frontend files in production
      const path = await import('path');
      app.use(express.static(path.join(process.cwd(), 'public')));

      app.get('*', (_req, res) => {
        res.sendFile(path.join(process.cwd(), 'public', 'index.html'));
      });
    } else {
      app.get('/', (_req, res) => {
        res.json({
          message: 'Slack Knowledge Agent API',
          version: '1.0.0',
          timestamp: new Date().toISOString(),
          endpoints: {
            health: '/api/health',
            slack: {
              health: '/api/slack/health',
              channels: '/api/slack/channels',
              search: '/api/slack/search',
              files: '/api/slack/files',
            },
            query: {
              process: '/api/query',
              health: '/api/query/health',
              providers: '/api/query/providers',
            },
            debug: {
              tools: '/api/debug/tools',
              testTool: '/api/debug/test-tool',
              channels: '/api/debug/channels',
            },
            slackEvents: '/slack/events',
          },
        });
      });
    }

    this.logger.info('Routes configured successfully');
  }

  /**
   * Setup error handling middleware (must be called last)
   */
  private setupErrorHandling(
    app: ExpressApplication,
    appConfig: AppConfig
  ): void {
    const serverConfig = appConfig.getServerConfig();

    // 404 handler
    app.use(errorHandlers.notFound);

    // Global error handler
    const errorHandler =
      serverConfig.environment === 'production'
        ? errorHandlers.production
        : errorHandlers.development;

    app.use(errorHandler);

    this.logger.info('Error handling configured successfully');
  }
}

/**
 * Create and start a new application
 */
export async function createAndStartApplication(
  options: ApplicationFactoryOptions = {}
): Promise<Application> {
  const factory = new ApplicationFactory();
  const application = await factory.createApplication(options);
  await application.start();
  return application;
}
