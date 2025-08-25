import { useMutation } from '@tanstack/react-query';
import { ChatRequest, ChatResponse } from '@/types/chat';

// Simple Chat API client class
class ChatApiClient {
  async sendMessage(request: ChatRequest): Promise<ChatResponse> {
    // Use the existing /api/query endpoint which works
    const queryRequest = {
      query: request.message,
      channels: request.channels,
      options: request.options || { includeFiles: false, includeThreads: true },
      conversationHistory: request.conversationHistory || [],
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
        relevantPermalinks: data.data.relevantPermalinks,
        permalinkReferences: data.data.permalinkReferences,
        intermediateSteps: data.data.metadata?.intermediate_steps,
        executionTrace: data.data.metadata?.execution_trace,
      },
    };

    return {
      conversationId: 'current',
      message: aiMessage,
      conversation: {
        id: 'current',
        title: 'Chat',
        messages: [aiMessage],
        channels: request.channels,
        options: request.options || {
          includeFiles: false,
          includeThreads: true,
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
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
