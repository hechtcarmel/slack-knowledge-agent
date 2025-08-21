import { Logger } from '@/utils/logger.js';
import { LLMError } from '@/utils/errors.js';
import {
  QueryResult as IQueryResult,
  StreamChunk as IStreamChunk,
  LLMProvider as ILLMProvider,
} from '@/interfaces/services/ILLMService.js';

import { SlackService } from '@/services/SlackService.js';
import { SlackKnowledgeAgent } from './agents/SlackKnowledgeAgent.js';
import { SlackOpenAILLM } from './models/OpenAILLM.js';
import { SlackAnthropicLLM } from './models/AnthropicLLM.js';
import { createSlackTools } from './tools/index.js';
import { SlackConversationMemory } from './memory/SlackMemory.js';

export type LLMProvider = ILLMProvider;

export interface QueryResult extends IQueryResult {
  // This now extends the interface QueryResult from ILLMService
}

export interface StreamChunk extends IStreamChunk {
  // This now extends the interface StreamChunk from ILLMService
}

export interface LLMContext {
  query: string;
  channelIds: string[];
  messages: Array<{
    channel: string;
    user: string;
    text: string;
    timestamp: string;
    thread_ts?: string;
  }>;
  metadata: {
    total_messages: number;
    channels: Array<{
      id: string;
      name: string;
    }>;
    search_time_ms: number;
    token_count: number;
  };
}

export interface LLMConfig {
  provider?: LLMProvider;
  model?: string;
  max_tokens?: number;
  temperature?: number;
}

export class LangChainManager {
  private logger = Logger.create('LangChainManager');
  private agents = new Map<LLMProvider, SlackKnowledgeAgent>();
  private models = new Map<LLMProvider, SlackOpenAILLM | SlackAnthropicLLM>();
  private currentProvider: LLMProvider = 'openai';
  private defaultProvider?: LLMProvider;
  private defaultModel?: string;
  private tools: any[];
  private memory?: SlackConversationMemory;

  constructor(
    private openaiApiKey: string,
    private anthropicApiKey: string | undefined,
    private slackService: SlackService,
    defaultProvider?: LLMProvider,
    defaultModel?: string
  ) {
    this.defaultProvider = defaultProvider;
    this.defaultModel = defaultModel;
    this.initializeModels();
    this.tools = createSlackTools(this.slackService);
  }

  async initialize(): Promise<void> {
    this.logger.info('Initializing LangChain Manager...');

    try {
      // Initialize memory
      this.memory = new SlackConversationMemory({
        maxTokens: 2000,
        maxMessages: 20,
        sessionId: 'slack-knowledge-session',
      });

      // Initialize agents for each provider
      await this.initializeAgents();

      // Validate provider configurations
      const validProviders = await this.validateProviders();

      if (validProviders.length === 0) {
        throw new LLMError('No valid LLM providers configured', 'NO_PROVIDERS');
      }

      // Set default provider preference from config if valid; otherwise first valid
      if (
        this.defaultProvider &&
        validProviders.includes(this.defaultProvider)
      ) {
        this.currentProvider = this.defaultProvider;
      } else {
        this.currentProvider = validProviders[0];
      }

      this.logger.info('LangChain Manager initialized successfully', {
        validProviders,
        defaultProvider: this.currentProvider,
        toolsCount: this.tools.length,
        hasMemory: !!this.memory,
      });
    } catch (error) {
      this.logger.error(
        'Failed to initialize LangChain Manager',
        error as Error
      );
      throw error;
    }
  }

