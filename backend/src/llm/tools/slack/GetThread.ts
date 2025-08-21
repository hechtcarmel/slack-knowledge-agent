import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { SlackService } from '@/services/SlackService.js';
import { Logger } from '@/utils/logger.js';

const getThreadSchema = z.object({
  channel_id: z.string().describe('Channel ID or name where the thread exists'),
  thread_ts: z
    .string()
    .describe('Timestamp of the parent message that started the thread'),
});

export function createGetThreadTool(
  slackService: SlackService
): DynamicStructuredTool {
  const logger = Logger.create('GetThreadTool');

  return new DynamicStructuredTool({
    name: 'get_thread',
    description:
      'Get all messages in a specific thread. Use this when you need to see the full context of a threaded conversation.',
    schema: getThreadSchema,
    func: async args => {
      try {
        logger.info('Getting thread messages', {
          channel_id: args.channel_id,
          thread_ts: args.thread_ts,
        });

        // Get channel by ID or name
        const channel =
          (await slackService.getChannelById(args.channel_id)) ||
          (await slackService.getChannelByName(args.channel_id));

        if (!channel) {
          const errorMessage = `Channel not found: ${args.channel_id}`;
          logger.warn(errorMessage);

          return JSON.stringify(
            {
              success: false,
              error: errorMessage,
              thread: null,
            },
            null,
            2
          );
        }

        // Use SlackClient directly for thread retrieval
        const threadMessages = await (
          slackService as any
        ).client.getThreadReplies(channel.id, args.thread_ts);

        const response = {
          success: true,
          thread: {
            channel: threadMessages.channel,
            thread_ts: threadMessages.thread_ts,
            message_count: threadMessages.messages.length,
            messages: threadMessages.messages.map((msg: any) => ({
              user: msg.user,
              text: msg.text,
              timestamp: msg.ts,
              thread_ts: msg.thread_ts,
              is_parent: msg.ts === args.thread_ts,
            })),
          },
        };

        logger.info('Thread retrieved successfully', {
          channel: args.channel_id,
          thread_ts: args.thread_ts,
          message_count: threadMessages.messages.length,
        });

        return JSON.stringify(response, null, 2);
      } catch (error) {
        const errorMessage = `Failed to get thread: ${(error as Error).message}`;
        logger.error('Thread retrieval failed', error as Error, {
          channel_id: args.channel_id,
          thread_ts: args.thread_ts,
        });

        return JSON.stringify(
          {
            success: false,
            error: errorMessage,
            thread: null,
          },
          null,
          2
        );
      }
    },
  });
}
