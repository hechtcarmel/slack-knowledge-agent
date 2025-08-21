import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { SlackService } from '@/services/SlackService.js';
import { Logger } from '@/utils/logger.js';

const getChannelInfoSchema = z.object({
  channel_id: z.string().describe('Channel ID or name (without # symbol)'),
});

export function createGetChannelInfoTool(
  slackService: SlackService
): DynamicStructuredTool {
  const logger = Logger.create('GetChannelInfoTool');

  return new DynamicStructuredTool({
    name: 'get_channel_info',
    description:
      'Get information about a Slack channel including its purpose, topic, and member count.',
    schema: getChannelInfoSchema,
    func: async args => {
      try {
        logger.info('Getting channel info', {
          channel_id: args.channel_id,
        });

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
              channel: null,
            },
            null,
            2
          );
        }

        const response = {
          success: true,
          channel: {
            id: channel.id,
            name: channel.name,
            purpose: channel.purpose?.value || null,
            topic: channel.topic?.value || null,
            member_count: channel.num_members || 0,
            is_private: (channel as any).is_private || false,
            is_archived: (channel as any).is_archived || false,
            created: (channel as any).created
              ? new Date((channel as any).created * 1000).toISOString()
              : null,
          },
        };

        logger.info('Channel info retrieved successfully', {
          channel_id: args.channel_id,
          channel_name: channel.name,
          member_count: channel.num_members,
        });

        return JSON.stringify(response, null, 2);
      } catch (error) {
        const errorMessage = `Failed to get channel info: ${(error as Error).message}`;
        logger.error('Channel info retrieval failed', error as Error, {
          channel_id: args.channel_id,
        });

        return JSON.stringify(
          {
            success: false,
            error: errorMessage,
            channel: null,
          },
          null,
          2
        );
      }
    },
  });
}
