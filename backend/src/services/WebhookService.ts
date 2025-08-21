import crypto from 'crypto';
import { Logger } from '../utils/logger.js';
import { WebhookError } from '../utils/errors.js';
import { IWebhookService } from '../interfaces/services/IWebhookService.js';
import { IEventProcessor } from '../interfaces/services/IEventProcessor.js';
import {
  SlackEvent,
  WebhookResponse,
  WebhookHealthStatus,
  WebhookStats,
  EventCacheEntry,
  WebhookConfiguration,
} from '../types/webhook.js';

/**
 * WebhookService implementation
 *
 * Handles incoming Slack webhook events with signature validation,
 * duplicate detection, and event processing orchestration.
 */
export class WebhookService implements IWebhookService {
  private logger = Logger.create('WebhookService');
  private eventCache = new Map<string, EventCacheEntry>();
  private stats: WebhookStats;
  private startTime: number;

  constructor(
    private signingSecret: string,
    private eventProcessor: IEventProcessor,
    private config: WebhookConfiguration
  ) {
    this.startTime = Date.now();
    this.stats = {
      total_events: 0,
      events_by_type: {},
      successful_responses: 0,
      failed_responses: 0,
      average_processing_time_ms: 0,
      duplicate_events_blocked: 0,
      uptime_ms: 0,
    };

    this.logger.info('WebhookService initialized', {
      signatureValidation: config.enableSignatureValidation,
      duplicateTtlMs: config.duplicateEventTtlMs,
      processingTimeoutMs: config.processingTimeoutMs,
    });

    // Clean up event cache periodically
    setInterval(() => this.cleanupEventCache(), 60000); // Every minute
  }

  /**
   * Handle incoming Slack webhook event
   */
  public async handleSlackEvent(
    rawBody: string,
    signature: string,
    timestamp: string
  ): Promise<WebhookResponse> {
    const processingStart = Date.now();

    try {
      this.logger.info('Received webhook event', {
        bodyLength: rawBody.length,
        hasSignature: !!signature,
        timestamp,
      });

      // Validate signature if enabled
      if (
        this.config.enableSignatureValidation &&
        !this.validateSignature(rawBody, signature, timestamp)
      ) {
        this.logger.warn('Invalid webhook signature', {
          signature: signature?.substring(0, 20) + '...',
          timestamp,
        });
        this.stats.failed_responses++;
        return {
          statusCode: 401,
          body: { error: 'Invalid signature' },
        };
      }

      // Parse event
      let event: SlackEvent;
      try {
        event = JSON.parse(rawBody);
      } catch (parseError) {
        this.logger.error(
          'Failed to parse webhook event',
          parseError as Error,
          {
            bodyPreview: rawBody.substring(0, 200),
          }
        );
        this.stats.failed_responses++;
        return {
          statusCode: 400,
          body: { error: 'Invalid JSON' },
        };
      }

      // Update stats
      this.stats.total_events++;
      this.stats.events_by_type[event.type] =
        (this.stats.events_by_type[event.type] || 0) + 1;

      // Handle different event types
      if (event.type === 'url_verification') {
        return this.handleUrlVerification(event.challenge || '');
      }

      if (event.type === 'event_callback' && event.event) {
        // Check for duplicate events
        if (this.isEventDuplicate(event)) {
          this.logger.info('Blocking duplicate event', {
            eventId: event.event_id,
            eventType: event.event.type,
          });
          this.stats.duplicate_events_blocked++;
          return { statusCode: 200, body: { status: 'duplicate' } };
        }

        // Process event asynchronously (don't wait for response)
        this.processEventAsync(event)
          .then(() => {
            this.stats.successful_responses++;
          })
          .catch(error => {
            this.logger.error('Async event processing failed', error as Error, {
              eventId: event.event_id,
              eventType: event.event?.type,
            });
            this.stats.failed_responses++;
          });

        // Immediately acknowledge to Slack
        return { statusCode: 200, body: { status: 'ok' } };
      }

      // Handle rate limit notifications
      if (event.type === 'app_rate_limited') {
        this.logger.warn('Slack app rate limited', {
          teamId: event.team_id,
          minuteRateLimited: (event as any).minute_rate_limited,
        });
        return { statusCode: 200, body: { status: 'rate_limited' } };
      }

      // Unknown event type
      this.logger.warn('Unknown event type', {
        eventType: event.type,
        teamId: event.team_id,
      });

      return { statusCode: 200, body: { status: 'ignored' } };
    } catch (error) {
      const processingTime = Date.now() - processingStart;
      this.logger.error('Webhook processing failed', error as Error, {
        processingTime,
        bodyLength: rawBody.length,
      });

      this.stats.failed_responses++;

      return {
        statusCode: 500,
        body: { error: 'Internal server error' },
      };
    }
  }

