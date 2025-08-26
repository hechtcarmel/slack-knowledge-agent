import { z } from 'zod';
import { SlackService } from '@/services/SlackService.js';
import { ToolDefinition, ToolFunction, ToolExecutionResult } from '../types.js';
import { SearchParams, FileListParams } from '@/types/index.js';

export class SlackTools {
  constructor(private slackService: SlackService) {}

  // Schema definitions for parameter validation
  private searchMessagesSchema = z.object({
    query: z.string().min(1).describe('Search query string'),
    channels: z
      .array(z.string())
      .min(1)
      .describe('Array of channel IDs or names to search'),
    limit: z
      .number()
      .int()
      .min(1)
      .max(100)
      .default(20)
      .describe('Maximum number of results (1-100)'),
    days_back: z
      .number()
      .int()
      .min(1)
      .max(365)
      .optional()
      .describe('Search messages from this many days back'),
  });

  private getChannelHistorySchema = z.object({
    channel_id: z.string().describe('Channel ID or name'),
    limit: z
      .number()
      .int()
      .min(1)
      .max(200)
      .default(50)
      .describe('Maximum number of messages (1-200)'),
    include_threads: z
      .boolean()
      .default(false)
      .describe('Whether to include thread replies'),
  });

  private getThreadSchema = z.object({
    channel_id: z.string().describe('Channel ID or name'),
    thread_ts: z.string().describe('Timestamp of the parent message'),
  });

  private getChannelInfoSchema = z.object({
    channel_id: z.string().describe('Channel ID or name'),
  });

  private listFilesSchema = z.object({
    channels: z
      .array(z.string())
      .min(1)
      .describe('Array of channel IDs or names'),
    file_types: z
      .array(z.string())
      .optional()
      .describe('Filter by file types (e.g., ["pdf", "txt", "doc"])'),
    limit: z
      .number()
      .int()
      .min(1)
      .max(100)
      .default(20)
      .describe('Maximum number of files (1-100)'),
  });

  private getFileContentSchema = z.object({
    file_id: z.string().describe('File ID from Slack'),
  });


  // Tool definitions
  getSearchMessagesTool(): {
    definition: ToolDefinition;
    handler: ToolFunction;
  } {
    return {
      definition: {
        type: 'function',
        function: {
          name: 'search_messages',
          description:
            'Search for messages across Slack channels. Use this to find information mentioned in conversations.',
          parameters: {
            type: 'object',
            properties: {
              query: {
                type: 'string',
                description:
                  'Search query string. Use keywords, phrases, or specific terms mentioned in messages.',
              },
              channels: {
                type: 'array',
                items: { type: 'string' },
                description:
                  'Array of channel IDs or names to search in. Use channel names without # symbol.',
              },
              limit: {
                type: 'number',
                description:
                  'Maximum number of results to return (1-100, default: 20)',
              },
              days_back: {
                type: 'number',
                description:
                  'Search messages from this many days back (optional, 1-365 days)',
              },
            },
            required: ['query', 'channels'],
          },
        },
      },
      handler: this.searchMessages.bind(this),
    };
  }

  getChannelHistoryTool(): {
    definition: ToolDefinition;
    handler: ToolFunction;
  } {
    return {
      definition: {
        type: 'function',
        function: {
          name: 'get_channel_history',
          description:
            'Get recent messages from a specific Slack channel. Use this to understand recent conversations or context.',
          parameters: {
            type: 'object',
            properties: {
              channel_id: {
                type: 'string',
                description: 'Channel ID or name (without # symbol)',
              },
              limit: {
                type: 'number',
                description:
                  'Maximum number of messages to retrieve (1-200, default: 50)',
              },
              include_threads: {
                type: 'boolean',
                description:
                  'Whether to include thread replies in the results (default: false)',
              },
            },
            required: ['channel_id'],
          },
        },
      },
      handler: this.getChannelHistory.bind(this),
    };
  }

