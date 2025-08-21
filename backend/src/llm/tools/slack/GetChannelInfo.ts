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
    func: async (args: any) => {
      try {
        logger.info('Getting channel info', {
          channel_id: args.channel_id,
          receivedArgs: JSON.stringify(args),
        });

        const channel =
          (await slackService.getChannelById(args.channel_id)) ||
          (await slackService.getChannelByName(args.channel_id));

        if (!channel) {
          const errorMessage = `Channel not found: ${args.channel_id}`;
          logger.warn(errorMessage);
          return errorMessage;
        }

        logger.info('Channel info retrieved successfully', {
          channel_id: args.channel_id,
          channel_name: channel.name,
          member_count: channel.num_members,
        });

        // Return plain text for ReAct agent compatibility
        const info = [];
        info.push(`Channel: #${channel.name} (ID: ${channel.id})`);
        if (channel.purpose?.value) {
          info.push(`Purpose: ${channel.purpose.value}`);
        }
        if (channel.topic?.value) {
          info.push(`Topic: ${channel.topic.value}`);
        }
        info.push(`Members: ${channel.num_members || 0}`);
        if ((channel as any).is_private) {
          info.push(`Type: Private channel`);
        }
        if ((channel as any).is_archived) {
          info.push(`Status: Archived`);
        }

        return info.join('\n');
      } catch (error) {
        const errorMessage = `Failed to get channel info: ${(error as Error).message}`;
        logger.error('Channel info retrieval failed', error as Error, {
          channel_id: args.channel_id,
        });

        return errorMessage;
      }
    },
  });
}
