import { WebClient } from '@slack/web-api';
import { Logger } from '@/utils/logger.js';
import { SlackError } from '@/utils/errors.js';
import { RetryManager } from '@/utils/retry.js';
import {
  Channel,
  Message,
  Thread,
  File,
  FileContent,
  SearchParams,
  FileListParams,
} from '@/types/index.js';

export class SlackClient {
  private client: WebClient;
  private userClient?: WebClient;
  private logger = Logger.create('SlackClient');
  private retryManager = new RetryManager();

  constructor(botToken: string, userToken?: string) {
    this.client = new WebClient(botToken);
    if (userToken) {
      this.userClient = new WebClient(userToken);
    }
    // Log masked token for debugging
    const maskedBotToken = botToken
      ? `${botToken.substring(0, 10)}...${botToken.substring(botToken.length - 4)}`
      : 'NO_TOKEN';
    const maskedUserToken = userToken
      ? `${userToken.substring(0, 10)}...${userToken.substring(userToken.length - 4)}`
      : 'NO_USER_TOKEN';
    this.logger.info('SlackClient initialized', {
      botTokenPreview: maskedBotToken,
      userTokenPreview: maskedUserToken,
      botTokenLength: botToken?.length || 0,
      userTokenLength: userToken?.length || 0,
    });
  }

  async testConnection(): Promise<void> {
    try {
      await this.retryManager.executeWithRetry(async () => {
        const result = await this.client.auth.test();
        if (!result.ok) {
          throw new SlackError('Authentication failed', 'AUTH_FAILED', result);
        }

        // Log complete auth test response for debugging
        this.logger.info('Slack connection test successful', {
          botId: result.bot_id,
          userId: result.user_id,
          team: result.team,
          teamId: result.team_id,
          url: result.url,
          isEnterpriseInstall: result.is_enterprise_install,
        });

        // Log the full result structure to see what scope info is available
        this.logger.info('Auth test full response:', {
          ...result,
          // Mask the token if it's in the response - safely handle token property
          token: (result as any).token ? 'MASKED' : undefined,
        });
      });
    } catch (error) {
      this.logger.error('Failed to connect to Slack', error as Error);
      throw new SlackError(
        'Failed to authenticate with Slack API',
        'CONNECTION_FAILED',
        error
      );
    }
  }

  async getChannels(): Promise<Channel[]> {
    try {
      return await this.retryManager.executeWithRetry(async () => {
        this.logger.info('Attempting conversations.list call...');

        // Try with just public channels first to isolate the scope issue
        const result = await this.client.conversations.list({
          types: 'public_channel',
          exclude_archived: true,
          limit: 1000,
        });

        this.logger.info('conversations.list response:', {
          ok: result.ok,
          error: result.error,
          needed: result.needed,
          provided: result.provided,
          channelCount: result.channels?.length || 0,
          responseMetadata: result.response_metadata,
        });

        if (!result.ok) {
          this.logger.error(
            'conversations.list API error details:',
            undefined,
            {
              slackError: (result as any).error,
              needed: result.needed,
              provided: result.provided,
              fullResponse: result,
            }
          );

          throw new SlackError(
            `Slack API error: ${result.error}`,
            'CHANNELS_FETCH_FAILED',
            result
          );
        }

        if (!result.channels) {
          throw new SlackError(
            'No channels returned from conversations.list',
            'CHANNELS_FETCH_FAILED',
            result
          );
        }

        return result.channels.map(
          (channel: any): Channel => ({
            id: channel.id,
            name: channel.name,
            purpose: channel.purpose,
            topic: channel.topic,
            num_members: channel.num_members,
          })
        );
      });
    } catch (error) {
      this.logger.error('Failed to fetch channels', error as Error);
      throw new SlackError(
        'Failed to fetch channels from Slack',
        'CHANNELS_FETCH_FAILED',
        error
      );
    }
  }

