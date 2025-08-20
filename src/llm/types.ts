// LLM-specific types and interfaces

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  tool_call_id?: string;
  tool_calls?: ToolCall[];
}

export interface ToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

export interface ToolDefinition {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: {
      type: 'object';
      properties: Record<string, any>;
      required: string[];
    };
  };
}

export interface LLMResponse {
  content: string;
  tool_calls?: ToolCall[];
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  finish_reason: 'stop' | 'length' | 'tool_calls' | 'content_filter';
}

export interface LLMRequest {
  messages: LLMMessage[];
  tools?: ToolDefinition[];
  tool_choice?: 'auto' | 'none' | 'required';
  max_tokens?: number;
  temperature?: number;
  stream?: boolean;
}

export interface LLMUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  cost_usd?: number;
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

export interface ToolExecutionResult {
  success: boolean;
  data?: any;
  error?: string;
  metadata?: Record<string, any>;
}

export interface LLMConfig {
  provider: 'openai' | 'anthropic';
  model: string;
  max_tokens?: number;
  temperature?: number;
  top_p?: number;
  frequency_penalty?: number;
  presence_penalty?: number;
}

export type LLMProvider = 'openai' | 'anthropic';

export interface ILLMProvider {
  name: string;
  models: string[];
  
  chat(request: LLMRequest): Promise<LLMResponse>;
  streamChat(request: LLMRequest): AsyncIterable<Partial<LLMResponse>>;
  
  validateConfig(): Promise<boolean>;
  getAvailableModels(): Promise<string[]>;
  
  calculateTokens(messages: LLMMessage[]): number;
  calculateCost(usage: LLMUsage, model: string): number;
}

export interface ToolFunction {
  (params: any): Promise<ToolExecutionResult>;
}

export interface ToolRegistry {
  register(name: string, definition: ToolDefinition, handler: ToolFunction): void;
  get(name: string): { definition: ToolDefinition; handler: ToolFunction } | undefined;
  list(): ToolDefinition[];
  execute(name: string, params: any): Promise<ToolExecutionResult>;
}