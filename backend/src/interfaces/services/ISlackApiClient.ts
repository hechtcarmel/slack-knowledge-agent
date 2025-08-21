import {
  Channel,
  Message,
  Thread,
  File,
  FileContent,
  SearchParams,
  FileListParams,
} from '@/types/index.js';
import { IInitializableService } from '@/core/container/interfaces.js';

/**
 * Slack API client interface
 *
 * Defines the contract for low-level Slack API operations.
 * This interface abstracts the Slack Web API and provides a clean,
 * typed interface for API operations.
 */
export interface ISlackApiClient extends IInitializableService {
  /**
   * Test the connection to Slack API
   */
  testConnection(): Promise<void>;

  /**
   * Get all channels from Slack API
   */
  getChannels(): Promise<Channel[]>;

  /**
   * Get information about a specific channel
   */
  getChannelInfo(channelId: string): Promise<Channel | null>;

  /**
   * Get channel history (messages)
   */
  getChannelHistory(
    channelId: string,
    options?: {
      limit?: number;
      oldest?: string;
      latest?: string;
    }
  ): Promise<Message[]>;

  /**
   * Join a channel
   */
  joinChannel(channelId: string): Promise<void>;

  /**
   * Get thread replies
   */
  getThreadReplies(channelId: string, threadTs: string): Promise<Thread>;

  /**
   * Search for messages
   */
  searchMessages(params: SearchParams): Promise<Message[]>;

  /**
   * Get files from channels
   */
  getFiles(params: FileListParams): Promise<File[]>;

  /**
   * Get file content
   */
  getFileContent(fileId: string): Promise<FileContent>;

  /**
   * Get user information
   */
  getUserInfo(userId: string): Promise<any>;

  /**
   * Post a message to a channel
   */
  postMessage(message: {
    channel: string;
    text: string;
    thread_ts?: string;
    blocks?: any[];
    attachments?: any[];
    unfurl_links?: boolean;
    unfurl_media?: boolean;
  }): Promise<any>;

  /**
   * Open a direct message channel with a user
   */
  openDirectMessage(userId: string): Promise<any>;
}
