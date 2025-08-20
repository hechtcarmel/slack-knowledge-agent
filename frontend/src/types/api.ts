export interface Channel {
  id: string;
  name: string;
  description?: string;
  memberCount?: number;
  purpose?: string;
  topic?: string;
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