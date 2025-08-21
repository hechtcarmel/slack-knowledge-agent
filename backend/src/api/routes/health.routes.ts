import { Router, Request, Response, NextFunction } from 'express';
import { validateQuery } from '@/api/middleware/validation.middleware.js';
import { HealthQuerySchema } from '@/api/validators/schemas.js';
import { Logger } from '@/utils/logger.js';
import { SlackService } from '@/services/SlackService.js';
import { LangChainManager } from '@/llm/LangChainManager.js';

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
    // Test by getting channels (cached, so it's fast)
    const channels = await slackService.getChannels();
    return {
      status: 'connected' as const,
      lastCheck,
      channels: channels.length,
      cacheStatus: 'active',
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
