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
      'CRITICAL TOOL for finding answers: Get all messages in a specific thread. ALWAYS use this when you find a message that contains a question (indicated by ? or questioning phrases) to check if it was answered in thread replies. Essential for providing complete question-answer pairs instead of just reporting unanswered questions.',
    schema: getThreadSchema,
    func: async (args: any) => {
      try {
        logger.info('Getting thread messages', {
          channel_id: args.channel_id,
          thread_ts: args.thread_ts,
        });

        // Get channel by ID or name first to validate it exists
        const channel =
          (await slackService.getChannelById(args.channel_id)) ||
          (await slackService.getChannelByName(args.channel_id));

        if (!channel) {
          const errorMessage = `Channel not found: ${args.channel_id}`;
          logger.warn(errorMessage);
          return errorMessage;
        }

        // Use SlackService method for thread retrieval
        const threadResult = await slackService.getThreadReplies(channel.id, args.thread_ts);

        logger.info('Thread retrieved successfully', {
          channel: args.channel_id,
          thread_ts: args.thread_ts,
          message_count: threadResult.messages.length,
        });

        // Return plain text for ReAct agent compatibility
        if (threadResult.messages.length === 0) {
          return `No messages found in thread ${args.thread_ts}.`;
        }

        // Format thread messages as readable text
        const formattedMessages = threadResult.messages
          .map((msg: any, index: number) => {
            const userDisplay = msg.user || 'Unknown';
            const timeDisplay = new Date(
              parseFloat(msg.ts) * 1000
            ).toLocaleString();
            const prefix = index === 0 ? 'Original' : `Reply ${index}`;
            return `${prefix} [${timeDisplay}] ${userDisplay}: ${msg.text}`;
          })
          .join('\n\n');

        // Return structured data with permalinks
        const response = {
          summary: `Thread in #${threadResult.metadata.channelName} with ${threadResult.messages.length} messages:\n\n${formattedMessages}`,
          messages: threadResult.messages.map((msg: any) => ({
            user: msg.user,
            text: msg.text,
            ts: msg.ts,
            channel: msg.channel,
            thread_ts: msg.thread_ts,
            permalink: msg.permalink
          })),
          totalCount: threadResult.messages.length
        };

        return JSON.stringify(response);
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
