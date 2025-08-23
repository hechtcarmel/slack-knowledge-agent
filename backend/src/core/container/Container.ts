import { Logger } from '@/utils/logger.js';
import {
  IContainer,
  ServiceRegistration,
  ServiceLifecycle,
  Constructor,
  Factory,
  ContainerOptions,
  IInitializableService,
  IDisposableService,
} from './interfaces.js';

/**
 * Dependency injection container implementation
 *
 * This container manages service registration, resolution, and lifecycle.
 * It supports singleton, transient, and scoped service lifetimes, along with
 * automatic dependency injection and circular dependency detection.
 */
export class Container implements IContainer {
  private services = new Map<string | symbol, ServiceRegistration>();
  private instances = new Map<string | symbol, any>();
  private resolutionStack = new Set<string | symbol>();
  private logger = Logger.create('Container');
  private parent?: IContainer;
  private children: Container[] = [];
  private options: ContainerOptions;

  constructor(parent?: IContainer, options: ContainerOptions = {}) {
    this.parent = parent;
    this.options = {
      strict: true,
      detectCircular: true,
      maxDepth: 50,
      logLifecycle: false,
      ...options,
    };
  }

  /**
   * Register a service with the container
   */
  public register<T>(
    token: string | symbol,
    registration: ServiceRegistration<T>
  ): void {
    if (this.options.logLifecycle) {
      this.logger.debug('Registering service', {
        token: token.toString(),
        lifecycle: registration.lifecycle,
        eager: registration.eager,
      });
    }

    this.services.set(token, registration);
  }

  /**
   * Register a singleton service
   */
  public registerSingleton<T>(
    token: string | symbol,
    implementation: Constructor<T> | T | Factory<T>,
    dependencies: (string | symbol)[] = []
  ): void {
    this.register(token, {
      implementation,
      lifecycle: 'singleton',
      dependencies,
    });
  }

  /**
   * Register a transient service
   */
  public registerTransient<T>(
    token: string | symbol,
    implementation: Constructor<T> | Factory<T>,
    dependencies: (string | symbol)[] = []
  ): void {
    this.register(token, {
      implementation,
      lifecycle: 'transient',
      dependencies,
    });
  }

  /**
   * Register a factory function
   */
  public registerFactory<T>(
    token: string | symbol,
    factory: Factory<T>,
    lifecycle: ServiceLifecycle = 'singleton'
  ): void {
    this.register(token, {
      implementation: factory,
      lifecycle,
    });
  }

  /**
   * Register an existing instance
   */
  public registerInstance<T>(token: string | symbol, instance: T): void {
    this.instances.set(token, instance);
    this.register(token, {
      implementation: instance,
      lifecycle: 'singleton',
    });
  }

  /**
   * Resolve a service from the container
   */
  public resolve<T>(token: string | symbol): T {
    try {
      return this.internalResolve<T>(token);
    } catch (error) {
      this.logger.error('Service resolution failed', error as Error, {
        token: token.toString(),
        resolutionStack: Array.from(this.resolutionStack).map(t =>
          t.toString()
        ),
      });
      throw error;
    } finally {
      this.resolutionStack.clear();
    }
  }

  /**
   * Internal service resolution logic
   */
  private internalResolve<T>(token: string | symbol, depth = 0): T {
    // Check maximum resolution depth
    if (depth > (this.options.maxDepth || 50)) {
      throw new Error(
        `Maximum resolution depth exceeded for ${token.toString()}`
      );
    }

    // Check for circular dependencies
    if (this.options.detectCircular && this.resolutionStack.has(token)) {
      const cycle = Array.from(this.resolutionStack).concat([token]);
      throw new Error(
        `Circular dependency detected: ${cycle.map(t => t.toString()).join(' -> ')}`
      );
    }

    // Check if we already have an instance (singleton)
    if (this.instances.has(token)) {
      return this.instances.get(token) as T;
    }

    // Check if service is registered in this container
    let registration = this.services.get(token);

    // If not found and we have a parent, try parent container
    if (!registration && this.parent) {
      try {
        return this.parent.resolve<T>(token);
      } catch (error) {
        // Continue to check our own registrations
      }
    }

    if (!registration) {
      if (this.options.strict) {
        throw new Error(`Service not registered: ${token.toString()}`);
      }
      return undefined as any;
    }

    this.resolutionStack.add(token);

    try {
      const instance = this.createInstance<T>(registration, depth);

      // Store singleton instances
      if (registration.lifecycle === 'singleton') {
        this.instances.set(token, instance);
      }

      if (this.options.logLifecycle) {
        this.logger.debug('Service resolved', {
          token: token.toString(),
          lifecycle: registration.lifecycle,
        });
      }

      return instance;
    } finally {
      this.resolutionStack.delete(token);
    }
  }

