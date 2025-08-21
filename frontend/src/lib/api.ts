import {
  Channel,
  QueryRequest,
  QueryResponse,
  HealthStatus,
  LLMProvider,
  ChannelsResponse,
} from '@/types/api';

import {
  ChannelsResponseSchema,
  HealthStatusSchema,
  ApiErrorSchema,
} from '@/lib/schemas';

const API_BASE = '/api';

class ApiClient {
  private async request<T>(
    endpoint: string,
    options: RequestInit = {},
    schema?: any
  ): Promise<T> {
    const url = `${API_BASE}${endpoint}`;
    const config: RequestInit = {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    };

    try {
      const response = await fetch(url, config);
      const data = await response.json();

      if (!response.ok) {
        // Try to parse as API error first
        try {
          const errorData = ApiErrorSchema.parse(data);
          throw new Error(errorData.error.message);
        } catch {
          // Fallback to generic error
          throw new Error(
            data.message || data.error || `HTTP ${response.status}`
          );
        }
      }

      // Validate response schema if provided
      if (schema) {
        try {
          return schema.parse(data);
        } catch (error) {
          console.error('API response validation failed:', error);
          throw new Error('Invalid response format from server');
        }
      }

      return data;
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('An unexpected error occurred');
    }
  }

  async getHealth(): Promise<HealthStatus> {
    return this.request<HealthStatus>(
      '/health?detailed=true',
      {},
      HealthStatusSchema
    );
  }

  async getChannels(): Promise<Channel[]> {
    const response = await this.request<ChannelsResponse>(
      '/slack/channels',
      {},
      ChannelsResponseSchema
    );

    if (response.status === 'error') {
      throw new Error(response.message);
    }

    return response.data.channels;
  }

  async submitQuery(query: QueryRequest): Promise<QueryResponse> {
    const response = await this.request<{
      status: 'success';
      data: {
        answer: string;
        metadata: {
          provider: string;
          model: string;
          usage: {
            prompt_tokens: number;
            completion_tokens: number;
            total_tokens: number;
            cost_usd?: number;
          };
          tool_calls?: number;
          response_time_ms: number;
        };
      };
    }>('/query', {
      method: 'POST',
      body: JSON.stringify(query),
    });

    // Transform backend response to frontend expected format
    return {
      response: response.data.answer,
      metadata: {
        channels: query.channels,
        messagesFound: response.data.metadata.tool_calls || 0,
        tokenUsage: {
          prompt: response.data.metadata.usage.prompt_tokens,
          completion: response.data.metadata.usage.completion_tokens,
          total: response.data.metadata.usage.total_tokens,
        },
        processingTime: response.data.metadata.response_time_ms,
        llmProvider: response.data.metadata.provider,
      },
      sources: [], // TODO: Add sources when backend provides them
    };
  }

  async getLLMProviders(): Promise<LLMProvider[]> {
    return this.request<LLMProvider[]>('/query/providers');
  }

  async switchLLMProvider(providerId: string): Promise<{ success: boolean }> {
    return this.request<{ success: boolean }>('/query/provider', {
      method: 'POST',
      body: JSON.stringify({ provider: providerId }),
    });
  }

  async getSlackHealth(): Promise<HealthStatus['services']['slack']> {
    return this.request<HealthStatus['services']['slack']>('/slack/health');
  }

  async getLLMHealth(): Promise<HealthStatus['services']['llm']> {
    return this.request<HealthStatus['services']['llm']>('/query/health');
  }
}

export const apiClient = new ApiClient();