  /**
   * Validate webhook signature from Slack
   */
  public validateSignature(
    body: string,
    signature: string,
    timestamp: string
  ): boolean {
    try {
      // Check timestamp to prevent replay attacks (within 5 minutes)
      const timestampNum = parseInt(timestamp, 10);
      const now = Math.floor(Date.now() / 1000);
      const timeDiff = Math.abs(now - timestampNum);

      if (timeDiff > 300) {
        // 5 minutes
        this.logger.warn('Webhook timestamp too old', {
          timestamp: timestampNum,
          now,
          diffSeconds: timeDiff,
        });
        return false;
      }

      // Calculate expected signature
      const sigBaseString = `v0:${timestamp}:${body}`;
      const expectedSignature = `v0=${crypto
        .createHmac('sha256', this.signingSecret)
        .update(sigBaseString, 'utf8')
        .digest('hex')}`;

      // Use constant-time comparison to prevent timing attacks
      return crypto.timingSafeEqual(
        Buffer.from(signature, 'utf8'),
        Buffer.from(expectedSignature, 'utf8')
      );
    } catch (error) {
      this.logger.error('Signature validation error', error as Error, {
        signature: signature?.substring(0, 20) + '...',
        timestamp,
      });
      return false;
    }
  }

  /**
   * Check if an event is a duplicate
   */
  public isEventDuplicate(event: SlackEvent): boolean {
    if (!event.event_id || !event.team_id) {
      return false; // Can't check without ID
    }

    const cacheKey = `${event.team_id}:${event.event_id}`;
    const existing = this.eventCache.get(cacheKey);

    if (existing) {
      return true; // Duplicate found
    }

    // Add to cache
    this.eventCache.set(cacheKey, {
      event_id: event.event_id,
      timestamp: Date.now(),
      team_id: event.team_id,
    });

    return false;
  }

  /**
   * Handle URL verification challenge
   */
  public handleUrlVerification(challenge: string): WebhookResponse {
    this.logger.info('Handling URL verification challenge', {
      challengeLength: challenge.length,
    });

    return {
      statusCode: 200,
      body: { challenge },
      headers: { 'Content-Type': 'application/json' },
    };
  }

  /**
   * Get health status
   */
  public getHealthStatus(): WebhookHealthStatus {
    const now = Date.now();
    this.stats.uptime_ms = now - this.startTime;

    return {
      status: this.determineHealthStatus(),
      events_processed: this.stats.total_events,
      events_failed: this.stats.failed_responses,
      average_processing_time_ms: this.calculateAverageProcessingTime(),
      last_event_time: this.getLastEventTime(),
      duplicate_events_blocked: this.stats.duplicate_events_blocked,
    };
  }

  /**
   * Get processing statistics
   */
  public getStats(): WebhookStats {
    this.stats.uptime_ms = Date.now() - this.startTime;
    this.stats.average_processing_time_ms =
      this.calculateAverageProcessingTime();
    return { ...this.stats };
  }

  /**
   * Process event asynchronously
   */
  private async processEventAsync(event: SlackEvent): Promise<void> {
    const processingStart = Date.now();

    try {
      // Add timeout for processing
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(
            new WebhookError('Event processing timeout', 'PROCESSING_TIMEOUT', {
              eventId: event.event_id,
              timeoutMs: this.config.processingTimeoutMs,
            })
          );
        }, this.config.processingTimeoutMs);
      });

      // Race between processing and timeout
      await Promise.race([
        this.eventProcessor.processEvent(event),
        timeoutPromise,
      ]);

      const processingTime = Date.now() - processingStart;
      this.logger.info('Event processed successfully', {
        eventId: event.event_id,
        eventType: event.event?.type,
        processingTime,
      });
    } catch (error) {
      const processingTime = Date.now() - processingStart;
      this.logger.error('Event processing failed', error as Error, {
        eventId: event.event_id,
        eventType: event.event?.type,
        processingTime,
      });
      throw error;
    }
  }

  /**
   * Clean up expired events from cache
   */
  private cleanupEventCache(): void {
    const now = Date.now();
    const expired = [];

    for (const [key, entry] of this.eventCache.entries()) {
      if (now - entry.timestamp > this.config.duplicateEventTtlMs) {
        expired.push(key);
      }
    }

    for (const key of expired) {
      this.eventCache.delete(key);
    }

    if (expired.length > 0) {
      this.logger.debug('Cleaned up expired event cache entries', {
        expiredCount: expired.length,
        remainingCount: this.eventCache.size,
      });
    }
  }

  /**
   * Determine overall health status
   */
  private determineHealthStatus(): 'healthy' | 'degraded' | 'unhealthy' {
    const errorRate =
      this.stats.total_events > 0
        ? this.stats.failed_responses / this.stats.total_events
        : 0;

    if (errorRate > 0.5) {
      return 'unhealthy';
    } else if (errorRate > 0.1) {
      return 'degraded';
    } else {
      return 'healthy';
    }
  }

  /**
   * Calculate average processing time
   */
  private calculateAverageProcessingTime(): number {
    // This would need to be tracked more granularly in a real implementation
    // For now, return a placeholder
    return 0;
  }

  /**
   * Get timestamp of last processed event
   */
  private getLastEventTime(): number | undefined {
    if (this.eventCache.size === 0) {
      return undefined;
    }

    let lastTime = 0;
    for (const entry of this.eventCache.values()) {
      if (entry.timestamp > lastTime) {
        lastTime = entry.timestamp;
      }
    }

    return lastTime;
  }
}
