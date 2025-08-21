import { SlackClient } from './SlackClient.js';
import { Logger } from '@/utils/logger.js';
import { SlackError } from '@/utils/errors.js';
import {
  Channel,
  Message,
  SearchParams,
  FileListParams,
  File,
} from '@/types/index.js';

export class SlackService {
  private client: SlackClient;
  private logger = Logger.create('SlackService');
  private channelsCache: Map<string, Channel> = new Map();
  private cacheExpiry = 5 * 60 * 1000; // 5 minutes
  private lastCacheUpdate = 0;

  constructor(botToken: string, userToken?: string) {
    this.client = new SlackClient(botToken, userToken);
  }

  async initialize(): Promise<void> {
    try {
      await this.client.testConnection();
      await this.refreshChannelsCache();
      this.logger.info('SlackService initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize SlackService', error as Error);
      throw new SlackError(
        'Failed to initialize Slack service',
        'INITIALIZATION_FAILED',
        error
      );
    }
  }

  async getChannels(refresh = false): Promise<Channel[]> {
    try {
      if (refresh || this.shouldRefreshCache()) {
        await this.refreshChannelsCache();
      }
      return Array.from(this.channelsCache.values());
    } catch (error) {
      this.logger.error('Failed to get channels', error as Error);
      throw new SlackError('Failed to get channels', 'CHANNELS_ERROR', error);
    }
  }

  async getChannelById(channelId: string): Promise<Channel | null> {
    const channels = await this.getChannels();
    return channels.find(ch => ch.id === channelId) || null;
  }

  async getChannelByName(channelName: string): Promise<Channel | null> {
    const channels = await this.getChannels();
    return channels.find(ch => ch.name === channelName) || null;
  }

  /**
   * Proactively join channels that the bot might need to access
   * This should be called before processing queries to ensure the bot has access
   */
  async ensureChannelAccess(channelIds: string[]): Promise<{
    joined: string[];
    alreadyMember: string[];
    failed: { channelId: string; error: string }[];
  }> {
    const results = {
      joined: [] as string[],
      alreadyMember: [] as string[],
      failed: [] as { channelId: string; error: string }[],
    };

    for (const channelId of channelIds) {
      try {
        // First check if we can already access the channel by trying to get info
        const channel =
          (await this.getChannelById(channelId)) ||
          (await this.getChannelByName(channelId));
        if (!channel) {
          results.failed.push({ channelId, error: 'Channel not found' });
          continue;
        }

        // Try to get a single message to test access
        try {
          await this.client.getChannelHistory(channel.id, { limit: 1 });
          results.alreadyMember.push(channelId);
          this.logger.debug('Already have access to channel', { channelId });
        } catch (accessError: any) {
          // Debug logging to understand error structure
          this.logger.debug('Channel access test failed, analyzing error', {
            channelId,
            errorMessage: accessError.message,
            errorCode: accessError.code,
            errorName: accessError.constructor.name,
            hasDetails: !!accessError.details,
          });

          // Check for not_in_channel error in different places it might appear
          const errorMessage = accessError.message || accessError.toString();
          const errorStack = accessError.stack || '';
          const errorDetails = JSON.stringify(accessError.details || {});
          const isNotInChannelError =
            errorMessage.includes('not_in_channel') ||
            errorStack.includes('not_in_channel') ||
            errorDetails.includes('not_in_channel') ||
            errorMessage.includes('An API error occurred: not_in_channel');

          if (isNotInChannelError) {
            // Need to join the channel
            this.logger.info(
              'Bot not in channel, attempting to join proactively',
              { channelId }
            );
            try {
              await this.client.joinChannel(channel.id);
              results.joined.push(channelId);
              this.logger.info('Successfully joined channel proactively', {
                channelId,
              });
            } catch (joinError: any) {
              results.failed.push({
                channelId,
                error: `Failed to join: ${joinError.message}`,
              });
              this.logger.warn('Failed to join channel proactively', {
                channelId,
                error: joinError.message,
              });
            }
          } else {
            // Other access error
            results.failed.push({
              channelId,
              error: `Access error: ${accessError.message}`,
            });
            this.logger.debug('Non-joinable access error for channel', {
              channelId,
              error: accessError.message,
              errorType: accessError.constructor.name,
            });
          }
        }
      } catch (error) {
        results.failed.push({
          channelId,
          error: `Unexpected error: ${(error as Error).message}`,
        });
        this.logger.error(
          'Unexpected error during channel access check',
          error as Error,
          { channelId }
        );
      }
    }

    if (results.joined.length > 0 || results.failed.length > 0) {
      this.logger.info('Channel access check completed', {
        joined: results.joined.length,
        alreadyMember: results.alreadyMember.length,
        failed: results.failed.length,
        failedChannels: results.failed.map(f => `${f.channelId}: ${f.error}`),
      });
    }

    return results;
  }

  async searchMessages(params: SearchParams): Promise<{
    messages: Message[];
    metadata: {
      totalResults: number;
      searchTime: number;
      channels: Channel[];
    };
  }> {
    const startTime = Date.now();

    try {
      // Validate channel IDs
      const validChannels = await this.validateChannels(params.channels);

      const messages = await this.client.searchMessages({
        ...params,
        channels: validChannels.map(ch => ch.id),
      });

      const searchTime = Date.now() - startTime;

      this.logger.info('Message search completed', {
        query: params.query,
        resultCount: messages.length,
        searchTime,
        channels: validChannels.length,
      });

      return {
        messages,
        metadata: {
          totalResults: messages.length,
          searchTime,
          channels: validChannels,
        },
      };
    } catch (error) {
      this.logger.error('Message search failed', error as Error, {
        query: params.query,
      });
      throw new SlackError('Message search failed', 'SEARCH_FAILED', error);
    }
  }

