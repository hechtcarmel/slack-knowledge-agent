import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { SlackService } from '@/services/SlackService.js';
import { Logger } from '@/utils/logger.js';

const getChannelHistorySchema = z.object({
  channel_id: z.string().describe('Channel ID or name (without # symbol)'),
  limit: z
    .number()
    .int()
    .min(1)
    .max(200)
    .default(50)
    .describe('Maximum number of messages to retrieve (1-200, default: 50)'),
  include_threads: z
    .boolean()
    .default(false)
    .describe(
      'Whether to include thread replies in the results (default: false)'
    ),
});

export function createGetChannelHistoryTool(
  slackService: SlackService
): DynamicStructuredTool {
  const logger = Logger.create('GetChannelHistoryTool');

  return new DynamicStructuredTool({
    name: 'get_channel_history',
    description:
      'Get recent messages from a specific Slack channel. Use this to understand recent conversations or context.',
    schema: getChannelHistorySchema,
    func: async args => {
      try {
        logger.info('Getting channel history', {
          channel_id: args.channel_id,
          limit: args.limit,
          include_threads: args.include_threads,
        });

        const result = await slackService.getChannelHistory(args.channel_id, {
          limit: args.limit,
          includeThreads: args.include_threads,
        });

        const response = {
          success: true,
          channel: args.channel_id,
          messages: result.messages.map(msg => ({
            channel: msg.channel,
            user: msg.user,
            text: msg.text,
            timestamp: msg.ts,
            thread_ts: msg.thread_ts,
            has_thread: !!msg.thread_ts && msg.thread_ts !== msg.ts,
          })),
          metadata: {
            ...result.metadata,
            channel_requested: args.channel_id,
            limit_requested: args.limit,
            include_threads: args.include_threads,
            message_count: result.messages.length,
          },
        };

        logger.info('Channel history retrieved successfully', {
          channel: args.channel_id,
          message_count: result.messages.length,
          limit: args.limit,
        });

        return JSON.stringify(response, null, 2);
      } catch (error) {
        const errorMessage = `Failed to get channel history: ${(error as Error).message}`;
        logger.error('Channel history retrieval failed', error as Error, {
          channel_id: args.channel_id,
          limit: args.limit,
        });

        return JSON.stringify(
          {
            success: false,
            error: errorMessage,
            messages: [],
            metadata: {
              channel_requested: args.channel_id,
              limit_requested: args.limit,
              include_threads: args.include_threads,
            },
          },
          null,
          2
        );
      }
    },
  });
}
