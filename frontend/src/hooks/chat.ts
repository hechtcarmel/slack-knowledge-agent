import { useMutation } from '@tanstack/react-query';
import { ChatRequest, ChatResponse } from '@/types/chat';

// Simple Chat API client class
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
    // Use the existing /api/query endpoint which works
    const queryRequest = {
      query: request.message,
      channels: request.channels,
      options: request.options || { includeFiles: false, includeThreads: true },
    };

    const response = await fetch('/api/query', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(queryRequest),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || data.error || `HTTP ${response.status}`);
    }

    // Convert the query response to chat response format
    const aiMessage = {
      id: `ai-${Date.now()}`,
      role: 'assistant' as const,
      content: data.data.answer || data.data.response,
      timestamp: new Date().toISOString(),
      metadata: {
        tokenUsage: data.data.metadata?.usage,
        sources: data.data.metadata?.sources,
        llmProvider: data.data.metadata?.provider,
        model: data.data.metadata?.model,
        processingTime: data.data.metadata?.response_time_ms,
      },
    };

    return {
      status: 'success',
      data: {
        message: aiMessage,
      },
    };
  }
}

// Create a singleton instance
const chatApiClient = new ChatApiClient();

// Simple send message mutation hook
export function useSendMessageMutation() {
  return useMutation({
    mutationFn: (request: ChatRequest) => chatApiClient.sendMessage(request),
  });
}

// Export the client for potential direct usage
export { chatApiClient };
