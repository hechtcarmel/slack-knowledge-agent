import { Router, Request, Response } from 'express';
import { Logger } from '../utils/logger.js';
import { WebhookError } from '../utils/errors.js';
import { IWebhookService } from '../interfaces/services/IWebhookService.js';

const router = Router();
const logger = Logger.create('WebhookRoutes');

// Initialize WebhookService (will be injected by server)
let webhookService: IWebhookService;

export function initializeWebhookRoutes(service: IWebhookService) {
  webhookService = service;
}

/**
 * Middleware to capture raw body for signature validation
 */
function captureRawBody(req: Request, res: Response, next: Function) {
  const chunks: Buffer[] = [];

  req.on('data', chunk => {
    chunks.push(chunk);
  });

  req.on('end', () => {
    req.body = Buffer.concat(chunks);
    (req as any).rawBody = req.body.toString('utf8');

    // Parse JSON for further processing
    try {
      req.body = JSON.parse((req as any).rawBody);
    } catch (error) {
      // Keep raw body if JSON parsing fails
      req.body = {};
    }

    next();
  });
}

/**
 * POST /slack/events - Main webhook endpoint
 *
 * Handles all incoming Slack events including:
 * - URL verification challenges
 * - App mention events
 * - Direct message events
 * - Rate limiting notifications
 */
router.post('/events', captureRawBody, async (req: Request, res: Response) => {
  const startTime = Date.now();

  try {
    const rawBody = (req as any).rawBody;
    const signature = req.headers['x-slack-signature'] as string;
    const timestamp = req.headers['x-slack-request-timestamp'] as string;

    logger.info('Webhook event received', {
      bodyLength: rawBody?.length || 0,
      hasSignature: !!signature,
      timestamp,
      userAgent: req.headers['user-agent'],
    });

    if (!webhookService) {
      logger.error('WebhookService not initialized');
      return res.status(500).json({
        error: 'Webhook service not available',
      });
    }

    // Process the webhook event
    const result = await webhookService.handleSlackEvent(
      rawBody,
      signature,
      timestamp
    );

    const processingTime = Date.now() - startTime;

    logger.info('Webhook event processed', {
      statusCode: result.statusCode,
      processingTime,
      hasBody: !!result.body,
    });

    // Set response headers if provided
    if (result.headers) {
      Object.entries(result.headers).forEach(([key, value]) => {
        res.set(key, value);
      });
    }

    res.status(result.statusCode).json(result.body || {});
  } catch (error) {
    const processingTime = Date.now() - startTime;

    logger.error('Webhook endpoint error', error as Error, {
      processingTime,
      path: req.path,
      method: req.method,
    });

    if (error instanceof WebhookError) {
      res.status(error.statusCode).json({
        error: error.message,
        code: error.code,
      });
    } else {
      res.status(500).json({
        error: 'Internal server error',
      });
    }
  }
});

/**
 * GET /webhook/health - Webhook health check
 */
router.get('/health', async (_req: Request, res: Response) => {
  try {
    if (!webhookService) {
      return res.status(503).json({
        status: 'error',
        message: 'Webhook service not initialized',
      });
    }

    const health = webhookService.getHealthStatus();
    const statusCode =
      health.status === 'healthy'
        ? 200
        : health.status === 'degraded'
          ? 200
          : 503;

    res.status(statusCode).json({
      status: 'success',
      data: health,
    });
  } catch (error) {
    logger.error('Webhook health check failed', error as Error);
    res.status(500).json({
      status: 'error',
      message: 'Health check failed',
    });
  }
});

/**
 * GET /webhook/stats - Webhook processing statistics
 */
router.get('/stats', async (_req: Request, res: Response) => {
  try {
    if (!webhookService) {
      return res.status(503).json({
        status: 'error',
        message: 'Webhook service not initialized',
      });
    }

    const stats = webhookService.getStats();

    res.json({
      status: 'success',
      data: stats,
    });
  } catch (error) {
    logger.error('Failed to get webhook stats', error as Error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to retrieve statistics',
    });
  }
});

export { router as webhookRouter };
