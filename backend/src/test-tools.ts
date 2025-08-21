#!/usr/bin/env node

/**
 * Tool testing script
 *
 * Tests individual Slack tools to ensure they work correctly
 * before they're used by the LLM agent.
 */

import {
  getAppConfig,
  validateAppConfiguration,
} from '@/core/config/AppConfig.js';
import { SlackApiClient } from '@/services/api/SlackApiClient.js';
import { SlackService } from '@/services/SlackService.js';
import { createSlackTools } from '@/llm/tools/index.js';
import { Logger } from '@/utils/logger.js';

const logger = Logger.create('ToolTester');

interface TestCase {
  toolName: string;
  parameters: any;
  description: string;
}

async function testTools() {
  logger.info('🔧 Testing Slack tools...');

  try {
    // Validate configuration
    validateAppConfiguration();
    const config = getAppConfig();

    // Initialize services
    const slackApiClient = new SlackApiClient({
      botToken: config.getSlackConfig().botToken,
      userToken: config.getSlackConfig().userToken,
      maxRetries: 3,
      retryBackoffMs: 1000,
    });

    await slackApiClient.initialize();

    const slackService = new SlackService(slackApiClient);
    await slackService.initialize();

    // Create tools
    const tools = createSlackTools(slackService);
    logger.info(`📦 Created ${tools.length} tools`);

    // Get available channels for testing
    const channels = await slackService.getChannels();
    if (channels.length === 0) {
      logger.error('❌ No channels available for testing');
      process.exit(1);
    }

    const testChannel = channels[0];
    logger.info(
      `🎯 Using test channel: ${testChannel.name} (${testChannel.id})`
    );

    // Define test cases
    const testCases: TestCase[] = [
      {
        toolName: 'get_channel_info',
        parameters: { channel_id: testChannel.id },
        description: 'Get channel information',
      },
      {
        toolName: 'get_channel_history',
        parameters: { channel_id: testChannel.id, limit: 5 },
        description: 'Get recent channel messages',
      },
      {
        toolName: 'search_messages',
        parameters: {
          query: 'test',
          channels: [testChannel.id],
          limit: 3,
        },
        description: 'Search messages',
      },
      {
        toolName: 'list_files',
        parameters: {
          channels: [testChannel.id],
          limit: 3,
        },
        description: 'List files in channel',
      },
    ];

    // Run tests
    let passed = 0;
    let failed = 0;

    for (const testCase of testCases) {
      logger.info(`\n🧪 Testing: ${testCase.description}`);

      try {
        const tool = tools.find(t => t.name === testCase.toolName);

        if (!tool) {
          logger.error(`❌ Tool '${testCase.toolName}' not found`);
          failed++;
          continue;
        }

        // Validate parameters
        let validatedParams;
        try {
          validatedParams = tool.schema.parse(testCase.parameters);
          logger.info(`✅ Parameter validation passed`);
        } catch (validationError) {
          logger.error(`❌ Parameter validation failed:`, validationError);
          failed++;
          continue;
        }

        // Execute tool
        const startTime = Date.now();
        const result = await tool.func(validatedParams);
        const executionTime = Date.now() - startTime;

        if (result && typeof result === 'string' && result.includes('Error:')) {
          logger.error(
            `❌ Tool execution returned error: ${result.substring(0, 100)}...`
          );
          failed++;
        } else {
          logger.info(`✅ Tool executed successfully (${executionTime}ms)`);
          logger.info(
            `📄 Result preview: ${typeof result === 'string' ? result.substring(0, 100) + '...' : typeof result}`
          );
          passed++;
        }
      } catch (error) {
        logger.error(`❌ Tool test failed:`, error);
        failed++;
      }
    }

    // Report results
    logger.info('\n📊 TEST SUMMARY');
    logger.info(`✅ Passed: ${passed}`);
    logger.info(`❌ Failed: ${failed}`);
    logger.info(
      `📈 Success Rate: ${Math.round((passed / (passed + failed)) * 100)}%`
    );

    if (failed === 0) {
      logger.info(
        '\n🎉 All tool tests passed! Tools are ready for LLM agent use.'
      );
      process.exit(0);
    } else {
      logger.error(
        '\n💥 Some tool tests failed. Please review the errors above.'
      );
      process.exit(1);
    }
  } catch (error) {
    logger.error('❌ Tool testing failed:', error);
    process.exit(1);
  }
}

// Run tests if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  testTools().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

export { testTools };
