import { Router, type Router as ExpressRouter } from 'express';
import { Logger } from '@/utils/logger.js';
import { SlackService } from '@/services/SlackService.js';
import { createSlackTools } from '@/llm/tools/index.js';

const router: ExpressRouter = Router();
const logger = Logger.create('DebugRoutes');

// Debug service (will be injected by server)
let slackService: SlackService;

export function initializeDebugRoutes(slack: SlackService) {
  slackService = slack;
}

// GET /debug/tools - List available tools and their schemas
router.get('/tools', async (_req, res) => {
  try {
    if (!slackService) {
      res.status(503).json({
        status: 'error',
        message: 'SlackService not initialized',
      });
      return;
    }

    const tools = createSlackTools(slackService);
    const toolInfo = tools.map(tool => ({
      name: tool.name,
      description: tool.description,
      schema: tool.schema,
    }));

    res.json({
      status: 'success',
      data: {
        tools: toolInfo,
        count: tools.length,
      },
    });
  } catch (error) {
    logger.error('Failed to get tools info', error as Error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to get tools info',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// POST /debug/test-tool - Test a specific tool with provided parameters
router.post('/test-tool', async (req, res) => {
  try {
    if (!slackService) {
      res.status(503).json({
        status: 'error',
        message: 'SlackService not initialized',
      });
      return;
    }

    const { toolName, parameters } = req.body;

    if (!toolName || !parameters) {
      res.status(400).json({
        status: 'error',
        message: 'toolName and parameters are required',
      });
      return;
    }

    logger.info('Testing tool', { toolName, parameters });

    const tools = createSlackTools(slackService);
    const tool = tools.find(t => t.name === toolName);

    if (!tool) {
      res.status(404).json({
        status: 'error',
        message: `Tool '${toolName}' not found`,
        availableTools: tools.map(t => t.name),
      });
      return;
    }

    // Test parameter validation
    let validatedParams;
    try {
      validatedParams = tool.schema.parse(parameters);
    } catch (validationError) {
      res.status(400).json({
        status: 'error',
        message: 'Parameter validation failed',
        validationError:
          validationError instanceof Error
            ? validationError.message
            : String(validationError),
        schema: tool.schema,
        providedParameters: parameters,
      });
      return;
    }

    // Execute the tool
    const startTime = Date.now();
    const result = await tool.func(validatedParams);
    const executionTime = Date.now() - startTime;

    logger.info('Tool executed successfully', {
      toolName,
      executionTime,
      resultLength: typeof result === 'string' ? result.length : 'non-string',
    });

    res.json({
      status: 'success',
      data: {
        toolName,
        parameters: validatedParams,
        result,
        executionTime,
      },
    });
  } catch (error) {
    logger.error('Tool execution failed', error as Error, {
      toolName: req.body.toolName,
      parameters: req.body.parameters,
    });

    res.status(500).json({
      status: 'error',
      message: 'Tool execution failed',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// GET /debug/channels - List available channels for debugging
router.get('/channels', async (_req, res) => {
  try {
    if (!slackService) {
      res.status(503).json({
        status: 'error',
        message: 'SlackService not initialized',
      });
      return;
    }

    const channels = await slackService.getChannels();

    res.json({
      status: 'success',
      data: {
        channels: channels.map(ch => ({
          id: ch.id,
          name: ch.name,
          purpose: ch.purpose?.value,
          topic: ch.topic?.value,
          members: ch.num_members,
        })),
        count: channels.length,
      },
    });
  } catch (error) {
    logger.error('Failed to get channels', error as Error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to get channels',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export { router as debugRouter };
