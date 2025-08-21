import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { SlackService } from '@/services/SlackService.js';
import { SearchParams } from '@/types/index.js';
import { Logger } from '@/utils/logger.js';

const searchMessagesSchema = z.object({
  query: z
    .string()
    .min(1)
    .describe(
      'Search query string. Use keywords, phrases, or specific terms mentioned in messages.'
    ),
  channels: z
    .array(z.string())
    .min(1)
    .describe(
      'Array of channel IDs or names to search in. Use channel names without # symbol.'
    ),
  limit: z
    .number()
    .int()
    .min(1)
    .max(100)
    .default(20)
    .describe('Maximum number of results to return (1-100, default: 20)'),
  days_back: z
    .number()
    .int()
    .min(1)
    .max(365)
    .optional()
    .describe(
      'Search messages from this many days back (optional, 1-365 days)'
    ),
});

export function createSearchMessagesTool(
  slackService: SlackService
): DynamicStructuredTool {
  const logger = Logger.create('SearchMessagesTool');

  return new DynamicStructuredTool({
    name: 'search_messages',
    description:
      'Search for messages across Slack channels. Use this to find information mentioned in conversations.',
    schema: searchMessagesSchema,
    func: async args => {
      try {
        logger.info('Searching messages', {
          query: args.query.substring(0, 50) + '...',
          channels: args.channels,
          limit: args.limit,
          days_back: args.days_back,
        });

        const searchParams: SearchParams = {
          query: args.query,
          channels: args.channels,
          limit: args.limit,
          time_range: args.days_back
            ? {
                start: new Date(
                  Date.now() - args.days_back * 24 * 60 * 60 * 1000
                ),
                end: new Date(),
              }
            : undefined,
        };

        const result = await slackService.searchMessages(searchParams);

        const response = {
          success: true,
          messages: result.messages.map(msg => ({
            channel: msg.channel,
            user: msg.user,
            text: msg.text,
            timestamp: msg.ts,
            thread_ts: msg.thread_ts,
          })),
          metadata: {
            ...result.metadata,
            search_query: args.query,
            channels_searched: args.channels,
          },
        };

        logger.info('Message search completed', {
          messageCount: result.messages.length,
          query: args.query.substring(0, 50) + '...',
        });

        return JSON.stringify(response, null, 2);
      } catch (error) {
        const errorMessage = `Error searching messages: ${(error as Error).message}`;
        logger.error('Message search failed', error as Error, {
          query: args.query,
          channels: args.channels,
        });

        return JSON.stringify(
          {
            success: false,
            error: errorMessage,
            messages: [],
            metadata: {
              search_query: args.query,
              channels_searched: args.channels,
            },
          },
          null,
          2
        );
      }
    },
  });
}
