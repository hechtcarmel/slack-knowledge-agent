import { Router, type Router as ExpressRouter } from 'express';
import { z } from 'zod';
import { SlackService } from '@/services/SlackService.js';
import { Logger } from '@/utils/logger.js';
import { validateRequest } from '@/middleware/validation.js';
import { SearchParams, FileListParams } from '@/types/index.js';

const router: ExpressRouter = Router();
const logger = Logger.create('SlackRoutes');

// Validation schemas
const SearchSchema = z.object({
  query: z.string().min(1),
  channels: z.array(z.string()).min(1),
  limit: z.number().int().min(1).max(1000).default(100),
  time_range: z
    .object({
      start: z.string().datetime(),
      end: z.string().datetime(),
    })
    .optional(),
});

const ChannelHistorySchema = z.object({
  limit: z.number().int().min(1).max(1000).default(100),
  oldest: z.string().optional(),
  latest: z.string().optional(),
  includeThreads: z.boolean().default(false),
});

const FileListSchema = z.object({
  channels: z.array(z.string()).min(1),
  types: z.array(z.string()).optional(),
  limit: z.number().int().min(1).max(1000).default(100),
});

// Initialize SlackService (will be injected by server)
let slackService: SlackService;

export function initializeSlackRoutes(service: SlackService) {
  slackService = service;
}

// GET /slack/health - Health check
router.get('/health', async (_req, res) => {
  try {
    const health = slackService.getHealthStatus();
    res.json({
      status: 'success',
      data: health,
    });
  } catch (error) {
    logger.error('Health check failed', error as Error);
    res.status(500).json({
      status: 'error',
      message: 'Health check failed',
    });
  }
});

// GET /slack/channels - Get all channels
router.get('/channels', async (req, res) => {
  try {
    const refresh = req.query.refresh === 'true';
    const channels = await slackService.getChannels(refresh);

    res.json({
      status: 'success',
      data: {
        channels,
        total: channels.length,
      },
    });
  } catch (error) {
    logger.error('Failed to get channels', error as Error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to retrieve channels',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// GET /slack/channels/:id - Get channel by ID
router.get('/channels/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const channel = await slackService.getChannelById(id);

    if (!channel) {
      res.status(404).json({
        status: 'error',
        message: 'Channel not found',
      });
      return;
    }

    res.json({
      status: 'success',
      data: channel,
    });
  } catch (error) {
    logger.error('Failed to get channel', error as Error, {
      channelId: req.params.id,
    });
    res.status(500).json({
      status: 'error',
      message: 'Failed to retrieve channel',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// GET /slack/channels/:id/history - Get channel message history
router.get(
  '/channels/:id/history',
  validateRequest(ChannelHistorySchema),
  async (req, res) => {
    try {
      const { id } = req.params;
      const options = req.body;

      const result = await slackService.getChannelHistory(id, options);

      res.json({
        status: 'success',
        data: result,
      });
    } catch (error) {
      logger.error('Failed to get channel history', error as Error, {
        channelId: req.params.id,
      });
      res.status(500).json({
        status: 'error',
        message: 'Failed to retrieve channel history',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
);

// POST /slack/search - Search messages
router.post('/search', validateRequest(SearchSchema), async (req, res) => {
  try {
    const params: SearchParams = {
      ...req.body,
      time_range: req.body.time_range
        ? {
            start: new Date(req.body.time_range.start),
            end: new Date(req.body.time_range.end),
          }
        : undefined,
    };

    const result = await slackService.searchMessages(params);

    res.json({
      status: 'success',
      data: result,
    });
  } catch (error) {
    logger.error('Message search failed', error as Error, {
      query: req.body.query,
    });
    res.status(500).json({
      status: 'error',
      message: 'Message search failed',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// POST /slack/files - Get files from channels
router.post('/files', validateRequest(FileListSchema), async (req, res) => {
  try {
    const params: FileListParams = req.body;
    const result = await slackService.getFiles(params);

    res.json({
      status: 'success',
      data: result,
    });
  } catch (error) {
    logger.error('Failed to get files', error as Error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to retrieve files',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// GET /slack/files/:id/content - Get file content
router.get('/files/:id/content', async (req, res) => {
  try {
    const { id } = req.params;
    const content = await slackService.getFileContent(id);

    res.json({
      status: 'success',
      data: {
        fileId: id,
        content,
      },
    });
  } catch (error) {
    logger.error('Failed to get file content', error as Error, {
      fileId: req.params.id,
    });
    res.status(500).json({
      status: 'error',
      message: 'Failed to retrieve file content',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// GET /slack/users/:id - Get user info
router.get('/users/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const user = await slackService.getUserInfo(id);

    res.json({
      status: 'success',
      data: user,
    });
  } catch (error) {
    logger.error('Failed to get user info', error as Error, {
      userId: req.params.id,
    });
    res.status(500).json({
      status: 'error',
      message: 'Failed to retrieve user information',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export { router as slackRouter };
