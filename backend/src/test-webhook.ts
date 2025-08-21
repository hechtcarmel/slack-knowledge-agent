#!/usr/bin/env tsx

/**
 * Webhook Testing Script
 *
 * This script helps test the webhook functionality by simulating
 * Slack webhook events and verifying the implementation.
 */

import crypto from 'crypto';
import { WebhookService } from './services/WebhookService.js';
import { EventProcessor } from './services/EventProcessor.js';
import { ResponsePoster } from './services/ResponsePoster.js';
import { SlackEvent, WebhookConfiguration } from './types/webhook.js';
import { Logger } from './utils/logger.js';

const logger = Logger.create('WebhookTest');

// Mock implementations for testing
class MockLLMService {
  async processQuery(context: any) {
    return {
      response: `I received your query: "${context.query.substring(0, 50)}...". This is a test response from the webhook system.`,
      usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
      provider: 'test',
      model: 'test-model',
    };
  }
}

class MockSlackService {
  async getChannelById(channelId: string) {
    return {
      id: channelId,
      name: 'test-channel',
      purpose: { value: 'Test channel purpose' },
      topic: { value: 'Test channel topic' },
      num_members: 5,
    };
  }

  async getUserInfo(userId: string) {
    return {
      id: userId,
      name: 'testuser',
      real_name: 'Test User',
      display_name: 'Test User',
    };
  }

  async getChannelHistory() {
    return {
      messages: [],
      metadata: {
        channelName: 'test-channel',
        messageCount: 0,
        threadCount: 0,
      },
    };
  }
}

class MockSlackApiClient {
  async postMessage(message: any) {
    logger.info('Mock: Would post message', {
      channel: message.channel,
      textLength: message.text.length,
      isThreaded: !!message.thread_ts,
    });
    return {
      ok: true,
      ts: Date.now().toString(),
      channel: message.channel,
    };
  }

  async openDirectMessage(userId: string) {
    return {
      ok: true,
      channel: { id: `D${userId}` },
    };
  }
}

/**
 * Create a test Slack event
 */
function createTestEvent(): SlackEvent {
  return {
    type: 'event_callback',
    team_id: 'T123456',
    api_app_id: 'A123456',
    event_id: 'Ev123456',
    event_time: Math.floor(Date.now() / 1000),
    event: {
      type: 'app_mention',
      user: 'U123456',
      text: '<@U987654321> What is this channel about? Can you help me understand the recent discussions?',
      ts: Date.now().toString(),
      channel: 'C123456',
    },
  };
}

/**
 * Create a test threaded event
 */
function createTestThreadEvent(): SlackEvent {
  const baseEvent = createTestEvent();
  return {
    ...baseEvent,
    event: {
      ...baseEvent.event!,
      text: '<@U987654321> Can you elaborate on the previous discussion?',
      thread_ts: '1234567890.123456',
    },
  };
}

/**
 * Create webhook signature for testing
 */
function createWebhookSignature(
  body: string,
  secret: string,
  timestamp: string
): string {
  const sigBaseString = `v0:${timestamp}:${body}`;
  const signature = crypto
    .createHmac('sha256', secret)
    .update(sigBaseString, 'utf8')
    .digest('hex');
  return `v0=${signature}`;
}

/**
 * Test webhook service initialization
 */
async function testWebhookServiceInit() {
  logger.info('Testing WebhookService initialization...');

  const config: WebhookConfiguration = {
    enableSignatureValidation: true,
    duplicateEventTtlMs: 300000,
    processingTimeoutMs: 25000,
    enableThreading: true,
    enableDms: true,
    maxResponseLength: 4000,
  };

  const mockSlackService = new MockSlackService() as any;
  const mockLLMService = new MockLLMService() as any;
  const mockSlackApiClient = new MockSlackApiClient() as any;

  const responsePoster = new ResponsePoster(mockSlackApiClient, config);
  const eventProcessor = new EventProcessor(
    mockLLMService,
    mockSlackService,
    responsePoster,
    config
  );
  const webhookService = new WebhookService(
    'test-signing-secret',
    eventProcessor,
    config
  );

  logger.info('✅ WebhookService initialized successfully');
  return webhookService;
}

/**
 * Test signature validation
 */
async function testSignatureValidation(webhookService: WebhookService) {
  logger.info('Testing signature validation...');

  const testBody = JSON.stringify(createTestEvent());
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const validSignature = createWebhookSignature(
    testBody,
    'test-signing-secret',
    timestamp
  );
  const invalidSignature = 'v0=invalid-signature';

  // Test valid signature
  const validResult = webhookService.validateSignature(
    testBody,
    validSignature,
    timestamp
  );
  if (!validResult) {
    throw new Error('Valid signature should pass validation');
  }

  // Test invalid signature
  const invalidResult = webhookService.validateSignature(
    testBody,
    invalidSignature,
    timestamp
  );
  if (invalidResult) {
    throw new Error('Invalid signature should fail validation');
  }

  logger.info('✅ Signature validation tests passed');
}

/**
 * Test event processing
 */
async function testEventProcessing(webhookService: WebhookService) {
  logger.info('Testing event processing...');

  const testEvent = createTestEvent();
  const testBody = JSON.stringify(testEvent);
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const signature = createWebhookSignature(
    testBody,
    'test-signing-secret',
    timestamp
  );

  const result = await webhookService.handleSlackEvent(
    testBody,
    signature,
    timestamp
  );

  if (result.statusCode !== 200) {
    throw new Error(`Expected status 200, got ${result.statusCode}`);
  }

  logger.info('✅ Event processing test passed', {
    statusCode: result.statusCode,
    body: result.body,
  });
}

/**
 * Test duplicate event detection
 */
async function testDuplicateDetection(webhookService: WebhookService) {
  logger.info('Testing duplicate event detection...');

  const testEvent = createTestEvent();

  // First event should be new
  const isFirstDuplicate = webhookService.isEventDuplicate(testEvent);
  if (isFirstDuplicate) {
    throw new Error('First event should not be marked as duplicate');
  }

  // Second identical event should be duplicate
  const isSecondDuplicate = webhookService.isEventDuplicate(testEvent);
  if (!isSecondDuplicate) {
    throw new Error('Second identical event should be marked as duplicate');
  }

  logger.info('✅ Duplicate detection test passed');
}

/**
 * Test URL verification
 */
async function testUrlVerification(webhookService: WebhookService) {
  logger.info('Testing URL verification...');

  const testChallenge = 'test-challenge-string-12345';
  const result = webhookService.handleUrlVerification(testChallenge);

  if (result.statusCode !== 200) {
    throw new Error(`Expected status 200, got ${result.statusCode}`);
  }

  if (result.body.challenge !== testChallenge) {
    throw new Error(
      `Expected challenge ${testChallenge}, got ${result.body.challenge}`
    );
  }

  logger.info('✅ URL verification test passed');
}

/**
 * Run all tests
 */
async function runTests() {
  try {
    logger.info('🚀 Starting webhook tests...');

    const webhookService = await testWebhookServiceInit();

    await testSignatureValidation(webhookService);
    await testDuplicateDetection(webhookService);
    await testUrlVerification(webhookService);
    await testEventProcessing(webhookService);

    logger.info('🎉 All webhook tests passed!');

    // Test health status
    const health = webhookService.getHealthStatus();
    logger.info('Webhook health status:', health);

    const stats = webhookService.getStats();
    logger.info('Webhook statistics:', stats);
  } catch (error) {
    logger.error('❌ Webhook tests failed', error as Error);
    process.exit(1);
  }
}

// Run tests if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runTests();
}
