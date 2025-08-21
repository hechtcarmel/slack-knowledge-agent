import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';

import { getConfig } from '@/core/config/env.js';
import { ConfigManager } from '@/core/config/ConfigManager.js';
import { Logger } from '@/utils/logger.js';
import { requestLogger } from '@/api/middleware/logging.middleware.js';
import {
  errorHandler,
  notFoundHandler,
} from '@/api/middleware/error.middleware.js';

// Service imports
import { SlackService } from '@/services/SlackService.js';
import { LangChainManager } from '@/llm/LangChainManager.js';

// Route imports
import {
  healthRoutes,
  initializeHealthRoutes,
} from '@/api/routes/health.routes.js';
import { slackRouter, initializeSlackRoutes } from '@/routes/slack.js';
import { queryRouter, initializeQueryRoutes } from '@/routes/query.js';

const logger = Logger.create('Server');

class SlackKnowledgeAgentServer {
  private app: express.Application;
  private configManager: ConfigManager;
  private slackService: SlackService;
  private llmManager: LangChainManager;
  private config = getConfig();

  constructor() {
    this.app = express();
    this.configManager = new ConfigManager();
    this.slackService = new SlackService(
      this.config.SLACK_BOT_TOKEN,
      this.config.SLACK_USER_TOKEN
    );
    this.llmManager = new LangChainManager(
      this.config.OPENAI_API_KEY,
      this.config.ANTHROPIC_API_KEY,
      this.slackService,
      this.config.DEFAULT_LLM_PROVIDER,
      this.config.LLM_MODEL
    );
    this.setupMiddleware();
    // Error handling will be set up after routes in setupRoutes()
  }

