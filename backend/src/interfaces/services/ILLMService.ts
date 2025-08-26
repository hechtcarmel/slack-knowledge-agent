import {
  IInitializableService,
  IHealthCheckable,
} from '@/core/container/interfaces.js';

/**
 * LLM provider type
 */
export type LLMProvider = 'openai' | 'anthropic';

/**
 * LLM configuration for query execution
 */
export interface LLMConfig {
  provider?: LLMProvider;
  model?: string;
  maxTokens?: number;
  temperature?: number;
}

/**
 * Usage statistics for LLM operations
 */
export interface LLMUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  costUsd?: number;
}

/**
 * Permalink with description
 */
export interface PermalinkReference {
  url: string;
  description: string;
}

/**
 * Query result from LLM service
 */
export interface QueryResult {
  response: string;
  usage: LLMUsage;
  toolCalls?: number;
  provider: string;
  model: string;
  intermediateSteps?: any[];
  relevantPermalinks?: string[];
  permalinkReferences?: PermalinkReference[];
}

/**
 * Stream chunk for streaming responses
 */
export interface StreamChunk {
  content?: string;
  done?: boolean;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

/**
 * Context for LLM queries
 */
export interface LLMContext {
  query: string;
  channelIds: string[];
  messages: Array<{
    channel: string;
    user: string;
    text: string;
    timestamp: string;
    threadTs?: string;
  }>;
  metadata: {
    total_messages: number;
    channels: Array<{
      id: string;
      name: string;
      purpose?: string;
      topic?: string;
    }>;
    search_time_ms: number;
    token_count: number;
  };
}

/**
 * LLM service interface
 *
 * Defines the contract for LLM-related operations including
 * query processing, streaming, and provider management.
 */
export interface ILLMService extends IInitializableService, IHealthCheckable {
  /**
   * Process a query with the LLM
   */
  processQuery(
    context: LLMContext,
    config?: Partial<LLMConfig>,
    sessionId?: string
  ): Promise<QueryResult>;

  /**
   * Stream a query response
   */
  streamQuery(
    context: LLMContext,
    config?: Partial<LLMConfig>,
    sessionId?: string
  ): AsyncIterable<StreamChunk>;

  /**
   * Set the active LLM provider
   */
  setProvider(provider: LLMProvider): void;

  /**
   * Get available providers
   */
  getAvailableProviders(): LLMProvider[];

  /**
   * Get available models for a provider
   */
  getProviderModels(provider?: LLMProvider): Promise<string[]>;

  /**
   * Clear conversation memory
   */
  clearMemory(): Promise<void>;

  /**
   * Get statistics about the LLM service
   */
  getStats(): {
    providers: Record<string, boolean>;
    currentProvider: LLMProvider;
    activeQueries: number;
    totalQueries: number;
    cachedAgents: number;
  };
}

/**
 * Individual LLM provider interface
 */
export interface ILLMProvider {
  /**
   * Validate the provider configuration
   */
  validateConfig(): Promise<boolean>;

  /**
   * Get available models
   */
  getAvailableModels(): string[];

  /**
   * Calculate cost for token usage
   */
  calculateCost(
    usage: { promptTokens: number; completionTokens: number },
    model: string
  ): number;
}