  async processQuery(
    context: LLMContext,
    config?: Partial<LLMConfig>
  ): Promise<QueryResult> {
    const provider = config?.provider || this.currentProvider;
    const agent = this.agents.get(provider);
    const model = this.models.get(provider);

    if (!agent || !model) {
      throw new LLMError(
        `Agent/Model for provider '${provider}' not available`,
        'INVALID_PROVIDER'
      );
    }

    const effectiveModel = config?.model || this.getDefaultModel(provider);

    this.logger.info('Processing query with LangChain agent', {
      provider,
      query: context.query.substring(0, 100) + '...',
      channels: context.channelIds.length,
      model: effectiveModel,
    });

    try {
      // Proactively join channels mentioned in the query before processing
      if (context.channelIds.length > 0) {
        this.logger.info('Ensuring bot access to mentioned channels', {
          channels: context.channelIds,
          channelCount: context.channelIds.length,
        });

        const accessResult = await this.slackService.ensureChannelAccess(
          context.channelIds
        );

        if (accessResult.joined.length > 0) {
          this.logger.info('Successfully joined channels proactively', {
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

      // Build context for the agent
      const agentContext = this.buildAgentContext(context);

      // Select agent to use (respect per-request model override)
      let agentToUse: SlackKnowledgeAgent = agent;

      if (config?.model) {
        // Create a temporary agent bound to the requested model
        let tempModel: SlackOpenAILLM | SlackAnthropicLLM;
        if (provider === 'openai') {
          tempModel = new SlackOpenAILLM(this.openaiApiKey, {
            model: effectiveModel,
          });
        } else {
          tempModel = new SlackAnthropicLLM(this.anthropicApiKey as string, {
            model: effectiveModel,
          });
        }

        const tempAgent = new SlackKnowledgeAgent(tempModel, this.tools, {
          maxIterations: 15,
          verbose: process.env.NODE_ENV === 'development',
          returnIntermediateSteps: true,
          handleParsingErrors: true,
          memory: this.memory,
        });
        await tempAgent.initialize();
        agentToUse = tempAgent;
      }

      // Execute the agent
      const startTime = Date.now();
      const result = await agentToUse.query(context.query, agentContext);
      const executionTime = Date.now() - startTime;

      // Extract usage information (estimated since LangChain doesn't always provide it)
      const usage = this.extractUsageInfo(
        result,
        context,
        provider,
        effectiveModel
      );

      this.logger.info('Query processed successfully', {
        provider,
        outputLength: result.output.length,
        intermediateSteps: result.intermediateSteps?.length,
        executionTime,
        usage,
      });

      return {
        response: result.output,
        usage,
        toolCalls: result.intermediateSteps?.length || 0,
        provider,
        model: effectiveModel,
        intermediateSteps: result.intermediateSteps,
      };
    } catch (error) {
      this.logger.error('Query processing failed', error as Error, {
        provider,
        query: context.query.substring(0, 100) + '...',
      });
      throw new LLMError('Query processing failed', 'PROCESSING_ERROR', error);
    }
  }

  async *streamQuery(
    context: LLMContext,
    config?: Partial<LLMConfig>
  ): AsyncIterable<StreamChunk> {
    const provider = config?.provider || this.currentProvider;
    const agent = this.agents.get(provider);

    if (!agent) {
      throw new LLMError(
        `Agent for provider '${provider}' not available`,
        'INVALID_PROVIDER'
      );
    }

    try {
      const effectiveModel = config?.model || this.getDefaultModel(provider);

      // Proactively join channels mentioned in the query before processing
      if (context.channelIds.length > 0) {
        this.logger.info(
          'Ensuring bot access to mentioned channels for streaming',
          {
            channels: context.channelIds,
            channelCount: context.channelIds.length,
          }
        );

        const accessResult = await this.slackService.ensureChannelAccess(
          context.channelIds
        );

        if (accessResult.joined.length > 0) {
          this.logger.info(
            'Successfully joined channels proactively for streaming',
            {
              joined: accessResult.joined,
              joinedCount: accessResult.joined.length,
            }
          );
        }

        if (accessResult.failed.length > 0) {
          this.logger.warn('Failed to join some channels for streaming', {
            failed: accessResult.failed,
            failedCount: accessResult.failed.length,
          });
        }
      }

      const agentContext = this.buildAgentContext(context);

      // Select agent to use (respect per-request model override)
      let agentToUse: SlackKnowledgeAgent = agent;
      if (config?.model) {
        let tempModel: SlackOpenAILLM | SlackAnthropicLLM;
        if (provider === 'openai') {
          tempModel = new SlackOpenAILLM(this.openaiApiKey, {
            model: effectiveModel,
          });
        } else {
          tempModel = new SlackAnthropicLLM(this.anthropicApiKey as string, {
            model: effectiveModel,
          });
        }

        const tempAgent = new SlackKnowledgeAgent(tempModel, this.tools, {
          maxIterations: 15,
          verbose: process.env.NODE_ENV === 'development',
          returnIntermediateSteps: true,
          handleParsingErrors: true,
          memory: this.memory,
        });
        await tempAgent.initialize();
        agentToUse = tempAgent;
      }

      this.logger.info('Starting streaming query with LangChain agent', {
        provider,
        query: context.query.substring(0, 100) + '...',
        channels: context.channelIds.length,
      });

      for await (const chunk of agentToUse.streamQuery(
        context.query,
        agentContext
      )) {
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
            effectiveModel
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
    } catch (error) {
      this.logger.error('Streaming query failed', error as Error, {
        provider,
        query: context.query.substring(0, 100) + '...',
      });
      throw new LLMError('Streaming query failed', 'STREAM_ERROR', error);
    }
  }

  setProvider(provider: LLMProvider): void {
    if (!this.agents.has(provider)) {
      throw new LLMError(
        `Provider '${provider}' not available`,
        'INVALID_PROVIDER'
      );
    }

    this.currentProvider = provider;
    this.logger.info(`Switched to provider: ${provider}`);
  }

  getAvailableProviders(): LLMProvider[] {
    return Array.from(this.agents.keys());
  }

  async getProviderModels(provider?: LLMProvider): Promise<string[]> {
    const targetProvider = provider || this.currentProvider;
    const model = this.models.get(targetProvider);

    if (!model) {
      throw new LLMError(
        `Provider '${targetProvider}' not available`,
        'INVALID_PROVIDER'
      );
    }

    return model.getAvailableModels();
  }

  getHealthStatus(): {
    status: 'healthy' | 'degraded' | 'unhealthy';
    providers: Record<string, boolean>;
    tools: number;
    currentProvider: string;
    memory: {
      enabled: boolean;
      messageCount: number;
    };
  } {
    const providerStatus: Record<string, boolean> = {};
    let healthyCount = 0;

    for (const [name] of this.agents) {
      // This would ideally be cached from the last validation
      providerStatus[name] = true; // Simplified for now
      healthyCount++;
    }

    const status =
      healthyCount === 0
        ? 'unhealthy'
        : healthyCount < this.agents.size
          ? 'degraded'
          : 'healthy';

    return {
      status,
      providers: providerStatus,
      tools: this.tools.length,
      currentProvider: this.currentProvider,
      memory: {
        enabled: !!this.memory,
        messageCount: 0, // Would need to be async to get actual count
      },
    };
  }

  /**
   * Clear conversation memory
   */
  async clearMemory(): Promise<void> {
    if (this.memory) {
      await this.memory.clear();
      this.logger.info('Memory cleared');
    }
  }

  private initializeModels(): void {
    // Helper to decide if the configured model is compatible with a provider
    const isModelCompatible = (
      provider: LLMProvider,
      model?: string
    ): boolean => {
      if (!model) return false;
      return provider === 'openai'
        ? model.toLowerCase().startsWith('gpt')
        : model.toLowerCase().startsWith('claude');
    };

    if (this.openaiApiKey && this.openaiApiKey.trim().startsWith('sk-')) {
      const modelOption = isModelCompatible('openai', this.defaultModel)
        ? { model: this.defaultModel }
        : undefined;
      this.models.set(
        'openai',
        new SlackOpenAILLM(this.openaiApiKey, modelOption)
      );
    }

    if (
      this.anthropicApiKey &&
      this.anthropicApiKey.trim().startsWith('sk-ant-')
    ) {
      const modelOption = isModelCompatible('anthropic', this.defaultModel)
        ? { model: this.defaultModel }
        : undefined;
      this.models.set(
        'anthropic',
        new SlackAnthropicLLM(this.anthropicApiKey, modelOption)
      );
    }

    this.logger.info('Models initialized', {
      providers: Array.from(this.models.keys()),
    });
  }

  private async initializeAgents(): Promise<void> {
    for (const [provider, model] of this.models) {
      const agent = new SlackKnowledgeAgent(model, this.tools, {
        maxIterations: 15,
        verbose: process.env.NODE_ENV === 'development',
        returnIntermediateSteps: true,
        handleParsingErrors: true,
        memory: this.memory,
      });

      await agent.initialize();
      this.agents.set(provider as LLMProvider, agent);

      this.logger.info(`Agent initialized for provider: ${provider}`);
    }
  }

  private buildAgentContext(context: LLMContext): Record<string, any> {
    // Build enhanced channel information with relevance scoring
    const channelsData = context.metadata.channels.map(ch => ({
      id: ch.id,
      name: ch.name,
      purpose: (ch as any).purpose || 'No purpose set',
      topic: (ch as any).topic || 'No topic set',
      memberCount: (ch as any).num_members || 'Unknown',
      relevanceScore: this.calculateChannelRelevance(ch, context.query),
      lastActivity: (ch as any).latest?.ts || 'Unknown',
      channelType: (ch as any).is_private ? 'Private' : 'Public',
    }));

    // Sort channels by relevance score (highest first)
    channelsData.sort(
      (a, b) => (b.relevanceScore || 0) - (a.relevanceScore || 0)
    );

    return {
      channels: this.formatChannelsForPrompt(channelsData),
      query: context.query,
      totalMessages: context.metadata.total_messages,
      searchContext: {
        timeframe: this.suggestTimeframe(context.query),
        suggestedKeywords: this.extractKeywords(context.query),
        relevantChannels: channelsData.slice(0, 5), // Top 5 most relevant
      },
      availableTools: this.getToolDescriptionsForPrompt(),
    };
  }

  private calculateChannelRelevance(channel: any, query: string): number {
    let score = 0;
    const queryWords = query.toLowerCase().split(/\s+/);

    // Check channel name relevance
    const channelName = (channel.name || '').toLowerCase();
    queryWords.forEach(word => {
      if (channelName.includes(word)) score += 2;
    });

    // Check channel purpose relevance
    const purpose = ((channel as any).purpose || '').toLowerCase();
    queryWords.forEach(word => {
      if (purpose.includes(word)) score += 1;
    });

    // Check channel topic relevance
    const topic = ((channel as any).topic || '').toLowerCase();
    queryWords.forEach(word => {
      if (topic.includes(word)) score += 1;
    });

    // Boost score for general channels that might contain diverse content
    if (channelName.includes('general') || channelName.includes('announce')) {
      score += 0.5;
    }

    return score;
  }

  private formatChannelsForPrompt(channels: any[]): string {
    return channels
      .map(
        ch =>
          `• #${ch.name} (${ch.id}) - ${ch.purpose}\n  Members: ${ch.memberCount}, Type: ${ch.channelType}, Relevance: ${ch.relevanceScore?.toFixed(2) || 'N/A'}`
      )
      .join('\n');
  }

  private suggestTimeframe(query: string): string {
    const queryLower = query.toLowerCase();

    if (
      queryLower.includes('recent') ||
      queryLower.includes('latest') ||
      queryLower.includes('today')
    ) {
      return 'last 7 days';
    } else if (
      queryLower.includes('last month') ||
      queryLower.includes('monthly')
    ) {
      return 'last 30 days';
    } else if (
      queryLower.includes('history') ||
      queryLower.includes('evolution') ||
      queryLower.includes('over time')
    ) {
      return 'last 365 days';
    } else if (
      queryLower.includes('quarter') ||
      queryLower.includes('Q1') ||
      queryLower.includes('Q2')
    ) {
      return 'last 90 days';
    }

    return 'last 30 days'; // Default timeframe
  }

  private extractKeywords(query: string): string[] {
    // Simple keyword extraction - remove common words
    const stopWords = new Set([
      'the',
      'a',
      'an',
      'and',
      'or',
      'but',
      'in',
      'on',
      'at',
      'to',
      'for',
      'of',
      'with',
      'by',
      'how',
      'what',
      'when',
      'where',
      'who',
      'why',
    ]);

    return query
      .toLowerCase()
      .split(/\s+/)
      .filter(word => word.length > 2 && !stopWords.has(word))
      .slice(0, 5); // Limit to 5 keywords
  }

  private getToolDescriptionsForPrompt(): string[] {
    return [
      'search_messages: Primary discovery tool with pagination support',
      'search_more_messages: Continue searching for additional relevant content',
      'analyze_search_completeness: Evaluate if search coverage is sufficient',
      'get_channel_history: Context building for specific timeframes',
      'get_thread: Complete conversation understanding',
      'get_channel_info: Channel purpose and context',
      'list_files: Document discovery',
      'get_file_content: Direct document access',
    ];
  }

  private extractUsageInfo(
    result: any,
    context: LLMContext,
    provider: string,
    modelOverride?: string
  ): any {
    // Since LangChain doesn't always provide usage info, we'll estimate
    const model = this.models.get(provider as LLMProvider);
    const billingModel =
      modelOverride || this.getDefaultModel(provider as LLMProvider);

    if (result.usage) {
      // Use actual usage if provided
      const cost = model?.calculateCost(
        {
          promptTokens: result.usage.prompt_tokens || 0,
          completionTokens: result.usage.completion_tokens || 0,
        },
        billingModel
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

    const cost = model?.calculateCost(
      {
        promptTokens: estimatedPromptTokens,
        completionTokens: estimatedCompletionTokens,
      },
      billingModel
    );

    return {
      promptTokens: estimatedPromptTokens,
      completionTokens: estimatedCompletionTokens,
      totalTokens: totalTokens,
      costUsd: cost,
    };
  }

  private getDefaultModel(provider: LLMProvider): string {
    // Prefer configured model when compatible; otherwise provider-specific default
    const configured = this.defaultModel;
    if (configured) {
      const isOpenAI = provider === 'openai';
      const ok = isOpenAI
        ? configured.toLowerCase().startsWith('gpt')
        : configured.toLowerCase().startsWith('claude');
      if (ok) return configured;
    }
    return provider === 'openai' ? 'gpt-4o-mini' : 'claude-3-5-haiku-20241022';
  }

  private async validateProviders(): Promise<LLMProvider[]> {
    const validProviders: LLMProvider[] = [];

    for (const [provider, model] of this.models) {
      try {
        this.logger.info(`Validating provider: ${provider}`);
        const isValid = await model.validateConfig();
        if (isValid) {
          validProviders.push(provider as LLMProvider);
          this.logger.info(`Provider ${provider} validated successfully`);
        } else {
          this.logger.warn(`Provider ${provider} validation returned false`);
        }
      } catch (error) {
        this.logger.error(
          `Provider ${provider} validation failed`,
          error as Error
        );
      }
    }

    this.logger.info(
      `Validation completed. Valid providers: ${validProviders.join(', ')}`
    );
    return validProviders;
  }
}
