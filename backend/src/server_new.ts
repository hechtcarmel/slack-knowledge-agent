#!/usr/bin/env node

/**
 * Slack Knowledge Agent Server
 *
 * This is the main entry point for the application.
 * It uses the ApplicationFactory to create and start a fully configured application.
 */

import { createAndStartApplication } from '@/core/app/ApplicationFactory.js';
import { Logger } from '@/utils/logger.js';
import { SERVICE_TOKENS } from '@/core/container/interfaces.js';

const logger = Logger.create('Bootstrap');

/**
 * Main function to start the application
 */
async function main(): Promise<void> {
  try {
    logger.info('🚀 Starting Slack Knowledge Agent...');

    const application = await createAndStartApplication({
      enableRequestLogging: process.env.NODE_ENV !== 'test',
    });

    // Log successful startup
    const config = application
      .getContainer()
      .resolve(SERVICE_TOKENS.APP_CONFIG);
    logger.info('✅ Slack Knowledge Agent started successfully', {
      environment: config.getServerConfig().environment,
      port: config.getServerConfig().port,
      pid: process.pid,
    });
  } catch (error) {
    logger.error('❌ Failed to start Slack Knowledge Agent', error as Error);
    process.exit(1);
  }
}

// Start the application if this file is run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error('Fatal error during startup:', error);
    process.exit(1);
  });
}

export { main };
