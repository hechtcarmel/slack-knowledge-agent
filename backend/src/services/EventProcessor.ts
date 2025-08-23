import { Logger } from '../utils/logger.js';
import { WebhookError } from '../utils/errors.js';
import { IEventProcessor } from '../interfaces/services/IEventProcessor.js';
import { ILLMService, LLMContext } from '../interfaces/services/ILLMService.js';
import { ISlackService } from '../interfaces/services/ISlackService.js';
import { IResponsePoster } from '../interfaces/services/IResponsePoster.js';
import {
  SlackEvent,
  ProcessingResult,
  WebhookContext,
  ResponseContext,
  WebhookConfiguration,
} from '../types/webhook.js';

/**
 * EventProcessor implementation
 *
 * Processes Slack events, particularly app mentions and DMs,
 * and coordinates with LLM service to generate responses.
 */
export class EventProcessor implements IEventProcessor {
  private logger = Logger.create('EventProcessor');

  constructor(
    private llmService: ILLMService,
    private slackService: ISlackService,
    private responsePoster: IResponsePoster,
    private config: WebhookConfiguration
  ) {}

  /**
   * Check if this processor can handle the given event
   */
  public canHandle(event: SlackEvent): boolean {
    if (event.type !== 'event_callback' || !event.event) {
      return false;
    }

    const eventType = event.event.type;
    return (
      eventType === 'app_mention' ||
      (eventType === 'message' &&
        this.config.enableDms &&
        event.event.channel_type === 'im')
    );
  }

  /**
   * Process a Slack event and generate response
   */
  public async processEvent(event: SlackEvent): Promise<ProcessingResult> {
    const startTime = Date.now();

    try {
      this.logger.info('Processing Slack event', {
        eventId: event.event_id,
        eventType: event.event?.type,
        teamId: event.team_id,
      });

      // Check if we should respond to this event
      if (!(await this.shouldRespond(event))) {
        this.logger.info('Skipping event - should not respond', {
          eventId: event.event_id,
          reason: 'should_not_respond',
        });
        return {
          success: true,
          processing_time_ms: Date.now() - startTime,
        };
      }

      // Extract context
      const webhookContext = await this.extractWebhookContext(event);
      const llmContext = await this.extractContext(event);

      // Generate response using LLM
      this.logger.info('Generating LLM response', {
        eventId: event.event_id,
        query: llmContext.query.substring(0, 100) + '...',
        channelCount: llmContext.channelIds.length,
      });

      const queryResult = await this.llmService.processQuery(llmContext);

      // Post response back to Slack
      const responseContext: ResponseContext = {
        channel_id: webhookContext.channel.id,
        thread_ts: webhookContext.thread_ts,
        user_id: webhookContext.user.id,
        original_message_ts: webhookContext.original_message_ts,
        mention_context: webhookContext.mention_text,
        is_dm: webhookContext.is_dm,
      };

      const postResult = await this.responsePoster.postResponse(
        queryResult.response,
        responseContext
      );

      if (!postResult.success) {
        throw new WebhookError(
          'Failed to post response to Slack',
          'RESPONSE_POST_FAILED',
          { postResult, context: responseContext }
        );
      }

      const processingTime = Date.now() - startTime;
      this.logger.info('Event processed successfully', {
        eventId: event.event_id,
        processingTime,
        responseLength: queryResult.response.length,
        messageTs: postResult.message_ts,
      });

      return {
        success: true,
        response: queryResult.response,
        context: webhookContext,
        processing_time_ms: processingTime,
      };
    } catch (error) {
      const processingTime = Date.now() - startTime;
      this.logger.error('Event processing failed', error as Error, {
        eventId: event.event_id,
        eventType: event.event?.type,
        processingTime,
      });

      return {
        success: false,
        error: (error as Error).message,
        processing_time_ms: processingTime,
      };
    }
  }

