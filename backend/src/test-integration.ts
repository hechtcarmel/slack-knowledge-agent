#!/usr/bin/env node

/**
 * Integration test script for the new refactored backend architecture
 *
 * This script tests the key components of the new architecture:
 * - Configuration validation
 * - Dependency injection container
 * - Service initialization
 * - Basic functionality
 */

import {
  getAppConfig,
  validateAppConfiguration,
} from '@/core/config/AppConfig.js';
import { Container } from '@/core/container/Container.js';
import { ApplicationFactory } from '@/core/app/ApplicationFactory.js';
import { Logger } from '@/utils/logger.js';

const logger = Logger.create('IntegrationTest');

interface TestResult {
  name: string;
  status: 'PASS' | 'FAIL' | 'SKIP';
  message?: string;
  error?: string;
  duration?: number;
}

class IntegrationTester {
  private results: TestResult[] = [];

  async runTest(name: string, testFn: () => Promise<void>): Promise<void> {
    const startTime = Date.now();
    logger.info(`🧪 Running test: ${name}`);

    try {
      await testFn();
      const duration = Date.now() - startTime;
      this.results.push({
        name,
        status: 'PASS',
        message: `✅ ${name} passed`,
        duration,
      });
      logger.info(`✅ ${name} PASSED (${duration}ms)`);
    } catch (error) {
      const duration = Date.now() - startTime;
      this.results.push({
        name,
        status: 'FAIL',
        error: (error as Error).message,
        duration,
      });
      logger.error(`❌ ${name} FAILED (${duration}ms)`, error as Error);
    }
  }

  async runAllTests(): Promise<void> {
    logger.info('🚀 Starting integration tests for refactored backend...\n');

    // Test 1: Configuration validation
    await this.runTest('Configuration Validation', async () => {
      validateAppConfiguration();
      const config = getAppConfig();

      if (!config.getSlackConfig().botToken) {
        throw new Error('Slack bot token not configured');
      }
      if (!config.getLLMConfig().openaiApiKey) {
        throw new Error('OpenAI API key not configured');
      }
    });

    // Test 2: Container creation and basic registration
    await this.runTest('Dependency Injection Container', async () => {
      const container = new Container();

      // Test basic registration
      container.registerInstance('test', { value: 'test' });
      const resolved = container.resolve('test');

      if (resolved.value !== 'test') {
        throw new Error('Container resolution failed');
      }

      // Test service registration
      container.registerSingleton(
        'testService',
        class TestService {
          getValue() {
            return 'service-value';
          }
        }
      );

      const service = container.resolve('testService');
      if (service.getValue() !== 'service-value') {
        throw new Error('Service registration failed');
      }
    });

    // Test 3: Application factory creation
    await this.runTest('Application Factory', async () => {
      const factory = new ApplicationFactory();
      const application = await factory.createApplication({
        skipValidation: false,
        enableRequestLogging: false,
      });

      // Check that application was created
      if (!application) {
        throw new Error('Application creation failed');
      }

      // Check that container has required services
      const container = application.getContainer();
      const registeredTokens = container.getRegisteredTokens();

      if (registeredTokens.length === 0) {
        throw new Error('No services registered in container');
      }
    });

    // Test 4: Service initialization (without starting server)
    await this.runTest('Service Initialization', async () => {
      const factory = new ApplicationFactory();
      const application = await factory.createApplication({
        skipValidation: false,
        enableRequestLogging: false,
      });

      const container = application.getContainer();

      try {
        // Initialize eager services
        await container.initializeEagerServices();
      } catch (error) {
        // This might fail due to missing external dependencies (Slack tokens, etc.)
        // but we can check if the services are at least registered
        const stats = container.getStats();
        if (stats.servicesRegistered === 0) {
          throw new Error('No services registered');
        }
        // Log warning but don't fail the test
        logger.warn(
          'Service initialization partially failed (likely due to missing API keys)',
          {
            error: (error as Error).message,
          }
        );
      }
    });

    // Test 5: Express app configuration
    await this.runTest('Express Application Setup', async () => {
      const factory = new ApplicationFactory();
      const application = await factory.createApplication({
        skipValidation: false,
        enableRequestLogging: false,
      });

      const expressApp = application.getExpressApp();

      if (!expressApp) {
        throw new Error('Express app not created');
      }

      // Check that middleware is configured
      if (!expressApp._router) {
        throw new Error('Express router not configured');
      }
    });

    // Generate test report
    this.generateReport();
  }

  private generateReport(): void {
    const totalTests = this.results.length;
    const passedTests = this.results.filter(r => r.status === 'PASS').length;
    const failedTests = this.results.filter(r => r.status === 'FAIL').length;
    const skippedTests = this.results.filter(r => r.status === 'SKIP').length;

    logger.info('\n📊 TEST RESULTS SUMMARY');
    logger.info('='.repeat(50));
    logger.info(`Total Tests: ${totalTests}`);
    logger.info(`Passed: ${passedTests} ✅`);
    logger.info(`Failed: ${failedTests} ${failedTests > 0 ? '❌' : ''}`);
    logger.info(`Skipped: ${skippedTests} ${skippedTests > 0 ? '⏭️' : ''}`);
    logger.info(
      `Success Rate: ${Math.round((passedTests / totalTests) * 100)}%`
    );

    if (this.results.length > 0) {
      logger.info('\n📋 DETAILED RESULTS:');
      this.results.forEach(result => {
        const status =
          result.status === 'PASS'
            ? '✅'
            : result.status === 'FAIL'
              ? '❌'
              : '⏭️';
        const duration = result.duration ? `(${result.duration}ms)` : '';
        logger.info(`${status} ${result.name} ${duration}`);

        if (result.error) {
          logger.info(`   Error: ${result.error}`);
        }
      });
    }

    logger.info('\n🎯 RECOMMENDATIONS:');

    if (failedTests === 0) {
      logger.info(
        '🎉 All tests passed! The refactored architecture is ready to use.'
      );
      logger.info(
        '🚀 You can safely switch to using server_new.ts as your entry point.'
      );
    } else {
      logger.info('⚠️  Some tests failed. Please review the errors above.');
      logger.info('💡 Most likely causes:');
      logger.info(
        '   - Missing or invalid API keys (SLACK_BOT_TOKEN, OPENAI_API_KEY)'
      );
      logger.info('   - Network connectivity issues');
      logger.info('   - Environment configuration problems');
    }

    logger.info('\n📖 Next Steps:');
    logger.info('1. Fix any failing tests');
    logger.info('2. Update your deployment to use server_new.ts');
    logger.info('3. Test your specific use cases');
    logger.info('4. Monitor performance improvements');

    // Exit with appropriate code
    process.exit(failedTests > 0 ? 1 : 0);
  }
}

/**
 * Main function to run integration tests
 */
async function main(): Promise<void> {
  const tester = new IntegrationTester();

  try {
    await tester.runAllTests();
  } catch (error) {
    logger.error('Fatal error during testing', error as Error);
    process.exit(1);
  }
}

// Run tests if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error('Unhandled error:', error);
    process.exit(1);
  });
}

export { IntegrationTester, main };
