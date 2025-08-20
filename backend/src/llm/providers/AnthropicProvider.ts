import Anthropic from '@anthropic-ai/sdk';
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

export class AnthropicProvider extends BaseLLMProvider {
  name = 'anthropic';
  models = [
    'claude-3-5-sonnet-20241022',
    'claude-3-5-haiku-20241022',
    'claude-3-opus-20240229',
    'claude-3-sonnet-20240229',
    'claude-3-haiku-20240307'
  ];

  private client: Anthropic;
  private defaultModel = 'claude-3-5-haiku-20241022';

  constructor(apiKey: string) {
    super();
    this.client = new Anthropic({ apiKey });
    this.logger = this.logger.child({ provider: 'anthropic' });
  }

  async validateConfig(): Promise<boolean> {
    try {
      // Anthropic doesn't have a models endpoint, so we make a minimal request
      await this.client.messages.create({
        model: this.defaultModel,
        max_tokens: 1,
        messages: [{ role: 'user', content: 'test' }]
      });
      
      this.logger.info('Anthropic configuration validated successfully');
      return true;
    } catch (error: any) {
      // If it's an auth error, config is invalid
      if (error.status === 401) {
        this.logger.error('Anthropic configuration validation failed - invalid API key', error);
        return false;
      }
      
      // Other errors might be fine (rate limits, etc.)
      this.logger.info('Anthropic configuration appears valid');
      return true;
    }
  }

  async getAvailableModels(): Promise<string[]> {
    // Anthropic doesn't provide a models endpoint, return our known models
    return this.models;
  }

  async chat(request: LLMRequest): Promise<LLMResponse> {
    this.validateRequest(request);
    this.logRequest(request);
    
    const startTime = Date.now();

    try {
      return await this.retryManager.executeWithRetry(async () => {
        const { systemMessage, conversationMessages } = this.prepareMessages(request.messages);
        
        const response = await this.client.messages.create({
          model: this.defaultModel,
          max_tokens: request.max_tokens || 1000,
          temperature: request.temperature || 0.1,
          system: systemMessage,
          messages: conversationMessages,
          tools: request.tools ? this.convertTools(request.tools) : undefined,
          tool_choice: this.convertToolChoice(request.tool_choice),
          stream: false
        });

        const llmResponse = this.convertResponse(response);
        this.logResponse(llmResponse, startTime);
        return llmResponse;
      });
    } catch (error) {
      this.handleError(error, 'Anthropic chat completion');
    }
  }