  async getChannelHistory(
    channelId: string,
    options: {
      limit?: number;
      oldest?: string;
      latest?: string;
    } = {}
  ): Promise<Message[]> {
    try {
      return await this.retryManager.executeWithRetry(async () => {
        const historyOptions: any = {
          channel: channelId,
          limit: options.limit || 100,
        };
        if (options.oldest) historyOptions.oldest = options.oldest;
        if (options.latest) historyOptions.latest = options.latest;

        let result = await this.client.conversations.history(historyOptions);

        // If not in channel, try to join first
        if (!result.ok && result.error === 'not_in_channel') {
          this.logger.info('Bot not in channel, attempting to join', {
            channelId,
          });
          try {
            const joinResult = await this.client.conversations.join({
              channel: channelId,
            });
            if (joinResult.ok) {
              this.logger.info('Successfully joined channel', { channelId });
              // Retry getting history after joining
              result = await this.client.conversations.history(historyOptions);
            } else {
              this.logger.warn('Failed to join channel', {
                channelId,
                error: joinResult.error,
                needsInvite:
                  joinResult.error === 'cant_invite_self' ||
                  joinResult.error === 'channel_not_found' ||
                  joinResult.error === 'is_private',
              });

              // If the join failed, throw a more specific error
              throw new SlackError(
                `Cannot access channel: ${joinResult.error}. The bot may need to be invited to this channel by a member.`,
                'CHANNEL_ACCESS_DENIED',
                joinResult
              );
            }
          } catch (joinError) {
            this.logger.warn('Error trying to join channel', {
              channelId,
              error: joinError as Error,
            });

            // Re-throw SlackError as-is, otherwise create a new one
            if (joinError instanceof SlackError) {
              throw joinError;
            }

            throw new SlackError(
              `Cannot join channel: ${(joinError as Error).message}. The bot may need to be invited to this channel.`,
              'CHANNEL_JOIN_FAILED',
              joinError
            );
          }
        }

        if (!result.ok || !result.messages) {
          throw new SlackError(
            'Failed to fetch channel history',
            'HISTORY_FETCH_FAILED',
            result
          );
        }

        return result.messages.map(
          (msg: any): Message => ({
            user: msg.user || msg.bot_id || 'unknown',
            text: msg.text || '',
            ts: msg.ts,
            channel: channelId,
            thread_ts: msg.thread_ts,
          })
        );
      });
    } catch (error) {
      this.logger.error('Failed to fetch channel history', error as Error, {
        channelId,
      });
      throw new SlackError(
        'Failed to fetch channel history from Slack',
        'HISTORY_FETCH_FAILED',
        error
      );
    }
  }

  async joinChannel(channelId: string): Promise<void> {
    try {
      await this.retryManager.executeWithRetry(async () => {
        const result = await this.client.conversations.join({
          channel: channelId,
        });

        if (!result.ok) {
          throw new SlackError(
            `Failed to join channel: ${result.error}`,
            'CHANNEL_JOIN_FAILED',
            result
          );
        }

        this.logger.info('Successfully joined channel', { channelId });
      });
    } catch (error) {
      this.logger.error('Failed to join channel', error as Error, {
        channelId,
      });
      throw new SlackError(
        'Failed to join channel',
        'CHANNEL_JOIN_FAILED',
        error
      );
    }
  }

  async getThreadReplies(channelId: string, threadTs: string): Promise<Thread> {
    try {
      return await this.retryManager.executeWithRetry(async () => {
        const result = await this.client.conversations.replies({
          channel: channelId,
          ts: threadTs,
        });

        if (!result.ok || !result.messages) {
          throw new SlackError(
            'Failed to fetch thread replies',
            'THREAD_FETCH_FAILED',
            result
          );
        }

        const messages = result.messages.map(
          (msg: any): Message => ({
            user: msg.user || msg.bot_id || 'unknown',
            text: msg.text || '',
            ts: msg.ts,
            channel: channelId,
            thread_ts: msg.thread_ts,
          })
        );

        return {
          messages,
          channel: channelId,
          thread_ts: threadTs,
        };
      });
    } catch (error) {
      this.logger.error('Failed to fetch thread replies', error as Error, {
        channelId,
        threadTs,
      });
      throw new SlackError(
        'Failed to fetch thread replies from Slack',
        'THREAD_FETCH_FAILED',
        error
      );
    }
  }