  getThreadTool(): { definition: ToolDefinition; handler: ToolFunction } {
    return {
      definition: {
        type: 'function',
        function: {
          name: 'get_thread',
          description:
            'Get all messages in a specific thread. Use this when you need to see the full context of a threaded conversation.',
          parameters: {
            type: 'object',
            properties: {
              channel_id: {
                type: 'string',
                description: 'Channel ID or name where the thread exists',
              },
              thread_ts: {
                type: 'string',
                description:
                  'Timestamp of the parent message that started the thread',
              },
            },
            required: ['channel_id', 'thread_ts'],
          },
        },
      },
      handler: this.getThread.bind(this),
    };
  }

  getChannelInfoTool(): { definition: ToolDefinition; handler: ToolFunction } {
    return {
      definition: {
        type: 'function',
        function: {
          name: 'get_channel_info',
          description:
            'Get information about a Slack channel including its purpose, topic, and member count.',
          parameters: {
            type: 'object',
            properties: {
              channel_id: {
                type: 'string',
                description: 'Channel ID or name (without # symbol)',
              },
            },
            required: ['channel_id'],
          },
        },
      },
      handler: this.getChannelInfo.bind(this),
    };
  }

  getListFilesTool(): { definition: ToolDefinition; handler: ToolFunction } {
    return {
      definition: {
        type: 'function',
        function: {
          name: 'list_files',
          description:
            'List files shared in Slack channels. Use this to find documents, images, or other files mentioned in conversations.',
          parameters: {
            type: 'object',
            properties: {
              channels: {
                type: 'array',
                items: { type: 'string' },
                description:
                  'Array of channel IDs or names to search for files',
              },
              file_types: {
                type: 'array',
                items: { type: 'string' },
                description:
                  'Filter by file types (e.g., ["pdf", "txt", "doc", "png", "jpg"])',
              },
              limit: {
                type: 'number',
                description:
                  'Maximum number of files to return (1-100, default: 20)',
              },
            },
            required: ['channels'],
          },
        },
      },
      handler: this.listFiles.bind(this),
    };
  }

  getFileContentTool(): { definition: ToolDefinition; handler: ToolFunction } {
    return {
      definition: {
        type: 'function',
        function: {
          name: 'get_file_content',
          description:
            'Get the content of a text file from Slack. Use this to read documents, code files, or other text-based files.',
          parameters: {
            type: 'object',
            properties: {
              file_id: {
                type: 'string',
                description: 'File ID from Slack (obtained from list_files)',
              },
            },
            required: ['file_id'],
          },
        },
      },
      handler: this.getFileContent.bind(this),
    };
  }


  // Tool handler implementations
  private async searchMessages(params: any): Promise<ToolExecutionResult> {
    try {
      const validatedParams = this.searchMessagesSchema.parse(params);

      // Build search parameters
      const searchParams: SearchParams = {
        query: validatedParams.query,
        channels: validatedParams.channels,
        limit: validatedParams.limit,
        time_range: validatedParams.days_back
          ? {
              start: new Date(
                Date.now() - validatedParams.days_back * 24 * 60 * 60 * 1000
              ),
              end: new Date(),
            }
          : undefined,
      };

      const result = await this.slackService.searchMessages(searchParams);

      return {
        success: true,
        data: {
          messages: result.messages.map(msg => ({
            channel: msg.channel,
            user: msg.user,
            text: msg.text,
            timestamp: msg.ts,
            thread_ts: msg.thread_ts,
          })),
          metadata: result.metadata,
        },
      };
    } catch (error) {
      const errorMessage = (error as Error).message;

      // Provide more specific error messages for common access issues
      if (
        errorMessage.includes('not_in_channel') ||
        errorMessage.includes('Cannot access channel')
      ) {
        return {
          success: false,
          error: `Cannot access one or more channels in search. The bot needs to be invited to these channels by a member. Please ask a channel member to invite the bot using: /invite @your-bot-name`,
        };
      } else if (
        errorMessage.includes('search_not_available') ||
        errorMessage.includes('paid_only')
      ) {
        return {
          success: false,
          error: `Search functionality requires a paid Slack plan or additional permissions.`,
        };
      } else if (
        errorMessage.includes('missing_scope') ||
        errorMessage.includes('invalid_auth')
      ) {
        return {
          success: false,
          error: `Search functionality requires a valid user token with search:read scope. Please check your SLACK_USER_TOKEN configuration.`,
        };
      }

      return {
        success: false,
        error: `Failed to search messages: ${errorMessage}`,
      };
    }
  }

