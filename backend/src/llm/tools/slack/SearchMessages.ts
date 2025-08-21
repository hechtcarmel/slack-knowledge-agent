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
    func: async (args: any) => {
      try {
        logger.info('Searching messages', {
          query: args.query.substring(0, 50) + '...',
          channels: args.channels,
          limit: args.limit,
          days_back: args.days_back,
        });

        // Convert channel names to IDs if needed
        const resolvedChannels = await Promise.all(
          args.channels.map(async (ch: string) => {
            // If it's already a channel ID (starts with C), use it
            if (ch.startsWith('C')) {
              return ch;
            }
            // Otherwise, try to resolve the channel name to ID
            const channel = await slackService.getChannelByName(ch);
            if (channel) {
              logger.debug('Resolved channel name to ID', {
                name: ch,
                id: channel.id,
              });
              return channel.id;
            }
            // If not found by name, return as-is (might be a channel name that works in search)
            logger.debug('Could not resolve channel name, using as-is', {
              channel: ch,
            });
            return ch;
          })
        );

        const searchParams: SearchParams = {
          query: args.query,
          channels: resolvedChannels,
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

        logger.debug('Search params after channel resolution', {
          originalChannels: args.channels,
          resolvedChannels,
          query: args.query,
        });

        const result = await slackService.searchMessages(searchParams);

        logger.info('Message search completed', {
          messageCount: result.messages.length,
          query: args.query.substring(0, 50) + '...',
          originalChannels: args.channels,
          resolvedChannels,
        });

        // Return plain text for ReAct agent compatibility
        if (result.messages.length === 0) {
          return `No messages found matching "${args.query}" in the specified channels.`;
        }

        // Format messages as readable text
        const formattedMessages = result.messages
          .slice(0, 10) // Limit to first 10 for readability
          .map((msg, index) => {
            const userDisplay = msg.user || 'Unknown';
            const timeDisplay = new Date(
              parseFloat(msg.ts) * 1000
            ).toLocaleString();
            return `${index + 1}. [${timeDisplay}] ${userDisplay}: ${msg.text}`;
          })
          .join('\n\n');

        const totalCount = result.messages.length;
        const showingCount = Math.min(10, totalCount);

        return `Found ${totalCount} messages matching "${args.query}"${totalCount > showingCount ? ` (showing first ${showingCount})` : ''}:\n\n${formattedMessages}`;
      } catch (error) {
        const errorMessage = `Error searching messages: ${(error as Error).message}`;
        logger.error('Message search failed', error as Error, {
          query: args.query,
          channels: args.channels,
        });

        return errorMessage;
      }
    },
  });
}
