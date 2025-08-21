import {
  SlackEvent,
  WebhookResponse,
  WebhookHealthStatus,
  WebhookStats,
} from '../../types/webhook.js';

/**
 * Interface for the webhook service
 *
 * Handles incoming Slack webhook events, validates signatures,
 * and orchestrates event processing.
 */
export interface IWebhookService {
  /**
   * Handle an incoming Slack webhook event
   */
  handleSlackEvent(
    rawBody: string,
    signature: string,
    timestamp: string
  ): Promise<WebhookResponse>;

  /**
   * Validate webhook signature from Slack
   */
  validateSignature(
    body: string,
    signature: string,
    timestamp: string
  ): boolean;

  /**
   * Check if an event is a duplicate (for idempotency)
   */
  isEventDuplicate(event: SlackEvent): boolean;

  /**
   * Get health status of the webhook service
   */
  getHealthStatus(): WebhookHealthStatus;

  /**
   * Get processing statistics
   */
  getStats(): WebhookStats;

  /**
   * Process URL verification challenge from Slack
   */
  handleUrlVerification(challenge: string): WebhookResponse;
}