  async getChannelHistory(
    channelId: string,
    options: {
      limit?: number;
      oldest?: string;
      latest?: string;
      includeThreads?: boolean;
    } = {}
  ): Promise<{
    messages: Message[];
    metadata: {
      channelName: string;
      messageCount: number;
      threadCount: number;
    };
  }> {
    try {
      const channel = await this.getChannelById(channelId);
      if (!channel) {
        throw new SlackError(
          `Channel not found: ${channelId}`,
          'CHANNEL_NOT_FOUND'
        );
      }

      const messages = await this.client.getChannelHistory(channelId, options);

      let threadCount = 0;
      if (options.includeThreads) {
        // Get thread replies for messages that have threads
        const threadsToFetch = messages.filter(
          msg => msg.thread_ts && msg.thread_ts === msg.ts
        );

        for (const threadParent of threadsToFetch) {
          try {
            const thread = await this.client.getThreadReplies(
              channelId,
              threadParent.ts
            );
            // Replace the parent message and add thread replies
            const parentIndex = messages.findIndex(
              msg => msg.ts === threadParent.ts
            );
            if (parentIndex !== -1) {
              messages.splice(parentIndex, 1, ...thread.messages);
              threadCount++;
            }
          } catch (error) {
            this.logger.warn('Failed to fetch thread replies', {
              error: (error as Error).message,
              channelId,
              threadTs: threadParent.ts,
            });
          }
        }
      }

      this.logger.info('Channel history retrieved', {
        channelId,
        channelName: channel.name,
        messageCount: messages.length,
        threadCount,
      });

      return {
        messages,
        metadata: {
          channelName: channel.name,
          messageCount: messages.length,
          threadCount,
        },
      };
    } catch (error) {
      this.logger.error('Failed to get channel history', error as Error, {
        channelId,
      });
      throw new SlackError(
        'Failed to get channel history',
        'HISTORY_ERROR',
        error
      );
    }
  }

  async getFiles(params: FileListParams): Promise<{
    files: File[];
    metadata: {
      totalFiles: number;
      channels: Channel[];
    };
  }> {
    try {
      const validChannels = await this.validateChannels(params.channels);

      const files = await this.client.getFiles({
        ...params,
        channels: validChannels.map(ch => ch.id),
      });

      this.logger.info('Files retrieved', {
        fileCount: files.length,
        channels: validChannels.length,
      });

      return {
        files,
        metadata: {
          totalFiles: files.length,
          channels: validChannels,
        },
      };
    } catch (error) {
      this.logger.error('Failed to get files', error as Error);
      throw new SlackError('Failed to get files', 'FILES_ERROR', error);
    }
  }

  async getFileContent(fileId: string): Promise<string> {
    try {
      const fileContent = await this.client.getFileContent(fileId);

      this.logger.info('File content retrieved', {
        fileId,
        contentLength: fileContent.content.length,
        filetype: fileContent.filetype,
      });

      return fileContent.content;
    } catch (error) {
      this.logger.error('Failed to get file content', error as Error, {
        fileId,
      });
      throw new SlackError(
        'Failed to get file content',
        'FILE_CONTENT_ERROR',
        error
      );
    }
  }

  async getUserInfo(userId: string): Promise<any> {
    try {
      return await this.client.getUserInfo(userId);
    } catch (error) {
      this.logger.error('Failed to get user info', error as Error, { userId });
      throw new SlackError('Failed to get user info', 'USER_ERROR', error);
    }
  }

  private async refreshChannelsCache(): Promise<void> {
    try {
      const channels = await this.client.getChannels();

      this.channelsCache.clear();
      channels.forEach(channel => {
        this.channelsCache.set(channel.id, channel);
      });

      this.lastCacheUpdate = Date.now();

      this.logger.info('Channels cache refreshed', {
        channelCount: channels.length,
      });
    } catch (error) {
      this.logger.error('Failed to refresh channels cache', error as Error);
      throw error;
    }
  }

  private shouldRefreshCache(): boolean {
    return Date.now() - this.lastCacheUpdate > this.cacheExpiry;
  }

  private async validateChannels(channelIds: string[]): Promise<Channel[]> {
    const channels = await this.getChannels();
    const validChannels: Channel[] = [];

    for (const channelId of channelIds) {
      const channel = channels.find(
        ch => ch.id === channelId || ch.name === channelId
      );
      if (channel) {
        validChannels.push(channel);
      } else {
        this.logger.warn('Invalid channel specified', { channelId });
      }
    }

    if (validChannels.length === 0) {
      throw new SlackError('No valid channels found', 'NO_VALID_CHANNELS');
    }

    return validChannels;
  }

  getHealthStatus(): {
    status: 'healthy' | 'degraded' | 'unhealthy';
    details: Record<string, any>;
  } {
    const now = Date.now();
    const cacheAge = now - this.lastCacheUpdate;
    const isCacheStale = cacheAge > this.cacheExpiry;

    return {
      status: isCacheStale ? 'degraded' : 'healthy',
      details: {
        channelsCached: this.channelsCache.size,
        cacheAge,
        cacheStale: isCacheStale,
      },
    };
  }
}
