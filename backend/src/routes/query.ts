import { Router, type Router as ExpressRouter } from 'express';
import { z } from 'zod';
import { LLMManager } from '@/llm/LLMManager.js';
import { Logger } from '@/utils/logger.js';
import { validateRequest } from '@/middleware/validation.js';
import { LLMContext } from '@/llm/types.js';
import { QueryRequestSchema } from '@/api/validators/schemas.js';

const router: ExpressRouter = Router();
const logger = Logger.create('QueryRoutes');

// Validation schemas - extend the centralized schema with LLM-specific options
const QueryOptionsSchema = z.object({
  provider: z.enum(['openai', 'anthropic']).optional(),
  model: z.string().optional(),
  max_tokens: z.number().int().min(50).max(4000).optional(),
  temperature: z.number().min(0).max(2).optional(),
  stream: z.boolean().default(false),
});

const ExtendedQuerySchema = QueryRequestSchema.extend({
  llmOptions: QueryOptionsSchema.optional(),
});

const HealthSchema = z.object({
  detailed: z.boolean().default(false),
});

// Initialize LLMManager (will be injected by server)
let llmManager: LLMManager;

export function initializeQueryRoutes(manager: LLMManager) {
  llmManager = manager;
}

// POST /query - Process a knowledge query
router.post('/', validateRequest(ExtendedQuerySchema), async (req, res) => {
  const startTime = Date.now();

  try {
    const { query, channels, context = {}, llmOptions = {} } = req.body;

    logger.info('Processing knowledge query', {
      query: query.substring(0, 100) + '...',
      channels,
      provider: llmOptions.provider,
      stream: llmOptions.stream,
    });

    // Build LLM context - for now, we'll create a basic context
    // In a full implementation, this would gather actual Slack data
    const llmContext: LLMContext = {
      query: query,
      channelIds: channels,
      messages: [], // Will be populated by tools
      metadata: {
        total_messages: 0,
        channels: channels.map((ch: string) => ({ id: ch, name: ch })),
        search_time_ms: 0,
        token_count: 0,
      },
    };

    if (llmOptions.stream) {
      // Set headers for streaming response
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Cache-Control',
      });

      try {
        for await (const chunk of llmManager.streamQuery(llmContext, {
          provider: llmOptions.provider,
          model: llmOptions.model,
          max_tokens: llmOptions.max_tokens,
          temperature: llmOptions.temperature,
        })) {
          const data = JSON.stringify(chunk);
          res.write(`data: ${data}\n\n`);

          if (chunk.done) {
            res.write('data: [DONE]\n\n');
            break;
          }
        }
      } catch (error) {
        const errorData = JSON.stringify({
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        res.write(`data: ${errorData}\n\n`);
      } finally {
        res.end();
      }
    } else {
      // Regular non-streaming response
      const result = await llmManager.processQuery(llmContext, {
        provider: llmOptions.provider,
        model: llmOptions.model,
        max_tokens: llmOptions.max_tokens,
        temperature: llmOptions.temperature,
      });

      const responseTime = Date.now() - startTime;

      logger.info('Query processed successfully', {
        responseTime,
        provider: result.provider,
        model: result.model,
        usage: result.usage,
        toolCalls: result.tool_calls,
      });

      res.json({
        status: 'success',
        data: {
          answer: result.response,
          metadata: {
            provider: result.provider,
            model: result.model,
            usage: result.usage,
            tool_calls: result.tool_calls,
            response_time_ms: responseTime,
          },
        },
      });
    }
  } catch (error) {
    logger.error('Query processing failed', error as Error, {
      query: req.body.query?.substring(0, 100),
      channels: req.body.channels,
    });

    if (res.headersSent) {
      // If streaming, send error through stream
      const errorData = JSON.stringify({
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      res.write(`data: ${errorData}\n\n`);
      res.end();
    } else {
      res.status(500).json({
        status: 'error',
        message: 'Query processing failed',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
});

// GET /query/health - LLM service health check
router.get('/health', validateRequest(HealthSchema), async (req, res) => {
  try {
    const { detailed } = req.body;
    const health = llmManager.getHealthStatus();

    if (detailed) {
      const providers = llmManager.getAvailableProviders();
      const providerModels: Record<string, string[]> = {};

      for (const provider of providers) {
        try {
          providerModels[provider] =
            await llmManager.getProviderModels(provider);
        } catch (error) {
          providerModels[provider] = [];
        }
      }

      res.json({
        status: 'success',
        data: {
          ...health,
          available_models: providerModels,
        },
      });
    } else {
      res.json({
        status: 'success',
        data: health,
      });
    }
  } catch (error) {
    logger.error('Health check failed', error as Error);
    res.status(500).json({
      status: 'error',
      message: 'Health check failed',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// GET /query/providers - List available LLM providers
router.get('/providers', async (_req, res) => {
  try {
    const providers = llmManager.getAvailableProviders();
    const providerDetails: Record<
      string,
      {
        name: string;
        available: boolean;
        models: string[];
      }
    > = {};

    for (const provider of providers) {
      try {
        const models = await llmManager.getProviderModels(provider);
        providerDetails[provider] = {
          name: provider,
          available: true,
          models,
        };
      } catch (error) {
        providerDetails[provider] = {
          name: provider,
          available: false,
          models: [],
        };
      }
    }

    res.json({
      status: 'success',
      data: {
        providers: providerDetails,
        total: providers.length,
      },
    });
  } catch (error) {
    logger.error('Failed to get providers', error as Error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to get providers',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// POST /query/provider - Switch LLM provider
router.post('/provider', async (req, res) => {
  try {
    const { provider } = req.body;

    if (!provider || !['openai', 'anthropic'].includes(provider)) {
      res.status(400).json({
        status: 'error',
        message: 'Invalid provider. Must be "openai" or "anthropic"',
      });
      return;
    }

    llmManager.setProvider(provider);

    logger.info(`Provider switched to: ${provider}`);

    res.json({
      status: 'success',
      data: {
        provider,
        message: `Provider switched to ${provider}`,
      },
    });
  } catch (error) {
    logger.error('Failed to switch provider', error as Error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to switch provider',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export { router as queryRouter };