  async *streamChat(request: LLMRequest): AsyncIterable<Partial<LLMResponse>> {
    this.validateRequest(request);
    this.logRequest(request);

    try {
      const { systemMessage, conversationMessages } = this.prepareMessages(request.messages);
      
      const stream = await this.client.messages.create({
        model: this.defaultModel,
        max_tokens: request.max_tokens || 1000,
        temperature: request.temperature || 0.1,
        system: systemMessage,
        messages: conversationMessages,
        tools: request.tools ? this.convertTools(request.tools) : undefined,
        tool_choice: this.convertToolChoice(request.tool_choice),
        stream: true
      });

      for await (const chunk of stream) {
        if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
          yield {
            content: chunk.delta.text,
            finish_reason: 'stop'
          };
        } else if (chunk.type === 'content_block_start' && chunk.content_block.type === 'tool_use') {
          yield {
            content: '',
            tool_calls: [{
              id: chunk.content_block.id,
              type: 'function',
              function: {
                name: chunk.content_block.name,
                arguments: JSON.stringify(chunk.content_block.input)
              }
            }]
          };
        } else if (chunk.type === 'message_stop') {
          yield {
            content: '',
            finish_reason: 'stop'
          };
        }
      }
    } catch (error) {
      this.handleError(error, 'Anthropic streaming chat completion');
    }
  }

  calculateTokens(messages: LLMMessage[]): number {
    // Anthropic uses a similar tokenization approach to OpenAI
    // Approximation: ~3.5 characters per token for Claude
    let totalTokens = 0;
    
    for (const message of messages) {
      totalTokens += Math.ceil(message.content.length / 3.5);
      totalTokens += Math.ceil(message.role.length / 3.5);
      totalTokens += 3; // Base tokens for message formatting
    }
    
    return totalTokens;
  }

  calculateCost(usage: LLMUsage, model: string): number {
    // Anthropic pricing (per 1M tokens) as of 2024
    const pricing: Record<string, { input: number; output: number }> = {
      'claude-3-5-sonnet-20241022': { input: 3.00, output: 15.00 },
      'claude-3-5-haiku-20241022': { input: 1.00, output: 5.00 },
      'claude-3-opus-20240229': { input: 15.00, output: 75.00 },
      'claude-3-sonnet-20240229': { input: 3.00, output: 15.00 },
      'claude-3-haiku-20240307': { input: 0.25, output: 1.25 }
    };

    const modelPricing = pricing[model] || pricing['claude-3-5-haiku-20241022'];
    const inputCost = (usage.prompt_tokens / 1_000_000) * modelPricing.input;
    const outputCost = (usage.completion_tokens / 1_000_000) * modelPricing.output;
    
    return inputCost + outputCost;
  }

  private prepareMessages(messages: LLMMessage[]): {
    systemMessage?: string;
    conversationMessages: Anthropic.MessageParam[];
  } {
    // Anthropic requires system message to be separate
    const systemMessages = messages.filter(m => m.role === 'system');
    const conversationMessages = messages.filter(m => m.role !== 'system');
    
    const systemMessage = systemMessages.map(m => m.content).join('\n\n');
    
    const anthropicMessages: Anthropic.MessageParam[] = [];
    
    for (const msg of conversationMessages) {
      switch (msg.role) {
        case 'user':
          anthropicMessages.push({
            role: 'user',
            content: msg.content
          });
          break;
        case 'assistant':
          if (msg.tool_calls) {
            // Convert tool calls to Anthropic format
            const toolUses = msg.tool_calls.map(tc => ({
              type: 'tool_use' as const,
              id: tc.id,
              name: tc.function.name,
              input: JSON.parse(tc.function.arguments)
            }));
            
            anthropicMessages.push({
              role: 'assistant',
              content: msg.content ? [
                { type: 'text', text: msg.content },
                ...toolUses
              ] : toolUses
            });
          } else {
            anthropicMessages.push({
              role: 'assistant',
              content: msg.content
            });
          }
          break;
        case 'tool':
          // Find the corresponding assistant message and add tool result
          anthropicMessages.push({
            role: 'user',
            content: [{
              type: 'tool_result',
              tool_use_id: msg.tool_call_id!,
              content: msg.content
            }]
          });
          break;
        default:
          throw new LLMError(`Unsupported message role: ${msg.role}`, 'INVALID_MESSAGE_ROLE');
      }
    }
    
    return {
      systemMessage: systemMessage || undefined,
      conversationMessages: anthropicMessages
    };
  }

  private convertTools(tools: ToolDefinition[]): Anthropic.Tool[] {
    return tools.map(tool => ({
      name: tool.function.name,
      description: tool.function.description,
      input_schema: tool.function.parameters
    }));
  }

  private convertToolChoice(toolChoice?: string): any {
    switch (toolChoice) {
      case 'none':
        return { type: 'any' };
      case 'required':
        return { type: 'tool' };
      case 'auto':
      default:
        return { type: 'auto' };
    }
  }

  private convertResponse(response: Anthropic.Message): LLMResponse {
    let content = '';
    let toolCalls: ToolCall[] = [];
    
    for (const block of response.content) {
      if (block.type === 'text') {
        content += block.text;
      } else if (block.type === 'tool_use') {
        toolCalls.push({
          id: block.id,
          type: 'function',
          function: {
            name: block.name,
            arguments: JSON.stringify(block.input)
          }
        });
      }
    }
    
    return {
      content,
      tool_calls: toolCalls.length > 0 ? toolCalls : undefined,
      usage: {
        prompt_tokens: response.usage.input_tokens,
        completion_tokens: response.usage.output_tokens,
        total_tokens: response.usage.input_tokens + response.usage.output_tokens
      },
      finish_reason: response.stop_reason as any || 'stop'
    };
  }
}