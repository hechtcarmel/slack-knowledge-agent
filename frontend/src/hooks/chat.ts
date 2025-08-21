import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ChatRequest,
  ChatResponse,
  Conversation,
  ConversationList,
} from '@/types/chat';
import { ConversationStorage } from '@/lib/conversation-storage';

// Chat query keys
const chatQueryKeys = {
  conversations: ['chat', 'conversations'] as const,
  conversation: (id: string) => ['chat', 'conversation', id] as const,
};

// Chat API client class
class ChatApiClient {
  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `/api/chat${endpoint}`;
    const config: RequestInit = {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    };

    const response = await fetch(url, config);
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || data.error || `HTTP ${response.status}`);
    }

    return data;
  }

  async sendMessage(request: ChatRequest): Promise<ChatResponse> {
    // Filter out null values to avoid validation issues
    const cleanRequest: any = {
      message: request.message,
      channels: request.channels,
      stream: request.stream,
    };

    // Only add conversationId if it's not null
    if (request.conversationId) {
      cleanRequest.conversationId = request.conversationId;
    }

    // Only add options if provided
    if (request.options) {
      cleanRequest.options = request.options;
    }

    const response = await this.request<{
      status: 'success';
      data: ChatResponse;
    }>('/', {
      method: 'POST',
      body: JSON.stringify(cleanRequest),
    });

    return response.data;
  }

  async getConversations(): Promise<ConversationList> {
    const response = await this.request<{
      status: 'success';
      data: ConversationList;
    }>('/');

    return response.data;
  }

  async getConversation(conversationId: string): Promise<Conversation> {
    const response = await this.request<{
      status: 'success';
      data: Conversation;
    }>(`/${conversationId}`);

    return response.data;
  }

  async createConversation(
    channels: string[],
    options?: any
  ): Promise<Conversation> {
    const response = await this.request<{
      status: 'success';
      data: Conversation;
    }>('/new', {
      method: 'POST',
      body: JSON.stringify({ channels, options }),
    });

    return response.data;
  }

  async deleteConversation(conversationId: string): Promise<void> {
    await this.request<{
      status: 'success';
      data: { deleted: boolean };
    }>(`/${conversationId}`, {
      method: 'DELETE',
    });
  }

  // Streaming chat message
  async *streamMessage(request: ChatRequest): AsyncIterable<{
    conversationId: string;
    messageId: string;
    content: string;
    done: boolean;
  }> {
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ ...request, stream: true }),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('No response body reader available');
    }

    const decoder = new TextDecoder();

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') {
              return;
            }

            try {
              const parsed = JSON.parse(data);
              if (parsed.error) {
                throw new Error(parsed.error);
              }
              yield parsed;
            } catch (e) {
              // Skip malformed JSON
              continue;
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }
}

const chatApiClient = new ChatApiClient();

// Hooks for chat functionality

/**
 * Query hook to get list of conversations
 */
export function useConversationsQuery() {
  return useQuery({
    queryKey: chatQueryKeys.conversations,
    queryFn: async () => {
      try {
        // Try to get from server first
        return await chatApiClient.getConversations();
      } catch (error) {
        // Fallback to localStorage
        console.warn(
          'Failed to fetch conversations from server, using localStorage:',
          error
        );
        const localConversations =
          ConversationStorage.getConversationSummaries();
        return {
          conversations: localConversations,
          total: localConversations.length,
        };
      }
    },
    staleTime: 30 * 1000, // 30 seconds
  });
}

/**
 * Query hook to get a specific conversation
 */
export function useConversationQuery(conversationId: string | null) {
  return useQuery({
    queryKey: conversationId
      ? chatQueryKeys.conversation(conversationId)
      : ['none'],
    queryFn: async () => {
      if (!conversationId) return null;

      try {
        // Try to get from server first
        return await chatApiClient.getConversation(conversationId);
      } catch (error) {
        // Fallback to localStorage
        console.warn(
          'Failed to fetch conversation from server, using localStorage:',
          error
        );
        return ConversationStorage.loadConversation(conversationId);
      }
    },
    enabled: !!conversationId,
    staleTime: 60 * 1000, // 1 minute
  });
}

/**
 * Mutation hook to send a chat message
 */
export function useSendMessageMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (request: ChatRequest) => chatApiClient.sendMessage(request),
    onSuccess: response => {
      // Update conversations list
      queryClient.invalidateQueries({ queryKey: chatQueryKeys.conversations });

      // Update specific conversation in React Query cache
      queryClient.setQueryData(
        chatQueryKeys.conversation(response.conversationId),
        response.conversation
      );

      // Save to localStorage
      ConversationStorage.saveConversation(response.conversation);

      // Force invalidate and refetch to ensure UI updates
      queryClient.invalidateQueries({
        queryKey: chatQueryKeys.conversation(response.conversationId),
      });
    },
  });
}

/**
 * Mutation hook to create a new conversation
 */
export function useCreateConversationMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      channels,
      options,
    }: {
      channels: string[];
      options?: any;
    }) => chatApiClient.createConversation(channels, options),
    onSuccess: conversation => {
      queryClient.invalidateQueries({ queryKey: chatQueryKeys.conversations });

      // Save to localStorage
      ConversationStorage.saveConversation(conversation);
    },
  });
}

/**
 * Mutation hook to delete a conversation
 */
export function useDeleteConversationMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (conversationId: string) =>
      chatApiClient.deleteConversation(conversationId),
    onSuccess: (_, conversationId) => {
      queryClient.invalidateQueries({ queryKey: chatQueryKeys.conversations });

      // Remove from localStorage
      ConversationStorage.deleteConversation(conversationId);
    },
  });
}

/**
 * Custom hook for streaming chat messages
 */
export function useStreamMessage() {
  return {
    streamMessage: (request: ChatRequest) =>
      chatApiClient.streamMessage(request),
  };
}