  private async getChannelHistory(params: any): Promise<ToolExecutionResult> {
    let parsedChannelId: string | undefined;
    try {
      const validatedParams = this.getChannelHistorySchema.parse(params);
      parsedChannelId = validatedParams.channel_id;

      const result = await this.slackService.getChannelHistory(
        validatedParams.channel_id,
        {
          limit: validatedParams.limit,
          includeThreads: validatedParams.include_threads,
        }
      );

      return {
        success: true,
        data: {
          messages: result.messages.map(msg => ({
            channel: msg.channel,
            user: msg.user,
            text: msg.text,
            timestamp: msg.ts,
            thread_ts: msg.thread_ts,
          })),
          metadata: result.metadata,
        },
      };
    } catch (error) {
      const errorMessage = (error as Error).message;

      // Provide more specific error messages for common access issues
      if (
        errorMessage.includes('not_in_channel') ||
        errorMessage.includes('Cannot access channel')
      ) {
        return {
          success: false,
          error: `Cannot access channel ${parsedChannelId || '(unknown)'}. The bot needs to be invited to this channel by a member. Please ask a channel member to invite the bot using: /invite @your-bot-name`,
        };
      } else if (errorMessage.includes('channel_not_found')) {
        return {
          success: false,
          error: `Channel ${parsedChannelId || '(unknown)'} not found. Please verify the channel ID or name is correct.`,
        };
      }

      return {
        success: false,
        error: `Failed to get channel history: ${errorMessage}`,
      };
    }
  }

  private async getThread(params: any): Promise<ToolExecutionResult> {
    try {
      const validatedParams = this.getThreadSchema.parse(params);

      const channel = await this.slackService.getChannelById(
        validatedParams.channel_id
      );
      if (!channel) {
        return {
          success: false,
          error: `Channel not found: ${validatedParams.channel_id}`,
        };
      }

      // Use SlackService method for thread retrieval
      const threadResult = await this.slackService.getThreadReplies(
        channel.id, 
        validatedParams.thread_ts
      );

      return {
        success: true,
        data: {
          thread: {
            channel: channel.id,
            thread_ts: validatedParams.thread_ts,
            messages: threadResult.messages.map((msg: any) => ({
              user: msg.user,
              text: msg.text,
              timestamp: msg.ts,
              thread_ts: msg.thread_ts,
            })),
          },
        },
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to get thread: ${(error as Error).message}`,
      };
    }
  }

  private async getChannelInfo(params: any): Promise<ToolExecutionResult> {
    try {
      const validatedParams = this.getChannelInfoSchema.parse(params);

      const channel =
        (await this.slackService.getChannelById(validatedParams.channel_id)) ||
        (await this.slackService.getChannelByName(validatedParams.channel_id));

      if (!channel) {
        return {
          success: false,
          error: `Channel not found: ${validatedParams.channel_id}`,
        };
      }

      return {
        success: true,
        data: {
          channel: {
            id: channel.id,
            name: channel.name,
            purpose: channel.purpose?.value,
            topic: channel.topic?.value,
            member_count: channel.num_members,
          },
        },
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to get channel info: ${(error as Error).message}`,
      };
    }
  }

  private async listFiles(params: any): Promise<ToolExecutionResult> {
    try {
      const validatedParams = this.listFilesSchema.parse(params);

      const fileParams: FileListParams = {
        channels: validatedParams.channels,
        types: validatedParams.file_types,
        limit: validatedParams.limit,
      };

      const result = await this.slackService.getFiles(fileParams);

      return {
        success: true,
        data: {
          files: result.files.map(file => ({
            id: file.id,
            name: file.name,
            filetype: file.filetype,
            size: file.size,
            channels: file.channels,
          })),
          metadata: result.metadata,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to list files: ${(error as Error).message}`,
      };
    }
  }

  private async getFileContent(params: any): Promise<ToolExecutionResult> {
    try {
      const validatedParams = this.getFileContentSchema.parse(params);

      const content = await this.slackService.getFileContent(
        validatedParams.file_id
      );

      return {
        success: true,
        data: {
          file_id: validatedParams.file_id,
          content: content,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to get file content: ${(error as Error).message}`,
      };
    }
  }

}
