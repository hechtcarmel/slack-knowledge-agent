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
  private logger = Logger.create('SlackClient');
  private retryManager = new RetryManager();

  constructor(token: string) {
    this.client = new WebClient(token);
    // Log masked token for debugging
    const maskedToken = token ? `${token.substring(0, 10)}...${token.substring(token.length - 4)}` : 'NO_TOKEN';
    this.logger.info('SlackClient initialized', { 
      tokenPreview: maskedToken,
      tokenLength: token?.length || 0 
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
          // Mask the token if it's in the response
          token: result.token ? 'MASKED' : undefined
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
          this.logger.error('conversations.list API error details:', {
            error: result.error,
            needed: result.needed,
            provided: result.provided,
            fullResponse: result
          });
          
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

        const result = await this.client.conversations.history(historyOptions);

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

        const result = await this.client.search.messages({
          query,
          count: params.limit,
        });

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
