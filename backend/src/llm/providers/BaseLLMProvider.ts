import { Logger } from '@/utils/logger.js';
import { LLMError } from '@/utils/errors.js';
import { RetryManager } from '@/utils/retry.js';
import { 
  ILLMProvider, 
  LLMRequest, 
  LLMResponse, 
  LLMMessage, 
  LLMUsage 
} from '../types.js';

export abstract class BaseLLMProvider implements ILLMProvider {
  protected logger: Logger;
  protected retryManager: RetryManager;
  
  abstract name: string;
  abstract models: string[];

  constructor() {
    this.logger = Logger.create('LLMProvider');
    this.retryManager = new RetryManager();
  }

  abstract chat(request: LLMRequest): Promise<LLMResponse>;
  abstract streamChat(request: LLMRequest): AsyncIterable<Partial<LLMResponse>>;
  abstract validateConfig(): Promise<boolean>;
  abstract getAvailableModels(): Promise<string[]>;
  
  calculateTokens(messages: LLMMessage[]): number {
    // Simple approximation: ~4 characters per token
    // This should be overridden by providers with more accurate calculations
    const totalChars = messages.reduce((sum, msg) => {
      return sum + msg.content.length + (msg.role.length * 2);
    }, 0);
    
    return Math.ceil(totalChars / 4);
  }

  calculateCost(_usage: LLMUsage, _model: string): number {
    // Base implementation returns 0 - should be overridden by providers
    // with actual pricing information
    return 0;
  }

  protected validateRequest(request: LLMRequest): void {
    if (!request.messages || request.messages.length === 0) {
      throw new LLMError('Request must contain at least one message', 'INVALID_REQUEST');
    }

    // Validate message roles
    for (const message of request.messages) {
      if (!['system', 'user', 'assistant', 'tool'].includes(message.role)) {
        throw new LLMError(`Invalid message role: ${message.role}`, 'INVALID_MESSAGE_ROLE');
      }
    }

    // Validate token limits
    if (request.max_tokens && request.max_tokens > 4096) {
      this.logger.warn('Large token limit requested', { 
        max_tokens: request.max_tokens,
        model: 'unknown'
      });
    }
  }

  protected handleError(error: any, context: string): never {
    this.logger.error(`${context} failed`, error as Error);
    
    if (error instanceof LLMError) {
      throw error;
    }
    
    // Check for common API errors
    if (error.status === 401) {
      throw new LLMError('Invalid API key', 'AUTHENTICATION_ERROR', error);
    } else if (error.status === 429) {
      throw new LLMError('Rate limit exceeded', 'RATE_LIMIT_ERROR', error);
    } else if (error.status === 400) {
      throw new LLMError('Invalid request', 'INVALID_REQUEST', error);
    } else if (error.status >= 500) {
      throw new LLMError('LLM service unavailable', 'SERVICE_ERROR', error);
    }
    
    throw new LLMError(`${context} failed: ${error.message}`, 'UNKNOWN_ERROR', error);
  }

  protected logRequest(request: LLMRequest): void {
    this.logger.info('LLM request initiated', {
      provider: this.name,
      messageCount: request.messages.length,
      hasTools: !!request.tools,
      toolCount: request.tools?.length || 0,
      maxTokens: request.max_tokens,
      temperature: request.temperature
    });
  }

  protected logResponse(response: LLMResponse, requestStartTime: number): void {
    const responseTime = Date.now() - requestStartTime;
    
    this.logger.info('LLM response received', {
      provider: this.name,
      responseTime,
      contentLength: response.content.length,
      finishReason: response.finish_reason,
      hasToolCalls: !!response.tool_calls,
      toolCallCount: response.tool_calls?.length || 0,
      usage: response.usage
    });
  }

  protected createSystemMessage(content: string): LLMMessage {
    return {
      role: 'system',
      content
    };
  }

  protected createUserMessage(content: string): LLMMessage {
    return {
      role: 'user',
      content
    };
  }

  protected createAssistantMessage(content: string, tool_calls?: any[]): LLMMessage {
    const message: LLMMessage = {
      role: 'assistant',
      content
    };
    
    if (tool_calls) {
      message.tool_calls = tool_calls;
    }
    
    return message;
  }

  protected createToolMessage(content: string, tool_call_id: string): LLMMessage {
    return {
      role: 'tool',
      content,
      tool_call_id
    };
  }
}