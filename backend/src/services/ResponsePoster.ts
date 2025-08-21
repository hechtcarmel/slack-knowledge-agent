import { Logger } from '../utils/logger.js';
import { WebhookError } from '../utils/errors.js';
import { IResponsePoster } from '../interfaces/services/IResponsePoster.js';
import { ISlackApiClient } from '../interfaces/services/ISlackApiClient.js';
import {
  ResponseContext,
  PostResult,
  SlackMessage,
  WebhookConfiguration,
} from '../types/webhook.js';

/**
 * ResponsePoster implementation
 *
 * Handles posting AI-generated responses back to Slack channels
 * with proper formatting, threading, and error handling.
 */
export class ResponsePoster implements IResponsePoster {
  private logger = Logger.create('ResponsePoster');

  constructor(
    private slackApiClient: ISlackApiClient,
    private config: WebhookConfiguration
  ) {}

  /**
   * Post a response to Slack
   */
  public async postResponse(
    response: string,
    context: ResponseContext
  ): Promise<PostResult> {
    try {
      this.logger.info('Posting response to Slack', {
        channelId: context.channel_id,
        responseLength: response.length,
        isThreaded: !!context.thread_ts,
        isDm: context.is_dm,
      });

      // Format the response for Slack
      const slackMessage = this.formatForSlack(response, context);

      // Choose posting method based on context
      if (context.is_dm) {
        return await this.postDirectMessage(response, context.user_id);
      } else if (context.thread_ts && this.config.enableThreading) {
        return await this.postThreadReply(response, context);
      } else {
        // Post as regular message
        return await this.postRegularMessage(slackMessage);
      }
    } catch (error) {
      this.logger.error('Failed to post response', error as Error, {
        channelId: context.channel_id,
        userId: context.user_id,
        responseLength: response.length,
      });

      await this.handlePostingError(error as Error, context);

      return {
        success: false,
        error: (error as Error).message,
        channel_id: context.channel_id,
        thread_ts: context.thread_ts,
      };
    }
  }

  /**
   * Format content for Slack posting
   */
  public formatForSlack(
    content: string,
    context: ResponseContext
  ): SlackMessage {
    // Truncate if too long
    const truncatedContent = this.truncateResponse(
      content,
      this.config.maxResponseLength
    );

    // Basic markdown formatting for Slack
    let formattedContent = truncatedContent
      // Convert **bold** to *bold*
      .replace(/\*\*(.*?)\*\*/g, '*$1*')
      // Convert `code` to `code` (already correct)
      // Convert ```code blocks``` to ```code blocks``` (already correct)
      // Convert [link](url) to <url|link>
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<$2|$1>');

    // Add mention of the user who asked
    if (context.mention_context) {
      formattedContent = `<@${context.user_id}> ${formattedContent}`;
    }

    const message: SlackMessage = {
      channel: context.channel_id,
      text: formattedContent,
      unfurl_links: false,
      unfurl_media: false,
    };

    if (context.thread_ts && this.config.enableThreading) {
      message.thread_ts = context.thread_ts;
    }

    return message;
  }

  /**
   * Truncate response if it exceeds limits
   */
  public truncateResponse(content: string, maxLength: number): string {
    if (content.length <= maxLength) {
      return content;
    }

    const truncated = content.substring(0, maxLength - 100); // Leave room for truncation message
    const lastPeriod = truncated.lastIndexOf('.');
    const lastNewline = truncated.lastIndexOf('\n');

    // Try to truncate at a natural break point
    const breakPoint = Math.max(lastPeriod, lastNewline);
    const finalContent =
      breakPoint > maxLength * 0.8
        ? truncated.substring(0, breakPoint + 1)
        : truncated;

    return `${finalContent}\n\n_[Response truncated due to length. Please ask a more specific question for a complete answer.]_`;
  }

  /**
   * Post a threaded reply
   */
  public async postThreadReply(
    response: string,
    context: ResponseContext
  ): Promise<PostResult> {
    try {
      const slackMessage = this.formatForSlack(response, context);
      return await this.postRegularMessage(slackMessage);
    } catch (error) {
      this.logger.error('Failed to post thread reply', error as Error, context);
      throw new WebhookError(
        'Failed to post thread reply',
        'THREAD_POST_FAILED',
        error
      );
    }
  }

  /**
   * Post a direct message
   */
  public async postDirectMessage(
    response: string,
    userId: string
  ): Promise<PostResult> {
    try {
      this.logger.info('Posting direct message', { userId });

      // For DMs, we need to open a conversation first
      const dmChannel = await this.openDirectMessage(userId);

      const message: SlackMessage = {
        channel: dmChannel.id,
        text: this.truncateResponse(response, this.config.maxResponseLength),
        unfurl_links: false,
        unfurl_media: false,
      };

      return await this.postRegularMessage(message);
    } catch (error) {
      this.logger.error('Failed to post direct message', error as Error, {
        userId,
      });
      throw new WebhookError(
        'Failed to post direct message',
        'DM_POST_FAILED',
        error
      );
    }
  }

  /**
   * Handle posting errors with retry logic
   */
  public async handlePostingError(
    error: Error,
    context: ResponseContext
  ): Promise<void> {
    this.logger.error('Response posting failed', error, {
      channelId: context.channel_id,
      userId: context.user_id,
      errorMessage: error.message,
    });

    // Try to post an error message to the user
    try {
      const errorMessage = context.is_dm
        ? "I'm sorry, I encountered an error while processing your request. Please try again later."
        : `<@${context.user_id}> I'm sorry, I encountered an error while processing your request. Please try again later.`;

      const errorSlackMessage: SlackMessage = {
        channel: context.channel_id,
        text: errorMessage,
        thread_ts: context.thread_ts,
      };

      await this.postRegularMessage(errorSlackMessage);
    } catch (errorPostError) {
      this.logger.error(
        'Failed to post error message',
        errorPostError as Error,
        {
          originalError: error.message,
          channelId: context.channel_id,
        }
      );
    }
  }

  /**
   * Post a regular message using the Slack API
   */
  private async postRegularMessage(message: SlackMessage): Promise<PostResult> {
    try {
      const result = await this.slackApiClient.postMessage(message);

      return {
        success: true,
        message_ts: result.ts,
        channel_id: message.channel,
        thread_ts: message.thread_ts,
      };
    } catch (error) {
      this.logger.error('Failed to post message via API', error as Error, {
        channel: message.channel,
        textLength: message.text.length,
      });

      return {
        success: false,
        error: (error as Error).message,
        channel_id: message.channel,
        thread_ts: message.thread_ts,
      };
    }
  }

  /**
   * Open direct message channel with user
   */
  private async openDirectMessage(userId: string): Promise<{ id: string }> {
    try {
      const result = await this.slackApiClient.openDirectMessage(userId);
      return { id: result.channel.id };
    } catch (error) {
      this.logger.error('Failed to open DM channel', error as Error, {
        userId,
      });
      throw new WebhookError(
        'Failed to open direct message channel',
        'DM_OPEN_FAILED',
        error
      );
    }
  }
}
