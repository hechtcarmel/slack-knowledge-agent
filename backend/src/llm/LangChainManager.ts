import { Logger } from '@/utils/logger.js';
import { LLMError } from '@/utils/errors.js';

import { SlackService } from '@/services/SlackService.js';
import { SlackKnowledgeAgent } from './agents/SlackKnowledgeAgent.js';
import { SlackOpenAILLM } from './models/OpenAILLM.js';
import { SlackAnthropicLLM } from './models/AnthropicLLM.js';
import { createSlackTools } from './tools/index.js';
import { SlackConversationMemory } from './memory/SlackMemory.js';

export type LLMProvider = 'openai' | 'anthropic';

export interface QueryResult {
  response: string;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
    cost_usd?: number;
  };
  tool_calls?: number;
  provider: string;
  model: string;
  intermediate_steps?: any[];
}

export interface StreamChunk {
  content?: string;
  done?: boolean;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
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
  private tools: any[];
  private memory?: SlackConversationMemory;

  constructor(
    private openaiApiKey: string,
    private anthropicApiKey: string | undefined,
    private slackService: SlackService
  ) {
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

      // Set default provider to the first valid one
      this.currentProvider = validProviders[0];

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

    this.logger.info('Processing query with LangChain agent', {
      provider,
      query: context.query.substring(0, 100) + '...',
      channels: context.channelIds.length,
      model: config?.model || this.getDefaultModel(provider),
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

      // Execute the agent
      const startTime = Date.now();
      const result = await agent.query(context.query, agentContext);
      const executionTime = Date.now() - startTime;

      // Extract usage information (estimated since LangChain doesn't always provide it)
      const usage = this.extractUsageInfo(result, context, provider);

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
        tool_calls: result.intermediateSteps?.length || 0,
        provider,
        model: config?.model || this.getDefaultModel(provider),
        intermediate_steps: result.intermediateSteps,
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

      this.logger.info('Starting streaming query with LangChain agent', {
        provider,
        query: context.query.substring(0, 100) + '...',
        channels: context.channelIds.length,
      });

      for await (const chunk of agent.streamQuery(
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
            provider
          );
          yield {
            done: true,
            usage: {
              prompt_tokens: usage.prompt_tokens,
              completion_tokens: usage.completion_tokens,
              total_tokens: usage.total_tokens,
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
    if (this.openaiApiKey && this.openaiApiKey.trim().startsWith('sk-')) {
      this.models.set('openai', new SlackOpenAILLM(this.openaiApiKey));
    }

    if (
      this.anthropicApiKey &&
      this.anthropicApiKey.trim().startsWith('sk-ant-')
    ) {
      this.models.set('anthropic', new SlackAnthropicLLM(this.anthropicApiKey));
    }

    this.logger.info('Models initialized', {
      providers: Array.from(this.models.keys()),
    });
  }

  private async initializeAgents(): Promise<void> {
    for (const [provider, model] of this.models) {
      const agent = new SlackKnowledgeAgent(model, this.tools, {
        maxIterations: 10,
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
    return {
      channelNames: context.metadata.channels.map(ch => ch.name).join(', '),
      totalMessages: context.metadata.total_messages,
      // Pass tool names for the ReAct prompt template
      tool_names: this.tools.map(tool => tool.name).join(', '),
    };
  }

  private extractUsageInfo(
    result: any,
    context: LLMContext,
    provider: string
  ): any {
    // Since LangChain doesn't always provide usage info, we'll estimate
    const model = this.models.get(provider as LLMProvider);

    if (result.usage) {
      // Use actual usage if provided
      const cost = model?.calculateCost(
        {
          promptTokens: result.usage.prompt_tokens || 0,
          completionTokens: result.usage.completion_tokens || 0,
        },
        this.getDefaultModel(provider as LLMProvider)
      );

      return {
        prompt_tokens: result.usage.prompt_tokens || 0,
        completion_tokens: result.usage.completion_tokens || 0,
        total_tokens: result.usage.total_tokens || 0,
        cost_usd: cost,
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
      this.getDefaultModel(provider as LLMProvider)
    );

    return {
      prompt_tokens: estimatedPromptTokens,
      completion_tokens: estimatedCompletionTokens,
      total_tokens: totalTokens,
      cost_usd: cost,
    };
  }

  private getDefaultModel(provider: LLMProvider): string {
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
