import {
  Channel,
  Message,
  SearchParams,
  FileListParams,
  File,
} from '@/types/index.js';
import {
  IInitializableService,
  IHealthCheckable,
} from '@/core/container/interfaces.js';

/**
 * Slack service interface
 *
 * Defines the contract for Slack-related business logic operations.
 * This service handles channel management, message operations, and file access.
 */
export interface ISlackService extends IInitializableService, IHealthCheckable {
  /**
   * Get all available channels, optionally refreshing the cache
   */
  getChannels(refresh?: boolean): Promise<Channel[]>;

  /**
   * Get a specific channel by its ID
   */
  getChannelById(channelId: string): Promise<Channel | null>;

  /**
   * Get a channel by its name
   */
  getChannelByName(channelName: string): Promise<Channel | null>;

  /**
   * Ensure the bot has access to specified channels
   */
  ensureChannelAccess(channelIds: string[]): Promise<{
    joined: string[];
    alreadyMember: string[];
    failed: { channelId: string; error: string }[];
  }>;

  /**
   * Search for messages across channels
   */
  searchMessages(params: SearchParams): Promise<{
    messages: Message[];
    metadata: {
      totalResults: number;
      searchTime: number;
      channels: Channel[];
    };
  }>;

  /**
   * Get channel history with optional thread inclusion
   */
  getChannelHistory(
    channelId: string,
    options?: {
      limit?: number;
      oldest?: string;
      latest?: string;
      includeThreads?: boolean;
    }
  ): Promise<{
    messages: Message[];
    metadata: {
      channelName: string;
      messageCount: number;
      threadCount: number;
    };
  }>;

  /**
   * Get files from specified channels
   */
  getFiles(params: FileListParams): Promise<{
    files: File[];
    metadata: {
      totalFiles: number;
      channels: Channel[];
    };
  }>;

  /**
   * Get thread replies for a specific message
   */
  getThreadReplies(channelId: string, threadTs: string): Promise<{
    messages: Message[];
    metadata: {
      channelName: string;
      threadTs: string;
      messageCount: number;
    };
  }>;

  /**
   * Get content of a specific file
   */
  getFileContent(fileId: string): Promise<string>;

  /**
   * Get user information
   */
  getUserInfo(userId: string): Promise<any>;
}
