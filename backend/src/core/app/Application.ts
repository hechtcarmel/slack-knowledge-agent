import { Application as ExpressApplication } from 'express';
import { Server } from 'http';
import { Logger } from '@/utils/logger.js';
import { IContainer } from '@/core/container/interfaces.js';
import { AppConfig } from '@/core/config/AppConfig.js';

/**
 * Application lifecycle states
 */
export type ApplicationState = 'stopped' | 'starting' | 'running' | 'stopping';

/**
 * Application configuration interface
 */
export interface ApplicationOptions {
  /** Express application instance */
  app: ExpressApplication;
  /** Dependency injection container */
  container: IContainer;
  /** Application configuration */
  config: AppConfig;
  /** Custom shutdown timeout (ms) */
  shutdownTimeoutMs?: number;
}

/**
 * Main application class
 *
 * Manages the application lifecycle, including startup, shutdown,
 * and dependency management.
 */
export class Application {
  private logger = Logger.create('Application');
  private state: ApplicationState = 'stopped';
  private server?: Server;
  private shutdownTimeoutMs: number;

  constructor(private options: ApplicationOptions) {
    this.shutdownTimeoutMs = options.shutdownTimeoutMs || 30000;
    this.setupShutdownHandlers();
  }

  /**
   * Get current application state
   */
  public getState(): ApplicationState {
    return this.state;
  }

  /**
   * Get the Express application instance
   */
  public getExpressApp(): ExpressApplication {
    return this.options.app;
  }

  /**
   * Get the dependency injection container
   */
  public getContainer(): IContainer {
    return this.options.container;
  }

  /**
   * Start the application
   */
  public async start(): Promise<void> {
    if (this.state !== 'stopped') {
      throw new Error(`Cannot start application in state: ${this.state}`);
    }

    this.state = 'starting';
    const startTime = Date.now();

    try {
      this.logger.info('Starting application...');

      // Initialize eager services
      await this.options.container.initializeEagerServices();

      // Start HTTP server
      await this.startHttpServer();

      const startupTime = Date.now() - startTime;
      this.state = 'running';

      this.logger.info('Application started successfully', {
        port: this.options.config.getServerConfig().port,
        environment: this.options.config.getServerConfig().environment,
        startupTime,
      });
    } catch (error) {
      this.state = 'stopped';
      this.logger.error('Failed to start application', error as Error);
      throw error;
    }
  }

  /**
   * Stop the application gracefully
   */
  public async stop(): Promise<void> {
    if (this.state !== 'running') {
      this.logger.warn(`Attempted to stop application in state: ${this.state}`);
      return;
    }

    this.state = 'stopping';
    const stopTime = Date.now();

    this.logger.info('Stopping application gracefully...');

    try {
      // Stop accepting new connections
      if (this.server) {
        await this.stopHttpServer();
      }

      // Dispose of all services
      await this.options.container.dispose();

      const shutdownTime = Date.now() - stopTime;
      this.state = 'stopped';

      this.logger.info('Application stopped successfully', {
        shutdownTime,
      });
    } catch (error) {
      this.logger.error('Error during application shutdown', error as Error);
      throw error;
    }
  }

  /**
   * Force stop the application (ungraceful shutdown)
   */
  public async forceStop(): Promise<void> {
    this.logger.warn('Forcing application shutdown...');

    try {
      if (this.server) {
        this.server.close();
      }
      this.state = 'stopped';
    } catch (error) {
      this.logger.error('Error during force shutdown', error as Error);
    }
  }

  /**
   * Get application health status
   */
  public getHealthStatus(): {
    status: 'healthy' | 'degraded' | 'unhealthy';
    uptime: number;
    state: ApplicationState;
    services?: Record<string, any>;
  } {
    const uptime = process.uptime() * 1000; // Convert to milliseconds

    // Basic health check - application should be running
    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';

    if (this.state !== 'running') {
      status = 'unhealthy';
    }

    return {
      status,
      uptime,
      state: this.state,
    };
  }

  /**
   * Start the HTTP server
   */
  private async startHttpServer(): Promise<void> {
    return new Promise((resolve, reject) => {
      const serverConfig = this.options.config.getServerConfig();

      this.server = this.options.app.listen(
        serverConfig.port,
        (error?: Error) => {
          if (error) {
            reject(error);
          } else {
            this.logger.info('HTTP server listening', {
              port: serverConfig.port,
              environment: serverConfig.environment,
            });
            resolve();
          }
        }
      );

      // Handle server errors
      this.server.on('error', (error: Error) => {
        this.logger.error('HTTP server error', error);
        reject(error);
      });
    });
  }

  /**
   * Stop the HTTP server gracefully
   */
  private async stopHttpServer(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.server) {
        resolve();
        return;
      }

      const shutdownTimer = setTimeout(() => {
        this.logger.warn('Graceful shutdown timeout, forcing server close');
        this.server?.close();
        resolve();
      }, this.shutdownTimeoutMs);

      this.server.close(error => {
        clearTimeout(shutdownTimer);

        if (error) {
          this.logger.error('Error closing HTTP server', error);
          reject(error);
        } else {
          this.logger.info('HTTP server closed gracefully');
          resolve();
        }
      });
    });
  }

  /**
   * Setup process signal handlers for graceful shutdown
   */
  private setupShutdownHandlers(): void {
    const handleShutdown = (signal: string) => {
      this.logger.info(`Received ${signal}, initiating graceful shutdown`);

      this.stop()
        .then(() => {
          this.logger.info('Graceful shutdown completed');
          process.exit(0);
        })
        .catch(error => {
          this.logger.error('Error during graceful shutdown', error);
          process.exit(1);
        });
    };

    // Handle termination signals
    process.on('SIGTERM', () => handleShutdown('SIGTERM'));
    process.on('SIGINT', () => handleShutdown('SIGINT'));

    // Handle uncaught exceptions
    process.on('uncaughtException', error => {
      this.logger.error('Uncaught exception', error);
      this.forceStop()
        .then(() => process.exit(1))
        .catch(() => process.exit(1));
    });

    // Handle unhandled promise rejections
    process.on('unhandledRejection', (reason, promise) => {
      this.logger.error(
        'Unhandled promise rejection',
        new Error(String(reason)),
        {
          promise: promise.toString(),
        }
      );
      this.forceStop()
        .then(() => process.exit(1))
        .catch(() => process.exit(1));
    });
  }
}
