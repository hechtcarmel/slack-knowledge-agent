import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { SlackService } from '@/services/SlackService.js';
import { Logger } from '@/utils/logger.js';

const getFileContentSchema = z.object({
  file_id: z.string().describe('File ID from Slack (obtained from list_files)'),
});

export function createGetFileContentTool(
  slackService: SlackService
): DynamicStructuredTool {
  const logger = Logger.create('GetFileContentTool');

  return new DynamicStructuredTool({
    name: 'get_file_content',
    description:
      'Get the content of a text file from Slack. Use this to read documents, code files, or other text-based files.',
    schema: getFileContentSchema,
    func: async args => {
      try {
        logger.info('Getting file content', {
          file_id: args.file_id,
        });

        const content = await slackService.getFileContent(args.file_id);

        const response = {
          success: true,
          file: {
            id: args.file_id,
            content: content,
            content_length: content.length,
          },
        };

        logger.info('File content retrieved successfully', {
          file_id: args.file_id,
          content_length: content.length,
        });

        return JSON.stringify(response, null, 2);
      } catch (error) {
        const errorMessage = `Failed to get file content: ${(error as Error).message}`;
        logger.error('File content retrieval failed', error as Error, {
          file_id: args.file_id,
        });

        return JSON.stringify(
          {
            success: false,
            error: errorMessage,
            file: {
              id: args.file_id,
              content: null,
            },
          },
          null,
          2
        );
      }
    },
  });
}
