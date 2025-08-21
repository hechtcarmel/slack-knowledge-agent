export interface Channel {
  id: string;
  name: string;
  description?: string;
  memberCount?: number;
  purpose?: {
    value: string;
    creator: string;
    last_set: number;
  };
  topic?: {
    value: string;
    creator: string;
    last_set: number;
  };
  num_members?: number;
}

export interface Message {
  id: string;
  text: string;
  user: string;
  username?: string;
  timestamp: string;
  channelId?: string;
  threadId?: string;
  reactions?: Array<{
    name: string;
    count: number;
    users: string[];
  }>;
}

export interface QueryRequest {
  query: string;
  channels: string[];
  context?: {
    includeFiles?: boolean;
    includeThreads?: boolean;
    dateRange?: {
      start?: string;
      end?: string;
    };
  };
}

export interface ToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

export interface ToolExecutionResult {
  success: boolean;
  data?: any;
  error?: string;
  metadata?: {
    executionTime?: number;
    toolName?: string;
    [key: string]: any;
  };
}

export interface IntermediateStep {
  action: {
    tool: string;
    toolInput: any;
    log?: string;
  };
  observation: string | ToolExecutionResult;
}

export interface ExecutionTrace {
  query_time: number;
  channels_searched: Array<{
    id: string;
    name: string;
  }>;
  context: {
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
  };
}

export interface QueryResponse {
  response: string;
  metadata: {
    channels: string[];
    messagesFound: number;
    tokenUsage?: {
      prompt: number;
      completion: number;
      total: number;
    };
    processingTime: number;
    llmProvider: string;
    // Advanced observability data
    intermediateSteps?: IntermediateStep[];
    executionTrace?: ExecutionTrace;
    toolCalls?: ToolCall[];
    model?: string;
  };
  sources?: Array<{
    type: 'message' | 'thread' | 'file';
    id: string;
    channelId: string;
    timestamp: string;
    snippet: string;
  }>;
}

export interface HealthStatus {
  status: 'healthy' | 'unhealthy';
  timestamp: string;
  services: {
    slack: {
      status: 'connected' | 'disconnected' | 'error';
      lastCheck: string;
      error?: string;
    };
    llm: {
      status: 'connected' | 'disconnected' | 'error';
      provider: string;
      lastCheck: string;
      error?: string;
    };
  };
}

export interface ApiError {
  error: {
    message: string;
    code: string;
    details?: Record<string, unknown>;
  };
}

export interface LLMProvider {
  id: string;
  name: string;
  models: string[];
  status: 'available' | 'unavailable';
  currentModel?: string;
}

// API Response wrappers
export interface SuccessResponse<T> {
  status: 'success';
  data: T;
}

export interface ErrorResponse {
  status: 'error';
  message: string;
  error?: string;
}

export type ApiResponse<T> = SuccessResponse<T> | ErrorResponse;

// Specific API response types
export interface ChannelsData {
  channels: Channel[];
  total: number;
}

export type ChannelsResponse = ApiResponse<ChannelsData>;
