/**
 * Chat and conversation types for the Slack knowledge agent
 */

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
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
  createdAt: Date;
  updatedAt: Date;
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

export interface ConversationSummary {
  id: string;
  title?: string;
  lastMessage?: string;
  messageCount: number;
  channels: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface ConversationList {
  conversations: ConversationSummary[];
  total: number;
}

/**
 * Extended LLM context that includes conversation history
 */
export interface ConversationLLMContext {
  query: string;
  channelIds: string[];
  messages: any[]; // Slack messages from tools
  conversationHistory: ChatMessage[];
  metadata: {
    total_messages: number;
    channels: Array<{
      id: string;
      name: string;
    }>;
    search_time_ms: number;
    token_count: number;
    conversationId?: string;
  };
}
