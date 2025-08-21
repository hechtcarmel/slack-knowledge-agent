import { Router, Request, Response, NextFunction } from 'express';
import { validateQuery } from '@/api/middleware/validation.middleware.js';
import { HealthQuerySchema } from '@/api/validators/schemas.js';
import { Logger } from '@/utils/logger.js';
import { SlackService } from '@/services/SlackService.js';
import { LangChainManager } from '@/llm/LangChainManager.js';
import { getConfig } from '@/core/config/env.js';

const logger = Logger.create('HealthRoutes');
const router: Router = Router();

// Services will be injected by the server
let slackService: SlackService;
let llmManager: LangChainManager;

export function initializeHealthRoutes(
  slack: SlackService,
  llm: LangChainManager
) {
  slackService = slack;
  llmManager = llm;
}

// Helper function to check Slack service status
async function checkSlackStatus() {
  const lastCheck = new Date().toISOString();

  if (!slackService) {
    return {
      status: 'unavailable' as const,
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

  if (!llmManager) {
    return {
      status: 'unavailable' as const,
      lastCheck,
      error: 'LLM manager not initialized',
    };
  }

  try {
    const health = llmManager.getHealthStatus();
    const providers = llmManager.getAvailableProviders();

    return {
      status:
        health.status === 'healthy'
          ? ('connected' as const)
          : ('degraded' as const),
      lastCheck,
      currentProvider: health.currentProvider,
      availableProviders: providers,
      toolsCount: health.tools,
      memory: health.memory,
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
        system: {
          memory: {
            used: process.memoryUsage().heapUsed,
            total: process.memoryUsage().heapTotal,
            external: process.memoryUsage().external,
          },
          cpu: {
            usage: process.cpuUsage(),
          },
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
