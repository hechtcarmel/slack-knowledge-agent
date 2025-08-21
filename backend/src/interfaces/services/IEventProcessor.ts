import {
  SlackEvent,
  ProcessingResult,
  WebhookContext,
} from '../../types/webhook.js';
import { LLMContext } from './ILLMService.js';

/**
 * Interface for event processing service
 *
 * Processes specific Slack event types and prepares them for LLM processing.
 */
export interface IEventProcessor {
  /**
   * Check if this processor can handle the given event type
   */
  canHandle(event: SlackEvent): boolean;

  /**
   * Process a Slack event and generate response
   */
  processEvent(event: SlackEvent): Promise<ProcessingResult>;

  /**
   * Extract and prepare context from Slack event for LLM processing
   */
  extractContext(event: SlackEvent): Promise<LLMContext>;

  /**
   * Determine if the bot should respond to this event
   */
  shouldRespond(event: SlackEvent): Promise<boolean>;

  /**
   * Extract webhook context from event
   */
  extractWebhookContext(event: SlackEvent): Promise<WebhookContext>;
}
