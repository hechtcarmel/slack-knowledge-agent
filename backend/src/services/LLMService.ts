import { Logger } from '@/utils/logger.js';
import { LLMError } from '@/utils/errors.js';
import { LLMProviderManager, LLMProviderConfig } from './LLMProviderManager.js';
import { QueryExecutor, QueryExecutorConfig } from './QueryExecutor.js';
import { AgentManager, AgentConfig } from './AgentManager.js';
import { ISlackService } from '@/interfaces/services/ISlackService.js';
import {
  ILLMService,
  LLMContext,
  LLMConfig,
  QueryResult,
  StreamChunk,
  LLMProvider,
} from '@/interfaces/services/ILLMService.js';
import { ConversationLLMContext } from '@/types/chat.js';

/**
 * Combined LLM service configuration
 */
export interface LLMServiceConfig {
  provider: LLMProviderConfig;
  executor: QueryExecutorConfig;
  agent: AgentConfig;
}

/**
 * LLM Service
 *
 * Main service for LLM operations. This service coordinates between
 * the LLMProviderManager, QueryExecutor, and AgentManager to provide
 * a unified interface for LLM functionality.
 */
export class LLMService implements ILLMService {
  private logger = Logger.create('LLMService');
  private providerManager: LLMProviderManager;
  private queryExecutor: QueryExecutor;
  private agentManager: AgentManager;
  private isInitialized = false;

  constructor(
    private slackService: ISlackService,
    private config: LLMServiceConfig
  ) {
    // Create service instances
    this.providerManager = new LLMProviderManager(config.provider);
    this.agentManager = new AgentManager(
      this.providerManager,
      this.slackService,
      config.agent
    );
    this.queryExecutor = new QueryExecutor(
      this.providerManager,
      this.agentManager,
      this.slackService,
      config.executor
    );
  }

  /**
   * Initialize the LLM service and all sub-services
   */
  public async initialize(): Promise<void> {
    if (this.isInitialized) {
      this.logger.warn('LLMService already initialized');
      return;
    }

    this.logger.info('Initializing LLM service...');

    try {
      // Initialize in dependency order
      await this.providerManager.initialize();
      await this.agentManager.initialize();
      await this.queryExecutor.initialize();

      this.isInitialized = true;

      this.logger.info('LLM service initialized successfully', {
        availableProviders: this.providerManager.getAvailableProviders(),
        currentProvider: this.providerManager.getCurrentProvider(),
        toolsCount: this.agentManager.getStats().toolsCount,
      });
    } catch (error) {
      this.logger.error('Failed to initialize LLM service', error as Error);
      throw error;
    }
  }

  /**
   * Process a query with the LLM
   */
  public async processQuery(
    context: LLMContext,
    config: Partial<LLMConfig> = {}
  ): Promise<QueryResult> {
    this.ensureInitialized();

    const startTime = Date.now();

    try {
      this.logger.info('Processing LLM query', {
        query: context.query.substring(0, 100) + '...',
        provider: config.provider,
        model: config.model,
        channels: context.channelIds.length,
      });

      const result = await this.queryExecutor.executeQuery(context, config);

      const processingTime = Date.now() - startTime;

      this.logger.info('Query processed successfully', {
        provider: result.provider,
        model: result.model,
        outputLength: result.response.length,
        toolCalls: result.toolCalls,
        processingTime,
        usage: result.usage,
      });

      return result;
    } catch (error) {
      const processingTime = Date.now() - startTime;
      this.logger.error('Query processing failed', error as Error, {
        query: context.query.substring(0, 100) + '...',
        provider: config.provider,
        processingTime,
      });
      throw error;
    }
  }

  /**
   * Stream a query response
   */
  public async *streamQuery(
    context: LLMContext,
    config: Partial<LLMConfig> = {}
  ): AsyncIterable<StreamChunk> {
    this.ensureInitialized();

    try {
      this.logger.info('Starting streaming query', {
        query: context.query.substring(0, 100) + '...',
        provider: config.provider,
        model: config.model,
        channels: context.channelIds.length,
      });

      yield* this.queryExecutor.streamQuery(context, config);
    } catch (error) {
      this.logger.error('Streaming query failed', error as Error, {
        query: context.query.substring(0, 100) + '...',
        provider: config.provider,
      });
      throw error;
    }
  }

  /**
   * Process a query with conversation context
   */
  public async processConversationQuery(
    context: ConversationLLMContext,
    config: Partial<LLMConfig> = {}
  ): Promise<QueryResult> {
    this.ensureInitialized();

    const startTime = Date.now();

    try {
      this.logger.info('Processing conversation query', {
        query: context.query.substring(0, 100) + '...',
        provider: config.provider,
        model: config.model,
        channels: context.channelIds.length,
        conversationId: context.metadata.conversationId,
        historyLength: context.conversationHistory.length,
      });

      // Convert ConversationLLMContext to LLMContext for existing systems
      const llmContext: LLMContext = {
        query: this.buildConversationAwareQuery(context),
        channelIds: context.channelIds,
        messages: context.messages,
        metadata: {
          total_messages: context.metadata.total_messages,
          channels: context.metadata.channels,
          search_time_ms: context.metadata.search_time_ms,
          token_count: context.metadata.token_count,
        },
      };

      const result = await this.queryExecutor.executeQuery(llmContext, config);

      const processingTime = Date.now() - startTime;

      this.logger.info('Conversation query processed successfully', {
        provider: result.provider,
        model: result.model,
        outputLength: result.response.length,
        toolCalls: result.toolCalls,
        processingTime,
        usage: result.usage,
        conversationId: context.metadata.conversationId,
      });

      return result;
    } catch (error) {
      const processingTime = Date.now() - startTime;
      this.logger.error(
        'Conversation query processing failed',
        error as Error,
        {
          query: context.query.substring(0, 100) + '...',
          provider: config.provider,
          processingTime,
          conversationId: context.metadata.conversationId,
        }
      );
      throw error;
    }
  }

