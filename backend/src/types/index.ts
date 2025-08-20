// Core types for the Slack Knowledge Agent

export interface Message {
  user: string;
  text: string;
  ts: string;
  channel: string;
  thread_ts?: string;
}

export interface Thread {
  messages: Message[];
  channel: string;
  thread_ts: string;
}

export interface Channel {
  id: string;
  name: string;
  purpose?: {
    value: string;
  };
  topic?: {
    value: string;
  };
  num_members?: number;
}

export interface File {
  id: string;
  name: string;
  filetype: string;
  size: number;
  url_private: string;
  channels: string[];
}

export interface FileContent {
  id: string;
  content: string;
  filetype: string;
}

export interface ChannelConfig {
  channels: Array<{
    id: string;
    name: string;
    description: string;
  }>;
}

export interface QueryRequest {
  question: string;
  channels: string[];
  options?: {
    maxResults?: number;
    llmProvider?: 'openai' | 'anthropic';
  };
}

export interface QueryResponse {
  answer: string;
  metadata: {
    tokensUsed: number;
    queryTime: number;
    messagesAnalyzed: number;
  };
}

export interface SearchParams {
  query: string;
  channels: string[];
  limit: number;
  time_range?: {
    start: Date;
    end: Date;
  };
}

export interface FileListParams {
  channels: string[];
  types?: string[];
  limit: number;
}

export interface LLMContext {
  query: string;
  channels: Channel[];
  messages: string[];
  metadata: Record<string, any>;
}

export interface LLMResponse {
  content: string;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export interface Tool {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, any>;
    required: string[];
  };
  execute: (params: any) => Promise<any>;
}

export type LLMProvider = 'openai' | 'anthropic';

export interface CompletionRequest {
  messages: Array<{
    role: 'system' | 'user' | 'assistant' | 'tool';
    content: string;
    tool_call_id?: string;
  }>;
  tools: Tool[];
  tool_choice?: 'auto' | 'none';
  max_tokens?: number;
}

export interface CompletionResponse {
  content: string;
  tool_calls?: Array<{
    id: string;
    function: {
      name: string;
      arguments: string;
    };
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
  };
}

export interface RetryOptions {
  maxAttempts?: number;
  backoffMs?: number;
  backoffMultiplier?: number;
  shouldRetry?: (error: any) => boolean;
}

export interface CacheEntry {
  value: any;
  expiry: number;
}

export interface BatchItem {
  resolve: () => void;
  reject: (error: any) => void;
  [key: string]: any;
}
