import { Logger } from '@/utils/logger.js';
import { LLMError } from '@/utils/errors.js';
import { IInitializableService } from '@/core/container/interfaces.js';
import { LLMProviderManager } from './LLMProviderManager.js';
import { AgentManager } from './AgentManager.js';
import { ISlackService } from '@/interfaces/services/ISlackService.js';
import {
  LLMContext,
  LLMConfig,
  QueryResult,
  StreamChunk,
  LLMUsage,
  LLMProvider,
} from '@/interfaces/services/ILLMService.js';

/**
 * Query execution configuration
 */
export interface QueryExecutorConfig {
  maxConcurrentQueries: number;
  queryTimeoutMs: number;
  defaultMaxTokens: number;
  defaultTemperature: number;
}

/**
 * Query Executor Service
 *
 * Handles the execution of LLM queries, including streaming responses,
 * usage tracking, and query coordination with Slack services.
 */
export class QueryExecutor implements IInitializableService {
  private logger = Logger.create('QueryExecutor');
  private activeQueries = new Map<string, Promise<any>>();
  private queryCounter = 0;

  constructor(
    private providerManager: LLMProviderManager,
    private agentManager: AgentManager,
    private slackService: ISlackService,
    private config: QueryExecutorConfig
  ) {}

  /**
   * Initialize the query executor
   */
  public async initialize(): Promise<void> {
    this.logger.info('QueryExecutor initialized successfully');
  }

  /**
   * Execute a query with the LLM
   */
  public async executeQuery(
    context: LLMContext,
    config: Partial<LLMConfig> = {}
  ): Promise<QueryResult> {
    const queryId = this.generateQueryId();
    const startTime = Date.now();

    // Check concurrent query limit
    if (this.activeQueries.size >= this.config.maxConcurrentQueries) {
      throw new LLMError(
        'Maximum concurrent queries exceeded',
        'QUERY_LIMIT_EXCEEDED'
      );
    }

    try {
      this.logger.info('Starting query execution', {
        queryId,
        query: context.query.substring(0, 100) + '...',
        provider: config.provider,
        channels: context.channelIds.length,
      });

      // Create query execution promise
      const queryPromise = this.executeQueryInternal(context, config, queryId);

      // Add to active queries
      this.activeQueries.set(queryId, queryPromise);

      // Execute with timeout
      const result = await Promise.race([
        queryPromise,
        this.createTimeoutPromise(queryId),
      ]);

      const executionTime = Date.now() - startTime;

      this.logger.info('Query execution completed', {
        queryId,
        executionTime,
        provider: result.provider,
        model: result.model,
        usage: result.usage,
      });

      return result;
    } catch (error) {
      this.logger.error('Query execution failed', error as Error, {
        queryId,
        query: context.query.substring(0, 100) + '...',
      });
      throw error;
    } finally {
      // Clean up active query
      this.activeQueries.delete(queryId);
    }
  }

  /**
   * Stream a query response
   */
  public async *streamQuery(
    context: LLMContext,
    config: Partial<LLMConfig> = {}
  ): AsyncIterable<StreamChunk> {
    const queryId = this.generateQueryId();

    // Check concurrent query limit
    if (this.activeQueries.size >= this.config.maxConcurrentQueries) {
      throw new LLMError(
        'Maximum concurrent queries exceeded',
        'QUERY_LIMIT_EXCEEDED'
      );
    }

    try {
      this.logger.info('Starting streaming query', {
        queryId,
        query: context.query.substring(0, 100) + '...',
        provider: config.provider,
        channels: context.channelIds.length,
      });

      // Create streaming iterator
      const streamIterator = this.streamQueryInternal(context, config, queryId);

      // Add a promise to track completion
      const trackingPromise = (async () => {
        for await (const _chunk of streamIterator) {
          // Just consume to track completion
        }
      })();
      
      this.activeQueries.set(queryId, trackingPromise);

      yield* this.streamQueryInternal(context, config, queryId);
    } catch (error) {
      this.logger.error('Streaming query failed', error as Error, {
        queryId,
        query: context.query.substring(0, 100) + '...',
      });
      throw error;
    } finally {
      // Clean up active query
      this.activeQueries.delete(queryId);
    }
  }

  /**
   * Get query execution statistics
   */
  public getStats(): {
    activeQueries: number;
    totalQueries: number;
    maxConcurrentQueries: number;
  } {
    return {
      activeQueries: this.activeQueries.size,
      totalQueries: this.queryCounter,
      maxConcurrentQueries: this.config.maxConcurrentQueries,
    };
  }

  /**
   * Internal query execution logic
   */
  private async executeQueryInternal(
    context: LLMContext,
    config: Partial<LLMConfig>,
    _queryId: string
  ): Promise<QueryResult> {
    // Determine provider and model
    const provider =
      config.provider || this.providerManager.getCurrentProvider();
    const model =
      config.model || this.providerManager.getDefaultModelForProvider(provider);

    // Ensure bot has access to channels
    await this.ensureChannelAccess(context.channelIds);

    // Get agent for the provider
    const agent = await this.agentManager.getAgent(provider, model);

    // Build agent context
    const agentContext = this.buildAgentContext(context);

    // Execute the agent
    const result = await agent.query(context.query, agentContext);

    // Extract and calculate usage information
    const usage = this.extractUsageInfo(result, context, provider, model);

    return {
      response: result.output,
      usage,
      toolCalls: result.intermediateSteps?.length || 0,
      provider,
      model,
      intermediateSteps: result.intermediateSteps,
    };
  }