  /**
   * Stream a conversation query response
   */
  public async *streamConversationQuery(
    context: ConversationLLMContext,
    config: Partial<LLMConfig> = {}
  ): AsyncIterable<StreamChunk> {
    this.ensureInitialized();

    try {
      this.logger.info('Starting streaming conversation query', {
        query: context.query.substring(0, 100) + '...',
        provider: config.provider,
        model: config.model,
        channels: context.channelIds.length,
        conversationId: context.metadata.conversationId,
        historyLength: context.conversationHistory.length,
      });

      // Convert ConversationLLMContext to LLMContext for existing systems
      const llmContext: LLMContext = {
        query: this.buildConversationAwareQuery(context),
        channelIds: context.channelIds,
        messages: context.messages,
        metadata: {
          total_messages: context.metadata.total_messages,
          channels: context.metadata.channels,
          search_time_ms: context.metadata.search_time_ms,
          token_count: context.metadata.token_count,
        },
      };

      yield* this.queryExecutor.streamQuery(llmContext, config);
    } catch (error) {
      this.logger.error('Streaming conversation query failed', error as Error, {
        query: context.query.substring(0, 100) + '...',
        provider: config.provider,
        conversationId: context.metadata.conversationId,
      });
      throw error;
    }
  }

  /**
   * Build a conversation-aware query that includes chat history
   */
  private buildConversationAwareQuery(context: ConversationLLMContext): string {
    if (context.conversationHistory.length === 0) {
      return context.query;
    }

    // Build conversation context string
    const conversationContext = context.conversationHistory
      .slice(-5) // Use last 5 messages for context
      .map(
        msg => `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}`
      )
      .join('\n\n');

    // Combine conversation history with current query
    return `Previous conversation context:
${conversationContext}

Current user question: ${context.query}`;
  }

  /**
   * Set the active LLM provider
   */
  public setProvider(provider: LLMProvider): void {
    this.ensureInitialized();
    this.providerManager.setCurrentProvider(provider);
  }

  /**
   * Get available providers
   */
  public getAvailableProviders(): LLMProvider[] {
    this.ensureInitialized();
    return this.providerManager.getAvailableProviders();
  }

  /**
   * Get available models for a provider
   */
  public async getProviderModels(provider?: LLMProvider): Promise<string[]> {
    this.ensureInitialized();
    return this.providerManager.getProviderModels(provider);
  }

  /**
   * Clear conversation memory
   */
  public async clearMemory(): Promise<void> {
    this.ensureInitialized();
    await this.agentManager.clearMemory();
  }

  /**
   * Get health status
   */
  public getHealthStatus(): {
    status: 'healthy' | 'degraded' | 'unhealthy';
    details?: Record<string, any>;
  } {
    if (!this.isInitialized) {
      return {
        status: 'unhealthy',
        details: { error: 'Service not initialized' },
      };
    }

    try {
      const providerHealth = this.providerManager.getHealthStatus();
      const executorStats = this.queryExecutor.getStats();
      const agentStats = this.agentManager.getStats();

      return {
        status: providerHealth.status,
        details: {
          providers: providerHealth.details,
          executor: executorStats,
          agents: agentStats,
          initialized: this.isInitialized,
        },
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        details: { error: (error as Error).message },
      };
    }
  }

  /**
   * Get current provider information
   */
  public getCurrentProvider(): LLMProvider {
    this.ensureInitialized();
    return this.providerManager.getCurrentProvider();
  }

  /**
   * Get service statistics
   */
  public getStats(): {
    providers: Record<string, boolean>;
    currentProvider: LLMProvider;
    activeQueries: number;
    totalQueries: number;
    cachedAgents: number;
  } {
    this.ensureInitialized();

    const providerHealth = this.providerManager.getHealthStatus();
    const executorStats = this.queryExecutor.getStats();
    const agentStats = this.agentManager.getStats();

    return {
      providers: providerHealth.details.providers,
      currentProvider: this.providerManager.getCurrentProvider(),
      activeQueries: executorStats.activeQueries,
      totalQueries: executorStats.totalQueries,
      cachedAgents: agentStats.cachedAgents,
    };
  }

  /**
   * Refresh agents (useful for clearing cached agents)
   */
  public refreshAgents(provider?: LLMProvider, model?: string): void {
    this.ensureInitialized();
    this.agentManager.refreshAgent(provider, model);
  }

  /**
   * Dispose of the service and all sub-services
   */
  public async dispose(): Promise<void> {
    if (!this.isInitialized) {
      return;
    }

    this.logger.info('Disposing LLM service...');

    try {
      // Dispose in reverse dependency order
      await this.agentManager.dispose();
      // Provider manager and query executor don't need explicit disposal

      this.isInitialized = false;
      this.logger.info('LLM service disposed successfully');
    } catch (error) {
      this.logger.error('Error disposing LLM service', error as Error);
      throw error;
    }
  }

  /**
   * Ensure the service is initialized
   */
  private ensureInitialized(): void {
    if (!this.isInitialized) {
      throw new LLMError(
        'LLM service not initialized. Call initialize() first.',
        'SERVICE_NOT_INITIALIZED'
      );
    }
  }
}
