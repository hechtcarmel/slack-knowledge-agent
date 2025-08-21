import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { SlackService } from '@/services/SlackService.js';
import { SearchParams } from '@/types/index.js';
import { Logger } from '@/utils/logger.js';

const searchMoreMessagesSchema = z.object({
  previous_query: z
    .string()
    .min(1)
    .describe('The exact query from the previous search'),
  previous_channels: z
    .array(z.string())
    .min(1)
    .describe('Array of channel IDs or names from previous search'),
  cursor: z
    .string()
    .optional()
    .describe(
      'The next_cursor value from previous search response (if available)'
    ),
  why_more_needed: z
    .string()
    .min(10)
    .describe(
      'Explain why additional results are needed - what specific information is missing'
    ),
  max_additional_pages: z
    .number()
    .int()
    .min(1)
    .max(5)
    .default(2)
    .describe('Maximum additional pages to retrieve (default: 2, max: 5)'),
});

export function createSearchMoreMessagesTool(
  slackService: SlackService
): DynamicStructuredTool {
  const logger = Logger.create('SearchMoreMessagesTool');

  return new DynamicStructuredTool({
    name: 'search_more_messages',
    description:
      "Continue searching for more messages from a previous search. Use this when initial search results don't fully answer the query and you suspect more relevant information exists in additional pages. Always provide clear justification for why more results are needed.",
    schema: searchMoreMessagesSchema,
    func: async (args: any) => {
      try {
        logger.info('Continuing search with pagination', {
          previousQuery: args.previous_query.substring(0, 50) + '...',
          channels: args.previous_channels,
          justification: args.why_more_needed,
          maxPages: args.max_additional_pages,
        });

        // Build search parameters for continuation
        const searchParams: SearchParams = {
          query: args.previous_query,
          channels: args.previous_channels,
          limit: 20, // Standard page size
          cursor: args.cursor || '*', // If no cursor provided, start from beginning
          max_pages: args.max_additional_pages,
          auto_paginate: true, // Always auto-paginate for this tool
        };

        const result = await slackService.searchMessages(searchParams);

        logger.info('Additional search completed', {
          messageCount: result.messages.length,
          justification: args.why_more_needed,
          channels: args.previous_channels,
        });

        // Return plain text with context about the continuation
        if (result.messages.length === 0) {
          return `No additional messages found for query "${args.previous_query}". 

Reason for additional search: ${args.why_more_needed}

This may indicate that the original results were comprehensive, or the information you're looking for doesn't exist in the searched channels.`;
        }

        // Format messages as readable text
        const formattedMessages = result.messages
          .slice(0, 15) // Show more results since this is a continuation search
          .map((msg, index) => {
            const userDisplay = msg.user || 'Unknown';
            const timeDisplay = new Date(
              parseFloat(msg.ts) * 1000
            ).toLocaleString();
            return `${index + 1}. [${timeDisplay}] ${userDisplay}: ${msg.text}`;
          })
          .join('\n\n');

        const totalCount = result.messages.length;
        const showingCount = Math.min(15, totalCount);

        return `Additional search results for "${args.previous_query}":

Reason for continuation: ${args.why_more_needed}

Found ${totalCount} additional messages${totalCount > showingCount ? ` (showing first ${showingCount})` : ''}:

${formattedMessages}

${totalCount > showingCount ? '\n[Additional results truncated for readability]' : ''}`;
      } catch (error) {
        const errorMessage = `Error in continued search: ${(error as Error).message}`;
        logger.error('Continued message search failed', error as Error, {
          previousQuery: args.previous_query,
          channels: args.previous_channels,
          justification: args.why_more_needed,
        });

        return errorMessage;
      }
    },
  });
}