  /**
   * Internal streaming query logic
   */
  private async *streamQueryInternal(
    context: LLMContext,
    config: Partial<LLMConfig>,
    _queryId: string
  ): AsyncIterable<StreamChunk> {
    // Determine provider and model
    const provider =
      config.provider || this.providerManager.getCurrentProvider();
    const model =
      config.model || this.providerManager.getDefaultModelForProvider(provider);

    // Ensure bot has access to channels
    await this.ensureChannelAccess(context.channelIds);

    // Get agent for the provider
    const agent = await this.agentManager.getAgent(provider, model);

    // Build agent context
    const agentContext = this.buildAgentContext(context);

    // Stream the agent response
    for await (const chunk of agent.streamQuery(context.query, agentContext)) {
      // Process different event types from LangChain streaming
      if (chunk.event === 'on_chat_model_stream' && chunk.data?.chunk) {
        yield { content: chunk.data.chunk.content || '' };
      } else if (chunk.event === 'on_llm_stream' && chunk.data?.chunk) {
        yield { content: chunk.data.chunk.text || '' };
      } else if (chunk.event === 'on_agent_finish') {
        const usage = this.extractUsageInfo(
          { output: chunk.data?.output },
          context,
          provider,
          model
        );
        yield {
          done: true,
          usage: {
            promptTokens: usage.promptTokens,
            completionTokens: usage.completionTokens,
            totalTokens: usage.totalTokens,
          },
        };
      }
    }
  }

  /**
   * Ensure bot has access to required channels
   */
  private async ensureChannelAccess(channelIds: string[]): Promise<void> {
    if (channelIds.length === 0) return;

    this.logger.debug('Ensuring bot access to channels', {
      channels: channelIds,
      channelCount: channelIds.length,
    });

    const accessResult =
      await this.slackService.ensureChannelAccess(channelIds);

    if (accessResult.joined.length > 0) {
      this.logger.info('Successfully joined channels', {
        joined: accessResult.joined,
        joinedCount: accessResult.joined.length,
      });
    }

    if (accessResult.failed.length > 0) {
      this.logger.warn('Failed to join some channels', {
        failed: accessResult.failed,
        failedCount: accessResult.failed.length,
      });
    }
  }

  /**
   * Build agent context from LLM context
   */
  private buildAgentContext(context: LLMContext): Record<string, any> {
    // Build structured channel information with names, descriptions, and IDs
    const channelsData = context.metadata.channels.map(ch => ({
      id: ch.id,
      name: ch.name,
      purpose: ch.purpose || null,
      topic: ch.topic || null,
    }));

    // Get available tools from the agent manager
    const availableTools = this.getAvailableTools();

    return {
      channels: channelsData,
      totalMessages: context.metadata.total_messages,
      query: context.query,
      availableTools,
    };
  }

  /**
   * Get list of available tool names
   */
  private getAvailableTools(): string[] {
    // This is a simplified list of tool names
    // In a more sophisticated setup, this could be retrieved from the AgentManager
    return [
      'get_channel_info',
      'get_channel_history',
      'search_messages',
      'get_thread',
      'list_files',
      'get_file_content',
    ];
  }

  /**
   * Extract usage information from agent result
   */
  private extractUsageInfo(
    result: any,
    context: LLMContext,
    provider: LLMProvider,
    model: string
  ): LLMUsage {
    if (result.usage) {
      // Use actual usage if provided
      const cost = this.providerManager.calculateCost(
        {
          promptTokens: result.usage.prompt_tokens || 0,
          completionTokens: result.usage.completion_tokens || 0,
        },
        model,
        provider
      );

      return {
        promptTokens: result.usage.prompt_tokens || 0,
        completionTokens: result.usage.completion_tokens || 0,
        totalTokens: result.usage.total_tokens || 0,
        costUsd: cost,
      };
    }

    // Estimate usage
    const estimatedPromptTokens = Math.ceil(context.query.length / 4) + 200; // Include system prompt
    const estimatedCompletionTokens = Math.ceil(
      (result.output?.length || 0) / 4
    );
    const totalTokens = estimatedPromptTokens + estimatedCompletionTokens;

    const cost = this.providerManager.calculateCost(
      {
        promptTokens: estimatedPromptTokens,
        completionTokens: estimatedCompletionTokens,
      },
      model,
      provider
    );

    return {
      promptTokens: estimatedPromptTokens,
      completionTokens: estimatedCompletionTokens,
      totalTokens,
      costUsd: cost,
    };
  }

  /**
   * Generate unique query ID
   */
  private generateQueryId(): string {
    this.queryCounter++;
    return `query_${Date.now()}_${this.queryCounter}`;
  }

  /**
   * Create timeout promise for query execution
   */
  private createTimeoutPromise(queryId: string): Promise<never> {
    return new Promise((_, reject) => {
      setTimeout(() => {
        reject(
          new LLMError(
            `Query timeout after ${this.config.queryTimeoutMs}ms`,
            'QUERY_TIMEOUT',
            { queryId }
          )
        );
      }, this.config.queryTimeoutMs);
    });
  }
}