  /**
   * Create a service instance
   */
  private createInstance<T>(
    registration: ServiceRegistration<T>,
    depth: number
  ): T {
    const { implementation, dependencies = [] } = registration;

    // If implementation is already an instance, return it
    if (typeof implementation !== 'function') {
      return implementation as T;
    }

    // Resolve dependencies
    const resolvedDependencies = dependencies.map(dep =>
      this.internalResolve(dep, depth + 1)
    );

    // Check if implementation is a constructor or factory
    if (this.isConstructor(implementation)) {
      return new implementation(...resolvedDependencies);
    } else {
      // It's a factory function
      const result = (implementation as Factory<T>)(...resolvedDependencies);
      // Note: Factory functions should not return promises in synchronous resolution
      // If async behavior is needed, use initialize methods on services
      return result as T;
    }
  }

  /**
   * Check if a function is a constructor
   */
  private isConstructor(fn: any): fn is Constructor {
    try {
      // Constructors have a prototype property with constructor
      return fn.prototype && fn.prototype.constructor === fn;
    } catch {
      return false;
    }
  }

  /**
   * Check if a service is registered
   */
  public isRegistered(token: string | symbol): boolean {
    return (
      this.services.has(token) || (this.parent?.isRegistered(token) ?? false)
    );
  }

  /**
   * Get all registered service tokens
   */
  public getRegisteredTokens(): (string | symbol)[] {
    const tokens = Array.from(this.services.keys());
    if (this.parent) {
      const parentTokens = this.parent.getRegisteredTokens();
      return [...tokens, ...parentTokens.filter(t => !tokens.includes(t))];
    }
    return tokens;
  }

  /**
   * Initialize all eager services
   */
  public async initializeEagerServices(): Promise<void> {
    const eagerServices = Array.from(this.services.entries())
      .filter(([, registration]) => registration.eager)
      .map(([token]) => token);

    this.logger.info('Initializing eager services', {
      serviceCount: eagerServices.length,
      services: eagerServices.map(t => t.toString()),
    });

    for (const token of eagerServices) {
      try {
        const service = this.resolve(token);

        // If service implements IInitializableService, call initialize
        if (this.isInitializable(service)) {
          await service.initialize();
        }
      } catch (error) {
        this.logger.error(
          'Failed to initialize eager service',
          error as Error,
          {
            token: token.toString(),
          }
        );
        throw error;
      }
    }
  }

  /**
   * Dispose of all services and cleanup
   */
  public async dispose(): Promise<void> {
    this.logger.info('Disposing container services');

    // Dispose child containers first
    for (const child of this.children) {
      await child.dispose();
    }

    // Dispose singleton instances in reverse order
    const disposableInstances = Array.from(this.instances.entries())
      .reverse()
      .filter(([, instance]) => this.isDisposable(instance))
      .map(([token, instance]) => ({ token, instance }));

    for (const { token, instance } of disposableInstances) {
      try {
        await instance.dispose();
        this.logger.debug('Service disposed', { token: token.toString() });
      } catch (error) {
        this.logger.error('Error disposing service', error as Error, {
          token: token.toString(),
        });
      }
    }

    // Clear all registrations and instances
    this.services.clear();
    this.instances.clear();
    this.children.length = 0;
  }

  /**
   * Create a child container with access to parent services
   */
  public createChild(): IContainer {
    const child = new Container(this, this.options);
    this.children.push(child);
    return child;
  }

  /**
   * Check if an object implements IInitializableService
   */
  private isInitializable(obj: any): obj is IInitializableService {
    return obj && typeof obj.initialize === 'function';
  }

  /**
   * Check if an object implements IDisposableService
   */
  private isDisposable(obj: any): obj is IDisposableService {
    return obj && typeof obj.dispose === 'function';
  }

  /**
   * Get container statistics for debugging
   */
  public getStats(): {
    servicesRegistered: number;
    instancesCreated: number;
    childContainers: number;
  } {
    return {
      servicesRegistered: this.services.size,
      instancesCreated: this.instances.size,
      childContainers: this.children.length,
    };
  }
}

/**
 * Global container instance
 */
let globalContainer: Container | null = null;

/**
 * Get the global container instance
 */
export function getContainer(): Container {
  if (!globalContainer) {
    globalContainer = new Container();
  }
  return globalContainer;
}

/**
 * Reset the global container (useful for testing)
 */
export function resetContainer(): void {
  if (globalContainer) {
    globalContainer.dispose().catch(error => {
      const logger = Logger.create('Container');
      logger.error('Error disposing global container', error);
    });
  }
  globalContainer = null;
}
