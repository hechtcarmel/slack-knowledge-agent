import { Logger } from '@/utils/logger.js';
import { LLMError } from '@/utils/errors.js';
import { SlackService } from '@/services/SlackService.js';

import { OpenAIProvider } from './providers/OpenAIProvider.js';
import { AnthropicProvider } from './providers/AnthropicProvider.js';
import { ToolRegistry } from './tools/ToolRegistry.js';
import { SlackTools } from './tools/SlackTools.js';

import {
  ILLMProvider,
  LLMProvider,
  LLMRequest,
  LLMMessage,
  LLMContext,
  LLMConfig,
  ToolCall,
} from './types.js';

export class LLMManager {
  private logger = Logger.create('LLMManager');
  private providers = new Map<LLMProvider, ILLMProvider>();
  private toolRegistry = new ToolRegistry();
  private currentProvider: LLMProvider = 'openai';

  constructor(
    private openaiApiKey: string,
    private anthropicApiKey: string,
    private slackService: SlackService
  ) {
    this.initializeProviders();
    this.initializeTools();
  }

  async initialize(): Promise<void> {
    this.logger.info('Initializing LLM Manager...');

    // Validate provider configurations
    const validationResults = await Promise.all([
      this.validateProvider('openai'),
      this.validateProvider('anthropic'),
    ]);

    const validProviders = validationResults.filter(result => result.valid);

    if (validProviders.length === 0) {
      throw new LLMError('No valid LLM providers configured', 'NO_PROVIDERS');
    }

    // Set default provider to the first valid one
    this.currentProvider = validProviders[0].provider;

    this.logger.info('LLM Manager initialized successfully', {
      validProviders: validProviders.map(p => p.provider),
      defaultProvider: this.currentProvider,
      toolsRegistered: this.toolRegistry.size(),
    });
  }

  async processQuery(
    context: LLMContext,
    config?: Partial<LLMConfig>
  ): Promise<{
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
  }> {
    const provider = this.getProvider(config?.provider || this.currentProvider);
    const model =
      config?.model ||
      (provider.name === 'openai'
        ? 'gpt-4o-mini'
        : 'claude-3-5-haiku-20241022');

    this.logger.info('Processing query', {
      provider: provider.name,
      model,
      query: context.query.substring(0, 100) + '...',
      channels: context.channelIds.length,
      messages: context.messages.length,
    });

    // Build conversation messages
    const messages = this.buildMessages(context);

    // Get available tools
    const tools = this.toolRegistry.list();

    const request: LLMRequest = {
      messages,
      tools,
      tool_choice: 'auto',
      max_tokens: config?.max_tokens || 1000,
      temperature: config?.temperature || 0.1,
    };

    let response = await provider.chat(request);
    let toolCallCount = 0;
    const conversationMessages = [...messages];

    // Handle tool calls
    while (response.tool_calls && response.tool_calls.length > 0) {
      toolCallCount += response.tool_calls.length;

      // Add assistant message with tool calls
      conversationMessages.push({
        role: 'assistant',
        content: response.content,
        tool_calls: response.tool_calls,
      });

      // Execute tools and add results
      const toolResults = await this.executeTools(response.tool_calls);

      for (const result of toolResults) {
        conversationMessages.push({
          role: 'tool',
          content: JSON.stringify(result.data || { error: result.error }),
          tool_call_id: result.tool_call_id,
        });
      }

      // Continue conversation with tool results
      const followUpRequest: LLMRequest = {
        ...request,
        messages: conversationMessages,
      };

      response = await provider.chat(followUpRequest);
    }

    const cost = provider.calculateCost(response.usage, model);

    this.logger.info('Query processed successfully', {
      provider: provider.name,
      model,
      usage: response.usage,
      cost,
      toolCalls: toolCallCount,
      responseLength: response.content.length,
    });

    return {
      response: response.content,
      usage: {
        ...response.usage,
        cost_usd: cost,
      },
      tool_calls: toolCallCount,
      provider: provider.name,
      model,
    };
  }

  async *streamQuery(
    context: LLMContext,
    config?: Partial<LLMConfig>
  ): AsyncIterable<{
    content?: string;
    done?: boolean;
    usage?: {
      prompt_tokens: number;
      completion_tokens: number;
      total_tokens: number;
    };
  }> {
    const provider = this.getProvider(config?.provider || this.currentProvider);
    const messages = this.buildMessages(context);
    const tools = this.toolRegistry.list();

    const request: LLMRequest = {
      messages,
      tools,
      tool_choice: 'auto',
      max_tokens: config?.max_tokens || 1000,
      temperature: config?.temperature || 0.1,
    };

    try {
      for await (const chunk of provider.streamChat(request)) {
        if (chunk.content) {
          yield { content: chunk.content };
        }

        if (chunk.finish_reason === 'stop') {
          yield chunk.usage
            ? { done: true, usage: chunk.usage }
            : { done: true };
          break;
        }

        // TODO: Handle streaming tool calls
        if (chunk.tool_calls) {
          yield chunk.usage
            ? { done: true, usage: chunk.usage }
            : { done: true };
          break;
        }
      }
    } catch (error) {
      this.logger.error('Streaming query failed', error as Error);
      throw new LLMError('Streaming query failed', 'STREAM_ERROR', error);
    }
  }

