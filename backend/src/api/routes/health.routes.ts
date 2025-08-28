import { Router, Request, Response, NextFunction } from 'express';
import { validateQuery } from '@/api/middleware/validation.middleware.js';
import { HealthQuerySchema } from '@/api/validators/schemas.js';
import { Logger } from '@/utils/logger.js';
import { SlackService } from '@/services/SlackService.js';
import { ILLMService } from '@/interfaces/services/ILLMService.js';
import { getConfig } from '@/core/config/env.js';

const logger = Logger.create('HealthRoutes');
const router: Router = Router();

// Services will be injected by the server
let slackService: SlackService;
let llmService: ILLMService;

export function initializeHealthRoutes(slack: SlackService, llm: ILLMService) {
  slackService = slack;
  llmService = llm;
}

// Helper function to check Slack service status
async function checkSlackStatus() {
  const lastCheck = new Date().toISOString();

  if (!slackService) {
    return {
      status: 'disconnected' as const,
      lastCheck,
      error: 'Slack service not initialized',
    };
  }

  try {
    const config = getConfig();

    // Validate token configuration
    const tokenValidation = {
      botToken: {
        configured: !!config.SLACK_BOT_TOKEN,
        valid: config.SLACK_BOT_TOKEN?.startsWith('xoxb-') || false,
      },
      userToken: {
        configured: !!config.SLACK_USER_TOKEN,
        valid: config.SLACK_USER_TOKEN?.startsWith('xoxp-') || false,
      },
    };

    // Check if required tokens are missing or invalid
    const missingTokens: string[] = [];
    if (
      !tokenValidation.botToken.configured ||
      !tokenValidation.botToken.valid
    ) {
      missingTokens.push('SLACK_BOT_TOKEN (xoxb-)');
    }
    if (
      !tokenValidation.userToken.configured ||
      !tokenValidation.userToken.valid
    ) {
      missingTokens.push(
        'SLACK_USER_TOKEN (xoxp-) - Required for search functionality'
      );
    }

    if (missingTokens.length > 0) {
      return {
        status: 'error' as const,
        lastCheck,
        error: `Missing or invalid Slack tokens: ${missingTokens.join(', ')}`,
        tokens: tokenValidation,
        requirements: {
          botToken: 'Required for basic Slack API operations',
          userToken:
            'Required for search functionality (search:read scope needed)',
        },
      };
    }

    // Test by getting channels (cached, so it's fast)
    const channels = await slackService.getChannels();
    return {
      status: 'connected' as const,
      lastCheck,
      channels: channels.length,
      cacheStatus: 'active',
      tokens: {
        botToken: 'configured',
        userToken: 'configured',
      },
    };
  } catch (error) {
    return {
      status: 'error' as const,
      lastCheck,
      error: (error as Error).message,
    };
  }
}

// Helper function to check LLM service status
async function checkLLMStatus() {
  const lastCheck = new Date().toISOString();

  if (!llmService) {
    return {
      status: 'disconnected' as const,
      lastCheck,
      error: 'LLM service not initialized',
    };
  }

  try {
    const health = llmService.getHealthStatus();
    const providers = llmService.getAvailableProviders();
    const stats = llmService.getStats();

    // Check if no providers are available
    if (providers.length === 0) {
      const config = getConfig();
      const apiKeys = {
        openai: {
          configured: !!config.OPENAI_API_KEY,
          valid: config.OPENAI_API_KEY?.startsWith('sk-') || false,
        },
        anthropic: {
          configured: !!config.ANTHROPIC_API_KEY,
          valid: config.ANTHROPIC_API_KEY?.startsWith('sk-ant-') || false,
        },
      };

      const missingKeys: string[] = [];
      if (!apiKeys.openai.configured || !apiKeys.openai.valid) {
        missingKeys.push('OPENAI_API_KEY (sk-)');
      }
      if (!apiKeys.anthropic.configured || !apiKeys.anthropic.valid) {
        missingKeys.push('ANTHROPIC_API_KEY (sk-ant-)');
      }

      return {
        status: 'disconnected' as const,
        lastCheck,
        error: health.details?.error || 'No valid LLM providers available',
        apiKeys,
        missingKeys,
        requirements: {
          openai: 'Required for OpenAI GPT models',
          anthropic: 'Required for Anthropic Claude models',
        },
      };
    }

    return {
      status:
        health.status === 'healthy' || health.status === 'degraded'
          ? ('connected' as const)
          : ('disconnected' as const),
      lastCheck,
      currentProvider: stats.currentProvider,
      availableProviders: providers,
      toolsCount: health.details?.agents?.toolsCount || 0,
      memory: {
        enabled: health.details?.agents?.memoryEnabled || false,
        messageCount: health.details?.agents?.memoryMessageCount || 0,
      },
    };
  } catch (error) {
    return {
      status: 'error' as const,
      lastCheck,
      error: (error as Error).message,
    };
  }
}

router.get(
  '/',
  validateQuery(HealthQuerySchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { detailed } = req.query as { detailed?: boolean };

      const basicStatus = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        version: process.env.npm_package_version || '1.0.0',
      };

      if (!detailed) {
        res.json(basicStatus);
        return;
      }

      // Detailed health check with actual service status
      const slackStatus = await checkSlackStatus();
      const llmStatus = await checkLLMStatus();

      const detailedStatus = {
        ...basicStatus,
        services: {
          slack: slackStatus,
          llm: llmStatus,
        },
      };

      logger.info('Health check performed', {
        detailed,
        services: detailedStatus.services,
      });

      res.json(detailedStatus);
    } catch (error) {
      next(error);
    }
  }
);

export { router as healthRoutes };
