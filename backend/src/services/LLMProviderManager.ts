import { Logger } from '@/utils/logger.js';
import { LLMError } from '@/utils/errors.js';
import {
  IInitializableService,
  IHealthCheckable,
} from '@/core/container/interfaces.js';
import { SlackOpenAILLM } from '@/llm/models/OpenAILLM.js';
import { SlackAnthropicLLM } from '@/llm/models/AnthropicLLM.js';
import {
  LLMProvider,
  ILLMProvider,
} from '@/interfaces/services/ILLMService.js';

/**
 * LLM provider manager configuration
 */
export interface LLMProviderConfig {
  openaiApiKey: string;
  anthropicApiKey?: string;
  defaultProvider: LLMProvider;
  defaultModel: string;
  requestTimeoutMs: number;
}

/**
 * LLM Provider Manager
 *
 * Manages the lifecycle and availability of different LLM providers.
 * Handles provider initialization, validation, and model management.
 */
export class LLMProviderManager
  implements IInitializableService, IHealthCheckable
{
  private logger = Logger.create('LLMProviderManager');
  private providers = new Map<LLMProvider, ILLMProvider>();
  private currentProvider: LLMProvider;
  private validatedProviders = new Set<LLMProvider>();

  constructor(private config: LLMProviderConfig) {
    this.currentProvider = config.defaultProvider;
  }

  /**
   * Initialize all configured providers
   */
  public async initialize(): Promise<void> {
    this.logger.info('Initializing LLM providers...');

    try {
      // Initialize OpenAI provider
      if (this.config.openaiApiKey?.startsWith('sk-')) {
        const openAIProvider = new SlackOpenAILLM(this.config.openaiApiKey, {
          model: this.getDefaultModelForProvider('openai'),
        });
        this.providers.set('openai', openAIProvider);
      }

      // Initialize Anthropic provider
      if (this.config.anthropicApiKey?.startsWith('sk-ant-')) {
        const anthropicProvider = new SlackAnthropicLLM(
          this.config.anthropicApiKey,
          {
            model: this.getDefaultModelForProvider('anthropic'),
          }
        );
        this.providers.set('anthropic', anthropicProvider);
      }

      // Validate all providers
      await this.validateAllProviders();

      // Log warning if no providers were configured at all
      if (this.providers.size === 0) {
        this.logger.warn('No LLM providers configured - check API key configuration', {
          openaiConfigured: !!this.config.openaiApiKey,
          anthropicConfigured: !!this.config.anthropicApiKey,
          openaiValid: this.config.openaiApiKey?.startsWith('sk-') || false,
          anthropicValid: this.config.anthropicApiKey?.startsWith('sk-ant-') || false,
        });
        // Don't set currentProvider to anything invalid
        return;
      }

      // Log warning if no valid providers instead of throwing error
      if (this.validatedProviders.size === 0) {
        this.logger.warn('No valid LLM providers configured - service will be unavailable', {
          configuredProviders: Array.from(this.providers.keys()),
          availableProviders: [],
        });
        // Don't throw error - allow service to initialize but be marked as unhealthy
        return;
      }

      // Set current provider to a valid one
      if (!this.validatedProviders.has(this.currentProvider)) {
        this.currentProvider = Array.from(this.validatedProviders)[0];
        this.logger.warn(
          'Default provider not available, switching to first valid provider',
          {
            newProvider: this.currentProvider,
          }
        );
      }

      this.logger.info('LLM providers initialized successfully', {
        availableProviders: Array.from(this.validatedProviders),
        currentProvider: this.currentProvider,
      });
    } catch (error) {
      this.logger.error('Failed to initialize LLM providers', error as Error);
      throw error;
    }
  }

  /**
   * Get a provider instance
   */
  public getProvider(provider?: LLMProvider): ILLMProvider {
    // Check if any providers are available
    if (this.validatedProviders.size === 0) {
      throw new LLMError(
        'No valid LLM providers available - check API keys configuration',
        'NO_PROVIDERS_AVAILABLE'
      );
    }

    const targetProvider = provider || this.currentProvider;
    const providerInstance = this.providers.get(targetProvider);

    if (!providerInstance) {
      throw new LLMError(
        `Provider '${targetProvider}' not available`,
        'INVALID_PROVIDER'
      );
    }

    if (!this.validatedProviders.has(targetProvider)) {
      throw new LLMError(
        `Provider '${targetProvider}' failed validation`,
        'INVALID_PROVIDER'
      );
    }

    return providerInstance;
  }

  /**
   * Set the current active provider
   */
  public setCurrentProvider(provider: LLMProvider): void {
    if (!this.validatedProviders.has(provider)) {
      throw new LLMError(
        `Provider '${provider}' not available or failed validation`,
        'INVALID_PROVIDER'
      );
    }

    this.currentProvider = provider;
    this.logger.info(`Switched to provider: ${provider}`);
  }

  /**
   * Get current provider
   */
  public getCurrentProvider(): LLMProvider | null {
    if (this.validatedProviders.size === 0) {
      return null;
    }
    return this.currentProvider;
  }

  /**
   * Get all available providers
   */
  public getAvailableProviders(): LLMProvider[] {
    return Array.from(this.validatedProviders);
  }

  /**
   * Get available models for a provider
   */
  public getProviderModels(provider?: LLMProvider): string[] {
    const targetProvider = provider || this.currentProvider;
    const providerInstance = this.getProvider(targetProvider);
    return providerInstance.getAvailableModels();
  }

  /**
   * Calculate cost for token usage
   */
  public calculateCost(
    usage: { promptTokens: number; completionTokens: number },
    model?: string,
    provider?: LLMProvider
  ): number {
    const targetProvider = provider || this.currentProvider;
    const providerInstance = this.getProvider(targetProvider);
    const targetModel =
      model || this.getDefaultModelForProvider(targetProvider);

    return providerInstance.calculateCost(usage, targetModel);
  }

  /**
   * Get default model for a provider
   */
  public getDefaultModelForProvider(provider: LLMProvider): string {
    // Check if configured model is compatible with provider
    const configuredModel = this.config.defaultModel;
    if (configuredModel) {
      const isOpenAIModel = configuredModel.toLowerCase().includes('gpt');
      const isAnthropicModel = configuredModel.toLowerCase().includes('claude');

      if (
        (provider === 'openai' && isOpenAIModel) ||
        (provider === 'anthropic' && isAnthropicModel)
      ) {
        return configuredModel;
      }
    }

    // Fall back to provider defaults
    return provider === 'openai' ? 'gpt-4o-mini' : 'claude-3-5-haiku-20241022';
  }

  /**
   * Get health status
   */
  public getHealthStatus(): {
    status: 'healthy' | 'degraded' | 'unhealthy';
    details: Record<string, any>;
  } {
    const providerStatus: Record<string, boolean> = {};
    let healthyCount = 0;

    for (const provider of this.providers.keys()) {
      const isHealthy = this.validatedProviders.has(provider);
      providerStatus[provider] = isHealthy;
      if (isHealthy) healthyCount++;
    }

    const totalProviders = this.providers.size;
    const status =
      healthyCount === 0
        ? 'unhealthy'
        : healthyCount < totalProviders
          ? 'degraded'
          : 'healthy';

    return {
      status,
      details: {
        providers: providerStatus,
        currentProvider: this.currentProvider,
        validatedProviders: Array.from(this.validatedProviders),
        totalProviders,
        healthyProviders: healthyCount,
      },
    };
  }

  /**
   * Validate all configured providers
   */
  private async validateAllProviders(): Promise<void> {
    const validationPromises: Promise<void>[] = [];

    for (const [provider, instance] of this.providers) {
      validationPromises.push(
        this.validateProvider(provider, instance).catch(error => {
          this.logger.warn(`Provider ${provider} validation failed`, {
            error: error.message,
          });
        })
      );
    }

    await Promise.all(validationPromises);

    this.logger.info(
      `Provider validation completed. Valid providers: ${Array.from(this.validatedProviders).join(', ')}`
    );
  }

  /**
   * Validate a single provider
   */
  private async validateProvider(
    provider: LLMProvider,
    instance: ILLMProvider
  ): Promise<void> {
    try {
      this.logger.info(`Validating provider: ${provider}`);
      const isValid = await instance.validateConfig();

      if (isValid) {
        this.validatedProviders.add(provider);
        this.logger.info(`Provider ${provider} validated successfully`);
      } else {
        this.logger.warn(`Provider ${provider} validation returned false`);
      }
    } catch (error) {
      this.logger.error(
        `Provider ${provider} validation failed`,
        error as Error
      );
      throw error;
    }
  }
}
