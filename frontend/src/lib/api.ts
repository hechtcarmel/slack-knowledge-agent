import { 
  Channel, 
  QueryRequest, 
  QueryResponse, 
  HealthStatus, 
  LLMProvider,
  ApiError 
} from '@/types/api';

const API_BASE = '/api';

class ApiClient {
  private async request<T>(
    endpoint: string, 
    options: RequestInit = {}
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
      
      if (!response.ok) {
        const errorData: ApiError = await response.json();
        throw new Error(errorData.error?.message || `HTTP ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('An unexpected error occurred');
    }
  }

  async getHealth(): Promise<HealthStatus> {
    return this.request<HealthStatus>('/health');
  }

  async getChannels(): Promise<Channel[]> {
    return this.request<Channel[]>('/slack/channels');
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