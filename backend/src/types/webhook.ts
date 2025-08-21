/**
 * Webhook types and interfaces for Slack event handling
 */

import { Channel } from './index.js';

/**
 * Base Slack event structure
 */
export interface SlackEvent {
  type: 'event_callback' | 'url_verification' | 'app_rate_limited';
  team_id: string;
  api_app_id: string;
  event?: SlackEventData;
  event_id?: string;
  event_time?: number;
  challenge?: string; // For URL verification
  token?: string; // Deprecated, use signing secret instead
}

/**
 * Slack event data for different event types
 */
export interface SlackEventData {
  type: 'app_mention' | 'message';
  user: string;
  text: string;
  ts: string;
  channel: string;
  thread_ts?: string;
  channel_type?: 'channel' | 'group' | 'im';
  bot_id?: string;
  subtype?: string;
  edited?: {
    user: string;
    ts: string;
  };
}

/**
 * Context extracted from webhook events for LLM processing
 */
export interface WebhookContext {
  event: SlackEvent;
  channel: Channel;
  user: any;
  thread_ts?: string;
  mention_text: string;
  is_thread_reply: boolean;
  is_dm: boolean;
  original_message_ts: string;
}

/**
 * Context for posting responses back to Slack
 */
export interface ResponseContext {
  channel_id: string;
  thread_ts?: string;
  user_id: string;
  original_message_ts: string;
  mention_context: string;
  is_dm: boolean;
}

/**
 * Result of webhook event processing
 */
export interface ProcessingResult {
  success: boolean;
  response?: string;
  error?: string;
  context?: WebhookContext;
  processing_time_ms: number;
}

/**
 * Result of posting response to Slack
 */
export interface PostResult {
  success: boolean;
  message_ts?: string;
  error?: string;
  channel_id: string;
  thread_ts?: string;
}

/**
 * Webhook health status
 */
export interface WebhookHealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  events_processed: number;
  events_failed: number;
  average_processing_time_ms: number;
  last_event_time?: number;
  duplicate_events_blocked: number;
}

/**
 * Webhook response to Slack
 */
export interface WebhookResponse {
  statusCode: number;
  body?: any;
  headers?: Record<string, string>;
}

/**
 * Event cache entry for duplicate detection
 */
export interface EventCacheEntry {
  event_id: string;
  timestamp: number;
  team_id: string;
}

/**
 * Formatted Slack message for posting
 */
export interface SlackMessage {
  channel: string;
  text: string;
  thread_ts?: string;
  blocks?: any[];
  attachments?: any[];
  unfurl_links?: boolean;
  unfurl_media?: boolean;
}

/**
 * Webhook processing statistics
 */
export interface WebhookStats {
  total_events: number;
  events_by_type: Record<string, number>;
  successful_responses: number;
  failed_responses: number;
  average_processing_time_ms: number;
  duplicate_events_blocked: number;
  uptime_ms: number;
}

/**
 * Webhook configuration from environment
 */
export interface WebhookConfiguration {
  enableSignatureValidation: boolean;
  duplicateEventTtlMs: number;
  processingTimeoutMs: number;
  enableThreading: boolean;
  enableDms: boolean;
  maxResponseLength: number;
}
