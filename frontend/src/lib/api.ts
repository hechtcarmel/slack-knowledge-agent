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
    return this.request<QueryResponse>('/query', {
      method: 'POST',
      body: JSON.stringify(query),
    });
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
