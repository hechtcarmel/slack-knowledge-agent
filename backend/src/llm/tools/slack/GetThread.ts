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
    func: async (args: any) => {
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
          return errorMessage;
        }

        // Use SlackClient directly for thread retrieval
        const threadMessages = await (
          slackService as any
        ).client.getThreadReplies(channel.id, args.thread_ts);

        logger.info('Thread retrieved successfully', {
          channel: args.channel_id,
          thread_ts: args.thread_ts,
          message_count: threadMessages.messages.length,
        });

        // Return plain text for ReAct agent compatibility
        if (threadMessages.messages.length === 0) {
          return `No messages found in thread ${args.thread_ts}.`;
        }

        // Format thread messages as readable text
        const formattedMessages = threadMessages.messages
          .map((msg: any, index: number) => {
            const userDisplay = msg.user || 'Unknown';
            const timeDisplay = new Date(
              parseFloat(msg.ts) * 1000
            ).toLocaleString();
            const prefix = index === 0 ? 'Original' : `Reply ${index}`;
            return `${prefix} [${timeDisplay}] ${userDisplay}: ${msg.text}`;
          })
          .join('\n\n');

        return `Thread in #${channel.name} with ${threadMessages.messages.length} messages:\n\n${formattedMessages}`;
      } catch (error) {
        const errorMessage = `Failed to get thread: ${(error as Error).message}`;
        logger.error('Thread retrieval failed', error as Error, {
          channel_id: args.channel_id,
          thread_ts: args.thread_ts,
        });

        return errorMessage;
      }
    },
  });
}
