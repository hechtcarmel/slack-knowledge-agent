import OpenAI from 'openai';
import { BaseLLMProvider } from './BaseLLMProvider.js';
import { LLMError } from '@/utils/errors.js';
import { 
  LLMRequest, 
  LLMResponse, 
  LLMMessage,
  ToolDefinition,
  ToolCall,
  LLMUsage
} from '../types.js';

export class OpenAIProvider extends BaseLLMProvider {
  name = 'openai';
  models = [
    'gpt-4o',
    'gpt-4o-mini',
    'gpt-4-turbo',
    'gpt-4',
    'gpt-3.5-turbo'
  ];

  private client: OpenAI;
  private defaultModel = 'gpt-4o-mini';

  constructor(apiKey: string) {
    super();
    this.client = new OpenAI({ apiKey });
    this.logger = this.logger.child({ provider: 'openai' });
  }

  async validateConfig(): Promise<boolean> {
    try {
      await this.client.models.list();
      this.logger.info('OpenAI configuration validated successfully');
      return true;
    } catch (error) {
      this.logger.error('OpenAI configuration validation failed', error as Error);
      return false;
    }
  }

  async getAvailableModels(): Promise<string[]> {
    try {
      const response = await this.client.models.list();
      const availableModels = response.data
        .filter(model => this.models.includes(model.id))
        .map(model => model.id);
      
      return availableModels.length > 0 ? availableModels : this.models;
    } catch (error) {
      this.logger.warn('Failed to fetch available models, using defaults', error as Error);
      return this.models;
    }
  }

  async chat(request: LLMRequest): Promise<LLMResponse> {
    this.validateRequest(request);
    this.logRequest(request);
    
    const startTime = Date.now();

    try {
      return await this.retryManager.executeWithRetry(async () => {
        const completion = await this.client.chat.completions.create({
          model: this.defaultModel,
          messages: this.convertMessages(request.messages),
          tools: request.tools ? this.convertTools(request.tools) : undefined,
          tool_choice: request.tool_choice === 'required' ? 'required' : 
                      request.tool_choice === 'none' ? 'none' : 'auto',
          max_tokens: request.max_tokens || 1000,
          temperature: request.temperature || 0.1,
          stream: false
        });

        const response = this.convertResponse(completion);
        this.logResponse(response, startTime);
        return response;
      });
    } catch (error) {
      this.handleError(error, 'OpenAI chat completion');
    }
  }

  async *streamChat(request: LLMRequest): AsyncIterable<Partial<LLMResponse>> {
    this.validateRequest(request);
    this.logRequest(request);

    try {
      const stream = await this.client.chat.completions.create({
        model: this.defaultModel,
        messages: this.convertMessages(request.messages),
        tools: request.tools ? this.convertTools(request.tools) : undefined,
        tool_choice: request.tool_choice === 'required' ? 'required' : 
                    request.tool_choice === 'none' ? 'none' : 'auto',
        max_tokens: request.max_tokens || 1000,
        temperature: request.temperature || 0.1,
        stream: true
      });

      for await (const chunk of stream) {
        const choice = chunk.choices[0];
        if (choice?.delta) {
          yield {
            content: choice.delta.content || '',
            tool_calls: choice.delta.tool_calls ? 
              this.convertToolCalls(choice.delta.tool_calls) : undefined,
            finish_reason: choice.finish_reason as any
          };
        }
      }
    } catch (error) {
      this.handleError(error, 'OpenAI streaming chat completion');
    }
  }

  calculateTokens(messages: LLMMessage[]): number {
    // More accurate token calculation for OpenAI
    // Based on tiktoken approximation
    let totalTokens = 0;
    
    for (const message of messages) {
      totalTokens += 4; // Base tokens for message formatting
      totalTokens += Math.ceil(message.content.length / 4);
      totalTokens += Math.ceil(message.role.length / 4);
    }
    
    totalTokens += 2; // Base tokens for conversation
    
    return totalTokens;
  }

  calculateCost(usage: LLMUsage, model: string): number {
    // OpenAI pricing (per 1M tokens) as of 2024
    const pricing: Record<string, { input: number; output: number }> = {
      'gpt-4o': { input: 5.00, output: 15.00 },
      'gpt-4o-mini': { input: 0.15, output: 0.60 },
      'gpt-4-turbo': { input: 10.00, output: 30.00 },
      'gpt-4': { input: 30.00, output: 60.00 },
      'gpt-3.5-turbo': { input: 0.50, output: 1.50 }
    };

    const modelPricing = pricing[model] || pricing['gpt-4o-mini'];
    const inputCost = (usage.prompt_tokens / 1_000_000) * modelPricing.input;
    const outputCost = (usage.completion_tokens / 1_000_000) * modelPricing.output;
    
    return inputCost + outputCost;
  }

  private convertMessages(messages: LLMMessage[]): OpenAI.Chat.ChatCompletionMessageParam[] {
    return messages.map(msg => {
      switch (msg.role) {
        case 'system':
          return { role: 'system', content: msg.content };
        case 'user':
          return { role: 'user', content: msg.content };
        case 'assistant':
          return {
            role: 'assistant',
            content: msg.content,
            tool_calls: msg.tool_calls ? msg.tool_calls.map(tc => ({
              id: tc.id,
              type: 'function' as const,
              function: {
                name: tc.function.name,
                arguments: tc.function.arguments
              }
            })) : undefined
          };
        case 'tool':
          return {
            role: 'tool',
            content: msg.content,
            tool_call_id: msg.tool_call_id!
          };
        default:
          throw new LLMError(`Unsupported message role: ${msg.role}`, 'INVALID_MESSAGE_ROLE');
      }
    });
  }

  private convertTools(tools: ToolDefinition[]): OpenAI.Chat.ChatCompletionTool[] {
    return tools.map(tool => ({
      type: 'function',
      function: {
        name: tool.function.name,
        description: tool.function.description,
        parameters: tool.function.parameters
      }
    }));
  }

  private convertResponse(completion: OpenAI.Chat.ChatCompletion): LLMResponse {
    const choice = completion.choices[0];
    const message = choice.message;
    
    return {
      content: message.content || '',
      tool_calls: message.tool_calls ? this.convertToolCalls(message.tool_calls) : undefined,
      usage: {
        prompt_tokens: completion.usage?.prompt_tokens || 0,
        completion_tokens: completion.usage?.completion_tokens || 0,
        total_tokens: completion.usage?.total_tokens || 0
      },
      finish_reason: choice.finish_reason as any
    };
  }

  private convertToolCalls(toolCalls: any[]): ToolCall[] {
    return toolCalls.map(tc => ({
      id: tc.id,
      type: 'function' as const,
      function: {
        name: tc.function.name,
        arguments: tc.function.arguments
      }
    }));
  }
}