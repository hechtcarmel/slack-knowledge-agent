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
    func: async (args: any) => {
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

        logger.info('Channel history retrieved successfully', {
          channel: args.channel_id,
          message_count: result.messages.length,
          limit: args.limit,
        });

        // Return plain text for ReAct agent compatibility
        if (result.messages.length === 0) {
          return `No messages found in channel ${result.metadata.channelName || args.channel_id}.`;
        }

        // Format messages as readable text
        const formattedMessages = result.messages
          .map((msg, index) => {
            const messageNum = result.messages.length - index; // Reverse numbering so latest is #1
            const userDisplay = msg.user || 'Unknown';
            const timeDisplay = new Date(
              parseFloat(msg.ts) * 1000
            ).toLocaleString();
            return `Message #${messageNum} (${timeDisplay}) from ${userDisplay}: ${msg.text}`;
          })
          .reverse() // Show most recent first
          .join('\n\n');

        return `Found ${result.messages.length} messages in channel ${result.metadata.channelName || args.channel_id}:\n\n${formattedMessages}`;
      } catch (error) {
        const errorMessage = `Failed to get channel history: ${(error as Error).message}`;
        logger.error('Channel history retrieval failed', error as Error, {
          channel_id: args.channel_id,
          limit: args.limit,
        });

        return errorMessage;
      }
    },
  });
}