  /**
   * Extract LLM context from Slack event
   */
  public async extractContext(event: SlackEvent): Promise<LLMContext> {
    if (!event.event) {
      throw new WebhookError('No event data provided', 'INVALID_EVENT');
    }

    const eventData = event.event;

    try {
      // Get channel information
      const channel = await this.slackService.getChannelById(eventData.channel);
      if (!channel) {
        throw new WebhookError(
          `Channel not found: ${eventData.channel}`,
          'CHANNEL_NOT_FOUND'
        );
      }

      // Extract the actual query from the mention
      const mentionText = this.extractMentionText(eventData.text);

      // Get recent context from the channel if it's a threaded conversation
      let channelIds = [channel.id];
      let additionalContext = '';

      if (eventData.thread_ts && this.config.enableThreading) {
        try {
          const threadHistory = await this.slackService.getChannelHistory(
            eventData.channel,
            { limit: 10, oldest: eventData.thread_ts, includeThreads: true }
          );

          if (threadHistory.messages.length > 1) {
            additionalContext = `\n\nThread context:\n${threadHistory.messages
              .slice(0, 5) // Limit to last 5 messages
              .map(msg => `${msg.user}: ${msg.text}`)
              .join('\n')}`;
          }
        } catch (error) {
          this.logger.warn('Failed to get thread context', {
            error: (error as Error).message,
            threadTs: eventData.thread_ts,
          });
        }
      }

      return {
        query: mentionText + additionalContext,
        channelIds,
        messages: [],
        metadata: {
          total_messages: 0,
          channels: [{
            id: channel.id,
            name: channel.name,
            purpose: channel.purpose?.value,
            topic: channel.topic?.value,
          }],
          search_time_ms: 0,
          token_count: 0,
        },
      };
    } catch (error) {
      this.logger.error(
        'Failed to extract context from event',
        error as Error,
        {
          eventId: event.event_id,
          channelId: eventData.channel,
        }
      );
      throw new WebhookError(
        'Failed to extract context from event',
        'CONTEXT_EXTRACTION_FAILED',
        error
      );
    }
  }

  /**
   * Extract webhook-specific context
   */
  public async extractWebhookContext(
    event: SlackEvent
  ): Promise<WebhookContext> {
    if (!event.event) {
      throw new WebhookError('No event data provided', 'INVALID_EVENT');
    }

    const eventData = event.event;

    try {
      // Get channel and user information
      const [channel, user] = await Promise.all([
        this.slackService.getChannelById(eventData.channel),
        this.slackService.getUserInfo(eventData.user),
      ]);

      if (!channel) {
        throw new WebhookError(
          `Channel not found: ${eventData.channel}`,
          'CHANNEL_NOT_FOUND'
        );
      }

      const mentionText = this.extractMentionText(eventData.text);
      const isThreadReply = !!eventData.thread_ts;
      const isDm = eventData.channel_type === 'im';

      return {
        event,
        channel,
        user,
        thread_ts: eventData.thread_ts,
        mention_text: mentionText,
        is_thread_reply: isThreadReply,
        is_dm: isDm,
        original_message_ts: eventData.ts,
      };
    } catch (error) {
      this.logger.error('Failed to extract webhook context', error as Error, {
        eventId: event.event_id,
        channelId: eventData.channel,
        userId: eventData.user,
      });
      throw new WebhookError(
        'Failed to extract webhook context',
        'WEBHOOK_CONTEXT_FAILED',
        error
      );
    }
  }

  /**
   * Determine if the bot should respond to this event
   */
  public async shouldRespond(event: SlackEvent): Promise<boolean> {
    if (!event.event) {
      return false;
    }

    const eventData = event.event;

    // Don't respond to bot messages
    if (eventData.bot_id) {
      this.logger.debug('Skipping bot message', {
        botId: eventData.bot_id,
        eventId: event.event_id,
      });
      return false;
    }

    // Don't respond to message edits
    if (eventData.subtype === 'message_changed') {
      this.logger.debug('Skipping message edit', {
        eventId: event.event_id,
      });
      return false;
    }

    // Handle app mentions
    if (eventData.type === 'app_mention') {
      return true;
    }

    // Handle DMs if enabled
    if (
      eventData.type === 'message' &&
      eventData.channel_type === 'im' &&
      this.config.enableDms
    ) {
      return true;
    }

    return false;
  }

  /**
   * Extract the actual query text from a mention
   */
  private extractMentionText(text: string): string {
    // Remove bot mention pattern like <@U123456789>
    const cleanText = text.replace(/<@[UW][A-Z0-9]+>/g, '').trim();

    if (!cleanText) {
      return 'How can I help you?'; // Default question for empty mentions
    }

    return cleanText;
  }
}