  setProvider(provider: LLMProvider): void {
    if (!this.providers.has(provider)) {
      throw new LLMError(
        `Provider '${provider}' not available`,
        'INVALID_PROVIDER'
      );
    }

    this.currentProvider = provider;
    this.logger.info(`Switched to provider: ${provider}`);
  }

  getAvailableProviders(): LLMProvider[] {
    return Array.from(this.providers.keys());
  }

  async getProviderModels(provider?: LLMProvider): Promise<string[]> {
    const providerInstance = this.getProvider(provider || this.currentProvider);
    return await providerInstance.getAvailableModels();
  }

  getHealthStatus(): {
    status: 'healthy' | 'degraded' | 'unhealthy';
    providers: Record<string, boolean>;
    tools: number;
    currentProvider: string;
  } {
    const providerStatus: Record<string, boolean> = {};
    let healthyCount = 0;

    for (const [name, _provider] of this.providers) {
      // This would ideally be cached from the last validation
      providerStatus[name] = true; // Simplified for now
      healthyCount++;
    }

    const status =
      healthyCount === 0
        ? 'unhealthy'
        : healthyCount < this.providers.size
          ? 'degraded'
          : 'healthy';

    return {
      status,
      providers: providerStatus,
      tools: this.toolRegistry.size(),
      currentProvider: this.currentProvider,
    };
  }

  private initializeProviders(): void {
    if (this.openaiApiKey) {
      this.providers.set('openai', new OpenAIProvider(this.openaiApiKey));
    }

    if (this.anthropicApiKey) {
      this.providers.set(
        'anthropic',
        new AnthropicProvider(this.anthropicApiKey)
      );
    }

    this.logger.info('Providers initialized', {
      providers: Array.from(this.providers.keys()),
    });
  }

  private initializeTools(): void {
    const slackTools = new SlackTools(this.slackService);

    // Register Slack tools
    const tools = [
      slackTools.getSearchMessagesTool(),
      slackTools.getChannelHistoryTool(),
      slackTools.getThreadTool(),
      slackTools.getChannelInfoTool(),
      slackTools.getListFilesTool(),
      slackTools.getFileContentTool(),
    ];

    for (const tool of tools) {
      this.toolRegistry.register(
        tool.definition.function.name,
        tool.definition,
        tool.handler
      );
    }

    this.logger.info(`Registered ${tools.length} Slack tools`);
  }

  private async validateProvider(provider: LLMProvider): Promise<{
    provider: LLMProvider;
    valid: boolean;
    error?: string;
  }> {
    try {
      const providerInstance = this.providers.get(provider);
      if (!providerInstance) {
        return { provider, valid: false, error: 'Provider not configured' };
      }

      const isValid = await providerInstance.validateConfig();
      return { provider, valid: isValid };
    } catch (error) {
      return {
        provider,
        valid: false,
        error: (error as Error).message,
      };
    }
  }

  private getProvider(provider: LLMProvider): ILLMProvider {
    const providerInstance = this.providers.get(provider);
    if (!providerInstance) {
      throw new LLMError(
        `Provider '${provider}' not available`,
        'INVALID_PROVIDER'
      );
    }
    return providerInstance;
  }

  private buildMessages(context: LLMContext): LLMMessage[] {
    const messages: LLMMessage[] = [];

    // System message with context about the user's query
    const systemPrompt = this.buildSystemPrompt(context);
    messages.push({
      role: 'system',
      content: systemPrompt,
    });

    // User query
    messages.push({
      role: 'user',
      content: context.query,
    });

    return messages;
  }

  private buildSystemPrompt(context: LLMContext): string {
    const channelNames = context.metadata.channels
      .map(ch => ch.name)
      .join(', ');

    return `You are a Slack Knowledge Agent that helps users find information from their Slack workspace.

You have access to the following Slack channels: ${channelNames}

Available tools:
- search_messages: Search for messages across channels using keywords
- get_channel_history: Get recent messages from a specific channel
- get_thread: Get all messages in a specific thread conversation
- get_channel_info: Get information about a channel
- list_files: List files shared in channels
- get_file_content: Read the content of text files

Guidelines:
1. Use tools to gather relevant information before responding
2. Be specific about which channels you're searching
3. If you find relevant messages, quote them with context (user and timestamp)
4. If you can't find information, suggest alternative search terms or channels
5. Always cite your sources when referencing Slack messages
6. Keep responses concise but informative

Current query context:
- User is asking about: ${context.query}
- Available channels: ${channelNames}
- Total messages in context: ${context.metadata.total_messages}`;
  }

  private async executeTools(toolCalls: ToolCall[]): Promise<
    Array<{
      tool_call_id: string;
      data?: any;
      error?: string;
    }>
  > {
    const results: Array<{ tool_call_id: string; data?: any; error?: string }> =
      [];

    for (const toolCall of toolCalls) {
      try {
        const params = JSON.parse(toolCall.function.arguments);
        const result = await this.toolRegistry.execute(
          toolCall.function.name,
          params
        );

        if (result.success) {
          results.push({
            tool_call_id: toolCall.id,
            data: result.data,
          });
        } else {
          results.push({
            tool_call_id: toolCall.id,
            error: result.error,
          });
        }
      } catch (error) {
        results.push({
          tool_call_id: toolCall.id,
          error: `Failed to execute tool: ${(error as Error).message}`,
        });
      }
    }

    return results;
  }
}
