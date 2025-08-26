import { WebClient } from '@slack/web-api';
import { Logger } from '@/utils/logger.js';
import { SlackError } from '@/utils/errors.js';
import { RetryManager } from '@/utils/retry.js';
import { ISlackApiClient } from '@/interfaces/services/ISlackApiClient.js';
import {
  Channel,
  Message,
  Thread,
  File,
  FileContent,
  SearchParams,
  FileListParams,
} from '@/types/index.js';

/**
 * Slack API client configuration
 */
export interface SlackApiClientConfig {
  botToken: string;
  userToken?: string;
  maxRetries?: number;
  retryBackoffMs?: number;
}

/**
 * Pure Slack API client wrapper
 *
 * This class provides a clean, typed interface to the Slack Web API.
 * It handles authentication, retries, and error mapping but does not
 * contain business logic - that belongs in SlackService.
 */
export class SlackApiClient implements ISlackApiClient {
  private client: WebClient;
  private userClient?: WebClient;
  private logger = Logger.create('SlackApiClient');
  private retryManager: RetryManager;
  private teamInfo?: { team: string; teamId: string; url?: string };

  constructor(config: SlackApiClientConfig) {
    this.client = new WebClient(config.botToken);

    if (config.userToken) {
      this.userClient = new WebClient(config.userToken);
    }

    this.retryManager = new RetryManager();

    // Log masked tokens for debugging
    const maskedBotToken = this.maskToken(config.botToken);
    const maskedUserToken = config.userToken
      ? this.maskToken(config.userToken)
      : 'NOT_PROVIDED';

    this.logger.info('SlackApiClient initialized', {
      botToken: maskedBotToken,
      userToken: maskedUserToken,
      hasUserClient: !!this.userClient,
    });
  }

  /**
   * Initialize and test connection
   */
  public async initialize(): Promise<void> {
    await this.testConnection();
    this.logger.info('SlackApiClient initialized successfully');
  }

