import {
  ResponseContext,
  PostResult,
  SlackMessage,
} from '../../types/webhook.js';

/**
 * Interface for response posting service
 *
 * Handles posting AI-generated responses back to Slack channels.
 */
export interface IResponsePoster {
  /**
   * Post a response to Slack
   */
  postResponse(response: string, context: ResponseContext): Promise<PostResult>;

  /**
   * Format content for Slack posting (markdown, mentions, etc.)
   */
  formatForSlack(content: string, context: ResponseContext): SlackMessage;

  /**
   * Handle posting errors with retry logic
   */
  handlePostingError(error: Error, context: ResponseContext): Promise<void>;

  /**
   * Truncate response if it exceeds Slack limits
   */
  truncateResponse(content: string, maxLength: number): string;

  /**
   * Post a threaded reply to an existing message
   */
  postThreadReply(
    response: string,
    context: ResponseContext
  ): Promise<PostResult>;

  /**
   * Post a direct message to a user
   */
  postDirectMessage(response: string, userId: string): Promise<PostResult>;
}
