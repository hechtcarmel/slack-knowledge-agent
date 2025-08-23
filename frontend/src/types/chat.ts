/**
 * Chat and conversation types for the frontend
 */

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  metadata?: {
    tokenUsage?: {
      prompt: number;
      completion: number;
      total: number;
    };
    processingTime?: number;
    sources?: Array<{
      type: 'message' | 'thread' | 'file';
      id: string;
      channelId: string;
      timestamp: string;
      snippet: string;
    }>;
    llmProvider?: string;
    model?: string;
    intermediateSteps?: any[];
    toolCalls?: number;
    relevantPermalinks?: string[];
    permalinkReferences?: Array<{
      url: string;
      description: string;
    }>;
    executionTrace?: {
      query_time: number;
      channels_searched: Array<{
        id: string;
        name: string;
      }>;
      context: {
        metadata: {
          total_messages: number;
          search_time_ms: number;
        };
      };
    };
  };
}

export interface ConversationOptions {
  includeFiles: boolean;
  includeThreads: boolean;
  dateRange?: {
    start?: string;
    end?: string;
  };
}

export interface Conversation {
  id: string;
  title?: string;
  messages: ChatMessage[];
  channels: string[];
  options: ConversationOptions;
  createdAt: string;
  updatedAt: string;
}

export interface ConversationSummary {
  id: string;
  title?: string;
  lastMessage?: string;
  messageCount: number;
  channels: string[];
  createdAt: string;
  updatedAt: string;
}

export interface ChatRequest {
  conversationId?: string;
  message: string;
  channels: string[];
  options?: ConversationOptions;
  stream?: boolean;
}

export interface ChatResponse {
  conversationId: string;
  message: ChatMessage;
  conversation: Conversation;
}

export interface ConversationList {
  conversations: ConversationSummary[];
  total: number;
}

export interface StreamChunk {
  conversationId: string;
  messageId: string;
  content: string;
  done: boolean;
  metadata?: {
    tokenUsage?: {
      prompt: number;
      completion: number;
      total: number;
    };
  };
}

// UI state interfaces
export interface ChatState {
  currentConversation: Conversation | null;
  conversations: ConversationSummary[];
  selectedChannels: string[];
  isLoading: boolean;
  streamingMessage: string;
  error: string | null;
}

export interface MessageInputState {
  message: string;
  isSending: boolean;
  error: string | null;
}
