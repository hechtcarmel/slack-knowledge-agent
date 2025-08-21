import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { SlackService } from '@/services/SlackService.js';
import { FileListParams } from '@/types/index.js';
import { Logger } from '@/utils/logger.js';

const listFilesSchema = z.object({
  channels: z
    .array(z.string())
    .min(1)
    .describe('Array of channel IDs or names to search for files'),
  file_types: z
    .array(z.string())
    .optional()
    .describe(
      "Filter by file types (e.g., ['pdf', 'txt', 'doc', 'png', 'jpg'])"
    ),
  limit: z
    .number()
    .int()
    .min(1)
    .max(100)
    .default(20)
    .describe('Maximum number of files to return (1-100, default: 20)'),
});

export function createListFilesTool(
  slackService: SlackService
): DynamicStructuredTool {
  const logger = Logger.create('ListFilesTool');

  return new DynamicStructuredTool({
    name: 'list_files',
    description:
      'List files shared in Slack channels. Use this to find documents, images, or other files mentioned in conversations.',
    schema: listFilesSchema,
    func: async args => {
      try {
        logger.info('Listing files', {
          channels: args.channels,
          file_types: args.file_types,
          limit: args.limit,
        });

        const fileParams: FileListParams = {
          channels: args.channels,
          types: args.file_types,
          limit: args.limit,
        };

        const result = await slackService.getFiles(fileParams);

        const response = {
          success: true,
          files: result.files.map(file => ({
            id: file.id,
            name: file.name,
            filetype: file.filetype,
            size: file.size,
            channels: file.channels,
            user: (file as any).user,
            timestamp: (file as any).timestamp,
            title: (file as any).title,
            mimetype: (file as any).mimetype,
            is_public: (file as any).is_public,
            url_private: file.url_private,
          })),
          metadata: {
            ...result.metadata,
            channels_searched: args.channels,
            file_types_filter: args.file_types,
            limit_requested: args.limit,
            file_count: result.files.length,
          },
        };

        logger.info('File list retrieved successfully', {
          channels: args.channels,
          file_count: result.files.length,
          file_types: args.file_types,
        });

        return JSON.stringify(response, null, 2);
      } catch (error) {
        const errorMessage = `Failed to list files: ${(error as Error).message}`;
        logger.error('File listing failed', error as Error, {
          channels: args.channels,
          file_types: args.file_types,
        });

        return JSON.stringify(
          {
            success: false,
            error: errorMessage,
            files: [],
            metadata: {
              channels_searched: args.channels,
              file_types_filter: args.file_types,
              limit_requested: args.limit,
            },
          },
          null,
          2
        );
      }
    },
  });
}