  async searchMessages(params: SearchParams): Promise<Message[]> {
    try {
      return await this.retryManager.executeWithRetry(async () => {
        let query = params.query;

        // Add channel filters to search query
        if (params.channels.length > 0) {
          const channelFilter = params.channels
            .map(ch => `in:${ch}`)
            .join(' OR ');
          query = `${query} (${channelFilter})`;
        }

        // Add date range if specified
        if (params.time_range) {
          const after = params.time_range.start.toISOString().split('T')[0];
          const before = params.time_range.end.toISOString().split('T')[0];
          query = `${query} after:${after} before:${before}`;
        }

        // Use user client for search if available, otherwise fall back to bot client
        const searchClient = this.userClient || this.client;
        let result = await searchClient.search.messages({
          query,
          count: params.limit,
        });

        // If search fails and we have specific channel errors, try joining those channels
        if (
          !result.ok &&
          result.error &&
          params.channels &&
          params.channels.length > 0
        ) {
          this.logger.info('Search failed, attempting to join channels', {
            channels: params.channels,
            error: result.error,
          });

          for (const channelId of params.channels) {
            try {
              const joinResult = await this.client.conversations.join({
                channel: channelId,
              });
              if (joinResult.ok) {
                this.logger.info('Successfully joined channel for search', {
                  channelId,
                });
              }
            } catch (joinError) {
              this.logger.warn('Failed to join channel for search', {
                channelId,
                error: joinError as Error,
              });
            }
          }

          // Retry search after attempting to join channels
          result = await searchClient.search.messages({
            query,
            count: params.limit,
          });
        }

        if (!result.ok || !result.messages?.matches) {
          throw new SlackError(
            'Failed to search messages',
            'SEARCH_FAILED',
            result
          );
        }

        return result.messages.matches.map(
          (match: any): Message => ({
            user: match.user || match.bot_id || 'unknown',
            text: match.text || '',
            ts: match.ts,
            channel: match.channel?.id || 'unknown',
            thread_ts: match.thread_ts,
          })
        );
      });
    } catch (error) {
      this.logger.error('Failed to search messages', error as Error, {
        query: params.query,
      });
      throw new SlackError(
        'Failed to search messages in Slack',
        'SEARCH_FAILED',
        error
      );
    }
  }

  async getFiles(params: FileListParams): Promise<File[]> {
    try {
      return await this.retryManager.executeWithRetry(async () => {
        const listOptions: any = {
          channel: params.channels.join(','),
          count: params.limit,
        };
        if (params.types) listOptions.types = params.types.join(',');

        const result = await this.client.files.list(listOptions);

        if (!result.ok || !result.files) {
          throw new SlackError(
            'Failed to fetch files',
            'FILES_FETCH_FAILED',
            result
          );
        }

        return result.files.map(
          (file: any): File => ({
            id: file.id,
            name: file.name,
            filetype: file.filetype,
            size: file.size,
            url_private: file.url_private,
            channels: file.channels || [],
          })
        );
      });
    } catch (error) {
      this.logger.error('Failed to fetch files', error as Error, { params });
      throw new SlackError(
        'Failed to fetch files from Slack',
        'FILES_FETCH_FAILED',
        error
      );
    }
  }

  async getFileContent(fileId: string): Promise<FileContent> {
    try {
      return await this.retryManager.executeWithRetry(async () => {
        // First get file info
        const fileInfo = await this.client.files.info({ file: fileId });

        if (!fileInfo.ok || !fileInfo.file) {
          throw new SlackError(
            'Failed to get file info',
            'FILE_INFO_FAILED',
            fileInfo
          );
        }

        // Then fetch the file content
        const response = await fetch(fileInfo.file.url_private_download!, {
          headers: {
            Authorization: `Bearer ${this.client.token}`,
          },
        });

        if (!response.ok) {
          throw new SlackError(
            'Failed to download file content',
            'FILE_DOWNLOAD_FAILED',
            {
              status: response.status,
              statusText: response.statusText,
            }
          );
        }

        const content = await response.text();

        return {
          id: fileId,
          content,
          filetype: fileInfo.file.filetype || 'unknown',
        };
      });
    } catch (error) {
      this.logger.error('Failed to get file content', error as Error, {
        fileId,
      });
      throw new SlackError(
        'Failed to get file content from Slack',
        'FILE_CONTENT_FAILED',
        error
      );
    }
  }

  async getUserInfo(userId: string): Promise<any> {
    try {
      return await this.retryManager.executeWithRetry(async () => {
        const result = await this.client.users.info({ user: userId });

        if (!result.ok || !result.user) {
          throw new SlackError(
            'Failed to get user info',
            'USER_INFO_FAILED',
            result
          );
        }

        return {
          id: result.user.id,
          name: result.user.name,
          real_name: result.user.real_name,
          display_name: result.user.profile?.display_name,
          email: result.user.profile?.email,
        };
      });
    } catch (error) {
      this.logger.error('Failed to get user info', error as Error, { userId });
      throw new SlackError(
        'Failed to get user info from Slack',
        'USER_INFO_FAILED',
        error
      );
    }
  }
}