  private setupMiddleware(): void {
    // Security middleware
    this.app.use(
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

    // CORS configuration
    this.app.use(
      cors({
        origin:
          process.env.NODE_ENV === 'production'
            ? ['https://your-frontend-domain.com']
            : ['http://localhost:5173', 'http://localhost:3000'],
        credentials: true,
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization', 'x-request-id'],
      })
    );

    // Body parsing middleware
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // Logging middleware
    if (process.env.NODE_ENV !== 'test') {
      this.app.use(
        morgan('combined', {
          stream: {
            write: (message: string) => {
              logger.info('HTTP Request', { message: message.trim() });
            },
          },
        })
      );
    }

    this.app.use(requestLogger);
  }

  private async setupRoutes(): Promise<void> {
    // Initialize service routes
    initializeSlackRoutes(this.slackService);
    initializeQueryRoutes(this.llmManager);
    initializeHealthRoutes(this.slackService, this.llmManager);

    // Health check routes
    this.app.use('/api/health', healthRoutes);

    // Slack API routes
    this.app.use('/api/slack', slackRouter);

    // Query/LLM routes
    this.app.use('/api/query', queryRouter);

    this.app.post('/slack/events', (_req, res) => {
      res.status(501).json({
        error: {
          message: 'Slack events endpoint not yet implemented',
          code: 'NOT_IMPLEMENTED',
        },
      });
    });

    // Serve static frontend files in production
    if (process.env.NODE_ENV === 'production') {
      const path = await import('path');

      // Serve static files from public directory
      this.app.use(express.static(path.join(process.cwd(), 'public')));

      // Serve frontend for all non-API routes (SPA routing)
      this.app.get('*', (_req, res) => {
        res.sendFile(path.join(process.cwd(), 'public', 'index.html'));
      });
    } else {
      // Root endpoint for development/API info
      this.app.get('/', (_req, res) => {
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
            slackEvents: '/slack/events',
          },
        });
      });
    }
  }

  private setupErrorHandling(): void {
    // 404 handler
    this.app.use(notFoundHandler);

    // Global error handler
    this.app.use(errorHandler);
  }

  private async initializeConfig(): Promise<void> {
    try {
      // Try to load channel configuration
      await this.configManager.loadConfig('./config/channels.json');
      this.configManager.watchConfig('./config/channels.json');

      logger.info('Channel configuration loaded successfully');
    } catch (error) {
      logger.warn('Could not load channel configuration, will create default', {
        error: (error as Error).message,
      });

      // Create default configuration directory and file
      await this.createDefaultConfig();
    }
  }

  private async createDefaultConfig(): Promise<void> {
    const fs = await import('fs');
    const path = await import('path');

    const configDir = path.resolve('./config');
    const configFile = path.resolve('./config/channels.json');

    // Create config directory if it doesn't exist
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
    }

    // Create default channels.json
    const defaultConfig = {
      channels: [
        {
          id: 'C1234567890',
          name: 'general',
          description:
            'Main discussion channel for team updates and announcements',
        },
        {
          id: 'C0987654321',
          name: 'engineering',
          description:
            'Technical discussions, code reviews, and engineering decisions',
        },
      ],
    };

    fs.writeFileSync(configFile, JSON.stringify(defaultConfig, null, 2));
    logger.info('Created default configuration file', { path: configFile });

    // Load the default configuration
    await this.configManager.loadConfig('./config/channels.json');
    this.configManager.watchConfig('./config/channels.json');
  }

  private validateConfiguration(): void {
    logger.info('Validating configuration...');

    const missingTokens: string[] = [];
    const invalidTokens: string[] = [];

    // Check bot token
    if (!this.config.SLACK_BOT_TOKEN) {
      missingTokens.push('SLACK_BOT_TOKEN');
    } else if (!this.config.SLACK_BOT_TOKEN.startsWith('xoxb-')) {
      invalidTokens.push('SLACK_BOT_TOKEN (must start with xoxb-)');
    }

    // Check user token (required for search functionality)
    if (!this.config.SLACK_USER_TOKEN) {
      missingTokens.push('SLACK_USER_TOKEN');
    } else if (!this.config.SLACK_USER_TOKEN.startsWith('xoxp-')) {
      invalidTokens.push('SLACK_USER_TOKEN (must start with xoxp-)');
    }

    // Check OpenAI API key
    if (!this.config.OPENAI_API_KEY) {
      missingTokens.push('OPENAI_API_KEY');
    } else if (!this.config.OPENAI_API_KEY.startsWith('sk-')) {
      invalidTokens.push('OPENAI_API_KEY (must start with sk-)');
    }

    if (missingTokens.length > 0 || invalidTokens.length > 0) {
      logger.error('Configuration validation failed');

      let errorMessage = '🚨 Configuration Error - Server cannot start\n\n';

      if (missingTokens.length > 0) {
        errorMessage += '❌ Missing required environment variables:\n';
        missingTokens.forEach(token => {
          errorMessage += `   • ${token}\n`;
        });
        errorMessage += '\n';
      }

      if (invalidTokens.length > 0) {
        errorMessage += '❌ Invalid token formats:\n';
        invalidTokens.forEach(token => {
          errorMessage += `   • ${token}\n`;
        });
        errorMessage += '\n';
      }

      errorMessage += '📋 Required configuration:\n';
      errorMessage += '   • SLACK_BOT_TOKEN=xoxb-... (Bot User OAuth Token)\n';
      errorMessage +=
        '   • SLACK_USER_TOKEN=xoxp-... (User OAuth Token with search:read scope)\n';
      errorMessage += '   • OPENAI_API_KEY=sk-... (OpenAI API Key)\n\n';
      errorMessage += '🔗 Get Slack tokens: https://api.slack.com/apps\n';
      errorMessage +=
        '🔗 Get OpenAI API key: https://platform.openai.com/api-keys\n\n';
      errorMessage +=
        '⚠️  The SLACK_USER_TOKEN is required for search functionality.\n';
      errorMessage +=
        '   Make sure it has the "search:read" scope when installing your Slack app.';

      console.error(errorMessage);
      throw new Error(
        'Configuration validation failed - see error details above'
      );
    }

    logger.info('Configuration validation passed ✅');
  }

  public async start(): Promise<void> {
    try {
      // Validate configuration before starting services
      this.validateConfiguration();

      await this.initializeConfig();

      // Initialize services first
      logger.info('Initializing Slack service...');
      await this.slackService.initialize();

      logger.info('Initializing LLM manager...');
      await this.llmManager.initialize();

      // Set up routes after services are initialized
      await this.setupRoutes();

      // Set up error handling after all routes are registered
      this.setupErrorHandling();

      const server = this.app.listen(this.config.PORT, () => {
        logger.info('Server started successfully', {
          port: this.config.PORT,
          environment: this.config.NODE_ENV,
          timestamp: new Date().toISOString(),
        });
      });

      // Graceful shutdown handling
      process.on('SIGTERM', () => {
        logger.info('SIGTERM received, shutting down gracefully');
        server.close(() => {
          this.configManager.close();
          logger.info('Server shut down complete');
          process.exit(0);
        });
      });

      process.on('SIGINT', () => {
        logger.info('SIGINT received, shutting down gracefully');
        server.close(() => {
          this.configManager.close();
          logger.info('Server shut down complete');
          process.exit(0);
        });
      });
    } catch (error) {
      logger.error('Failed to start server', error as Error);
      process.exit(1);
    }
  }

  public getApp(): express.Application {
    return this.app;
  }
}

// Start the server if this file is run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const server = new SlackKnowledgeAgentServer();
  server.start().catch(error => {
    console.error('Failed to start server:', error);
    process.exit(1);
  });
}

export { SlackKnowledgeAgentServer };
