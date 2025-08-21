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
    .describe('Maximum number of results per page (1-100, default: 20)'),
  days_back: z
    .number()
    .int()
    .min(1)
    .max(365)
    .optional()
    .describe(
      'Search messages from this many days back (optional, 1-365 days)'
    ),
  cursor: z
    .string()
    .optional()
    .describe(
      'Cursor for pagination - use "*" for first page, then next_cursor from previous response'
    ),
  max_pages: z
    .number()
    .int()
    .min(1)
    .max(10)
    .default(3)
    .describe('Maximum pages to retrieve (safety limit, default: 3)'),
  auto_paginate: z
    .boolean()
    .default(false)
    .describe('Whether to automatically fetch additional pages if needed'),
});

export function createSearchMessagesTool(
  slackService: SlackService
): DynamicStructuredTool {
  const logger = Logger.create('SearchMessagesTool');

  return new DynamicStructuredTool({
    name: 'search_messages',
    description:
      'Search for messages across Slack channels with intelligent pagination support. Use this to find information mentioned in conversations. Set auto_paginate=true for comprehensive searches when you need thorough coverage.',
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
          cursor: args.cursor,
          max_pages: args.max_pages,
          auto_paginate: args.auto_paginate,
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
          autoPaginate: args.auto_paginate,
          maxPages: args.max_pages,
        });

        // Return plain text for ReAct agent compatibility
        if (result.messages.length === 0) {
          const paginationNote = args.auto_paginate
            ? ' (searched multiple pages automatically)'
            : ' (single page search)';
          return `No messages found matching "${args.query}" in the specified channels${paginationNote}.`;
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

        // Add pagination information to the response
        let paginationInfo = '';
        if (args.auto_paginate) {
          paginationInfo = ` (auto-paginated through ${args.max_pages || 3} pages)`;
        } else if (args.cursor && args.cursor !== '*') {
          paginationInfo = ` (continued from previous search)`;
        } else {
          paginationInfo = ` (single page - use auto_paginate=true for comprehensive search)`;
        }

        // Note: We can't easily determine if there are more pages available from this level
        // The SlackService would need to be updated to return pagination metadata
        return `Found ${totalCount} messages matching "${args.query}"${paginationInfo}${totalCount > showingCount ? ` (showing first ${showingCount})` : ''}:\n\n${formattedMessages}`;
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