  /**
   * Test connection to Slack API
   */
  public async testConnection(): Promise<void> {
    try {
      await this.retryManager.executeWithRetry(async () => {
        const result = await this.client.auth.test();

        if (!result.ok) {
          throw new SlackError('Authentication failed', 'AUTH_FAILED', result);
        }

        // Store team info for permalink construction
        this.teamInfo = {
          team: result.team as string,
          teamId: result.team_id as string,
          url: result.url as string,
        };

        this.logger.info('Slack connection test successful', {
          botId: result.bot_id,
          userId: result.user_id,
          team: result.team,
          teamId: result.team_id,
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

  /**
   * Get all channels
   */
  public async getChannels(): Promise<Channel[]> {
    try {
      return await this.retryManager.executeWithRetry(async () => {
        let allChannels: any[] = [];
        let cursor: string | undefined;

        do {
          const result = await this.client.users.conversations({
            types: 'public_channel,private_channel',
            exclude_archived: true,
            limit: 1000,
            cursor,
          });

          if (!result.ok) {
            throw new SlackError(
              `Slack API error: ${result.error}`,
              'CHANNELS_FETCH_FAILED',
              result
            );
          }

          allChannels.push(...(result.channels || []));
          cursor = result.response_metadata?.next_cursor;
        } while (cursor);

        return allChannels.map(this.mapChannelFromApi);
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

  /**
   * Get channel information
   */
  public async getChannelInfo(channelId: string): Promise<Channel | null> {
    try {
      return await this.retryManager.executeWithRetry(async () => {
        const result = await this.client.conversations.info({
          channel: channelId,
        });

        if (!result.ok) {
          this.logger.debug('Failed to fetch channel info', {
            channelId,
            error: result.error,
          });
          return null;
        }

        return this.mapChannelFromApi(result.channel as any);
      });
    } catch (error) {
      this.logger.debug('Error fetching channel info', {
        channelId,
        error: (error as Error).message,
      });
      return null;
    }
  }

  /**
   * Get channel history
   */
  public async getChannelHistory(
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

        // Handle not_in_channel error by attempting to join
        if (!result.ok && result.error === 'not_in_channel') {
          this.logger.info('Bot not in channel, attempting to join', {
            channelId,
          });
          await this.joinChannel(channelId);
          // Retry after joining
          result = await this.client.conversations.history(historyOptions);
        }

        if (!result.ok || !result.messages) {
          throw new SlackError(
            `Failed to fetch channel history: ${result.error}`,
            'HISTORY_FETCH_FAILED',
            result
          );
        }

        return result.messages.map(msg =>
          this.mapMessageFromApi(msg as any, channelId)
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

  /**
   * Join a channel
   */
  public async joinChannel(channelId: string): Promise<void> {
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

  /**
   * Get thread replies
   */
  public async getThreadReplies(
    channelId: string,
    threadTs: string
  ): Promise<Thread> {
    try {
      return await this.retryManager.executeWithRetry(async () => {
        const result = await this.client.conversations.replies({
          channel: channelId,
          ts: threadTs,
        });

        if (!result.ok || !result.messages) {
          throw new SlackError(
            `Failed to fetch thread replies: ${result.error}`,
            'THREAD_FETCH_FAILED',
            result
          );
        }

        const messages = result.messages.map(msg =>
          this.mapMessageFromApi(msg as any, channelId)
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

  /**
   * Search messages with pagination support
   */
  public async searchMessages(params: SearchParams): Promise<Message[]> {
    try {
      return await this.retryManager.executeWithRetry(async () => {
        let allMessages: Message[] = [];
        let cursor = params.cursor || '*';
        let pageCount = 0;
        const maxPages = params.max_pages || 3;
        let hasMore = true;

        do {
          let query = params.query;

          // Add date range if specified
          if (params.time_range) {
            const after = params.time_range.start.toISOString().split('T')[0];
            const before = params.time_range.end.toISOString().split('T')[0];
            query = `${query} after:${after} before:${before}`;
          }

          // Use user client for search if available, otherwise fall back to bot client
          const searchClient = this.userClient || this.client;

          this.logger.debug('Executing search with pagination', {
            hasUserClient: !!this.userClient,
            query,
            count: params.limit,
            cursor,
            pageCount,
            auto_paginate: params.auto_paginate,
          });

          const result = await searchClient.search.messages({
            query,
            count: params.limit,
            ...(cursor && cursor !== '*' ? { cursor } : {}), // Only add cursor if it's not the initial value
          });

          if (!result.ok) {
            throw new SlackError(
              `Search failed: ${result.error}`,
              'SEARCH_FAILED',
              result
            );
          }

          // Return empty array if no matches
          if (!result.messages?.matches) {
            break;
          }

          let matches = result.messages.matches;

          // Filter by channels if specified
          if (params.channels.length > 0) {
            const channelSet = new Set(params.channels);
            matches = matches.filter((match: any) => {
              const matchChannelId = match.channel?.id;
              const matchChannelName = match.channel?.name;
              return (
                channelSet.has(matchChannelId) ||
                channelSet.has(matchChannelName)
              );
            });
          }

          const pageMessages = matches.map((match: any) =>
            this.mapMessageFromApi(match, match.channel?.id || 'unknown')
          );

          allMessages.push(...pageMessages);

          // Check if we should continue paginating
          // Note: Slack API pagination structure may vary, using safe access
          cursor =
            (result.messages as any)?.paging?.next_cursor ||
            (result as any)?.response_metadata?.next_cursor;
          hasMore = !!cursor;
          pageCount++;

          this.logger.debug('Search page completed', {
            pageCount,
            messagesThisPage: pageMessages.length,
            totalMessages: allMessages.length,
            hasMore,
            nextCursor: cursor,
          });

          // Auto-pagination decision logic
          if (params.auto_paginate && hasMore && pageCount < maxPages) {
            // Simple heuristic: continue if we got meaningful results this page
            const shouldContinue =
              pageMessages.length > 0 &&
              pageMessages.length >= params.limit * 0.5;
            if (!shouldContinue) {
              this.logger.debug(
                'Auto-pagination stopping due to low result quality'
              );
              break;
            }
          } else if (!params.auto_paginate) {
            // If not auto-paginating, stop after first page
            break;
          }
        } while (hasMore && pageCount < maxPages);

        this.logger.info('Search with pagination completed', {
          totalPages: pageCount,
          totalMessages: allMessages.length,
          finalCursor: cursor,
          hasMore: hasMore && pageCount < maxPages,
        });

        return allMessages;
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

  /**
   * Get files
   */
  public async getFiles(params: FileListParams): Promise<File[]> {
    try {
      return await this.retryManager.executeWithRetry(async () => {
        const listOptions: any = {
          channel: params.channels.join(','),
          count: params.limit,
        };

        if (params.types) {
          listOptions.types = params.types.join(',');
        }

        const result = await this.client.files.list(listOptions);

        if (!result.ok || !result.files) {
          throw new SlackError(
            `Failed to fetch files: ${result.error}`,
            'FILES_FETCH_FAILED',
            result
          );
        }

        return result.files.map(this.mapFileFromApi);
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

  /**
   * Get file content
   */
  public async getFileContent(fileId: string): Promise<FileContent> {
    try {
      return await this.retryManager.executeWithRetry(async () => {
        // First get file info
        const fileInfo = await this.client.files.info({ file: fileId });

        if (!fileInfo.ok || !fileInfo.file) {
          throw new SlackError(
            `Failed to get file info: ${fileInfo.error}`,
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

  /**
   * Post a message to a channel
   */
  public async postMessage(message: {
    channel: string;
    text: string;
    thread_ts?: string;
    blocks?: any[];
    attachments?: any[];
    unfurl_links?: boolean;
    unfurl_media?: boolean;
  }): Promise<any> {
    try {
      return await this.retryManager.executeWithRetry(async () => {
        const result = await this.client.chat.postMessage(message);

        if (!result.ok) {
          throw new SlackError(
            `Failed to post message: ${result.error}`,
            'MESSAGE_POST_FAILED',
            result
          );
        }

        this.logger.info('Message posted successfully', {
          channel: message.channel,
          messageTs: result.ts,
          isThreaded: !!message.thread_ts,
        });

        return result;
      });
    } catch (error) {
      this.logger.error('Failed to post message', error as Error, {
        channel: message.channel,
        textLength: message.text.length,
      });
      throw new SlackError(
        'Failed to post message to Slack',
        'MESSAGE_POST_FAILED',
        error
      );
    }
  }

  /**
   * Open a direct message channel with a user
   */
  public async openDirectMessage(userId: string): Promise<any> {
    try {
      return await this.retryManager.executeWithRetry(async () => {
        const result = await this.client.conversations.open({
          users: userId,
        });

        if (!result.ok) {
          throw new SlackError(
            `Failed to open DM: ${result.error}`,
            'DM_OPEN_FAILED',
            result
          );
        }

        this.logger.info('DM channel opened successfully', {
          userId,
          channelId: result.channel?.id,
        });

        return result;
      });
    } catch (error) {
      this.logger.error('Failed to open DM channel', error as Error, {
        userId,
      });
      throw new SlackError(
        'Failed to open direct message channel',
        'DM_OPEN_FAILED',
        error
      );
    }
  }

  /**
   * Get user information
   */
  public async getUserInfo(userId: string): Promise<any> {
    try {
      return await this.retryManager.executeWithRetry(async () => {
        const result = await this.client.users.info({ user: userId });

        if (!result.ok || !result.user) {
          throw new SlackError(
            `Failed to get user info: ${result.error}`,
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

  /**
   * Map Slack API channel object to our Channel type
   */
  private mapChannelFromApi(channel: any): Channel {
    return {
      id: channel.id,
      name: channel.name,
      purpose: channel.purpose,
      topic: channel.topic,
      num_members: channel.num_members,
    };
  }

  /**
   * Map Slack API message object to our Message type
   */
  private mapMessageFromApi(msg: any, channelId: string): Message {
    // Extract or construct permalink
    let permalink: string | undefined;

    // If the message has a permalink field (from search API)
    if (msg.permalink) {
      permalink = msg.permalink;
    }
    // Otherwise, try to construct it if we have team info
    else if (this.teamInfo?.url && channelId && msg.ts) {
      const baseUrl = this.teamInfo.url.replace(/\/$/, '');
      const messageId = 'p' + msg.ts.replace('.', '');
      permalink = `${baseUrl}/archives/${channelId}/${messageId}`;

      // If it's a thread reply, modify the permalink format
      if (msg.thread_ts && msg.thread_ts !== msg.ts) {
        const threadId = 'p' + msg.thread_ts.replace('.', '');
        permalink = `${baseUrl}/archives/${channelId}/${threadId}?thread_ts=${msg.thread_ts}&cid=${channelId}`;
      }
    }

    return {
      user: msg.user || msg.bot_id || 'unknown',
      text: msg.text || '',
      ts: msg.ts,
      channel: channelId,
      thread_ts: msg.thread_ts,
      permalink,
    };
  }

  /**
   * Map Slack API file object to our File type
   */
  private mapFileFromApi(file: any): File {
    return {
      id: file.id,
      name: file.name,
      filetype: file.filetype,
      size: file.size,
      url_private: file.url_private,
      channels: file.channels || [],
    };
  }

  /**
   * Mask sensitive tokens for logging
   */
  private maskToken(token: string): string {
    if (!token || token.length < 8) {
      return '[INVALID_TOKEN]';
    }
    return `${token.substring(0, 6)}...${token.substring(token.length - 4)}`;
  }
}
