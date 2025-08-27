# API Integration

This document provides comprehensive guidance on integrating with the backend API in the Slack Knowledge Agent frontend application.

## Overview

The frontend communicates with the backend through a REST API using:

- **TanStack Query**: For server state management and caching
- **Typed API Client**: Centralized API client with TypeScript interfaces
- **Error Handling**: Consistent error handling across all endpoints
- **Request/Response Validation**: Runtime validation using Zod schemas

## API Client Architecture

### Centralized API Client

```typescript
// src/lib/api.ts
import { QueryRequest, QueryResponse, Channel, HealthStatus } from '@/types/api';

class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string = '/api') {
    this.baseUrl = baseUrl;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    
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
        const errorData = await response.json().catch(() => ({}));
        throw new ApiError(response.status, errorData.message || 'Request failed');
      }

      return response.json();
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError(0, 'Network error occurred');
    }
  }

  // Health endpoints
  async getHealth(): Promise<HealthStatus> {
    return this.request<HealthStatus>('/health');
  }

  async getSlackHealth(): Promise<HealthStatus> {
    return this.request<HealthStatus>('/slack/health');
  }

  async getLLMHealth(): Promise<HealthStatus> {
    return this.request<HealthStatus>('/query/health');
  }

  // Channel endpoints
  async getChannels(): Promise<Channel[]> {
    return this.request<Channel[]>('/slack/channels');
  }

  // Query endpoints
  async submitQuery(query: QueryRequest): Promise<QueryResponse> {
    return this.request<QueryResponse>('/query', {
      method: 'POST',
      body: JSON.stringify(query),
    });
  }

  // LLM provider endpoints
  async getLLMProviders(): Promise<LLMProvider[]> {
    return this.request<LLMProvider[]>('/query/providers');
  }

  async switchLLMProvider(providerId: string): Promise<{ success: boolean }> {
    return this.request<{ success: boolean }>('/query/provider', {
      method: 'POST',
      body: JSON.stringify({ providerId }),
    });
  }
}

// Custom error class for API errors
export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

// Export singleton instance
export const apiClient = new ApiClient();
```

## TypeScript Types

### Request Types

```typescript
// src/types/api.ts
import { z } from 'zod';

// Query request schema
export const QueryRequestSchema = z.object({
  sessionId: z.string(),
  message: z.string().min(1, 'Message cannot be empty'),
  channels: z.array(z.string()).min(1, 'At least one channel required'),
  options: z.object({
    includeFiles: z.boolean().default(false),
    includeThreads: z.boolean().default(true),
  }).optional(),
  stream: z.boolean().default(false),
  conversationHistory: z.array(z.object({
    id: z.string(),
    role: z.enum(['user', 'assistant']),
    content: z.string(),
    timestamp: z.string(),
  })).optional(),
});

export type QueryRequest = z.infer<typeof QueryRequestSchema>;

// Channel schema
export const ChannelSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  isPrivate: z.boolean(),
  memberCount: z.number(),
  lastActivity: z.string(),
});

export type Channel = z.infer<typeof ChannelSchema>;

// Health status schema
export const HealthStatusSchema = z.object({
  status: z.enum(['healthy', 'degraded', 'unhealthy']),
  message: z.string().optional(),
  details: z.record(z.any()).optional(),
  timestamp: z.string(),
});

export type HealthStatus = z.infer<typeof HealthStatusSchema>;
```

### Response Types

```typescript
// Query response with metadata
export const QueryResponseSchema = z.object({
  message: z.object({
    content: z.string(),
    metadata: z.object({
      channels: z.array(z.string()),
      tokenUsage: z.object({
        prompt: z.number(),
        completion: z.number(),
        total: z.number(),
      }),
      processingTime: z.number(),
      sources: z.array(z.object({
        type: z.enum(['message', 'file', 'thread']),
        id: z.string(),
        channel: z.string(),
        timestamp: z.string(),
        author: z.string().optional(),
        relevance: z.number().min(0).max(1),
      })),
    }),
  }),
  success: z.boolean(),
  error: z.string().optional(),
});

export type QueryResponse = z.infer<typeof QueryResponseSchema>;

// LLM Provider
export const LLMProviderSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  isActive: z.boolean(),
  models: z.array(z.object({
    id: z.string(),
    name: z.string(),
    description: z.string(),
  })),
});

export type LLMProvider = z.infer<typeof LLMProviderSchema>;
```

## TanStack Query Integration

### Query Configuration

```typescript
// src/hooks/api.ts
import { useQuery, useMutation, useQueryClient, UseQueryOptions } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { QueryRequest, QueryResponse, Channel, HealthStatus } from '@/types/api';

// Query keys for consistent caching
export const queryKeys = {
  health: ['health'] as const,
  slackHealth: ['slack', 'health'] as const,
  llmHealth: ['llm', 'health'] as const,
  channels: ['channels'] as const,
  llmProviders: ['llm', 'providers'] as const,
} as const;

// Health queries
export function useHealthQuery(options?: UseQueryOptions<HealthStatus>) {
  return useQuery({
    queryKey: queryKeys.health,
    queryFn: () => apiClient.getHealth(),
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000,   // 10 minutes (formerly cacheTime)
    retry: 2,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    ...options,
  });
}

export function useSlackHealthQuery() {
  return useQuery({
    queryKey: queryKeys.slackHealth,
    queryFn: () => apiClient.getSlackHealth(),
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    retry: (failureCount, error) => {
      // Don't retry on 4xx errors
      if (error instanceof ApiError && error.status >= 400 && error.status < 500) {
        return false;
      }
      return failureCount < 3;
    },
  });
}

export function useLLMHealthQuery() {
  return useQuery({
    queryKey: queryKeys.llmHealth,
    queryFn: () => apiClient.getLLMHealth(),
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
}

// Channels query
export function useChannelsQuery() {
  return useQuery({
    queryKey: queryKeys.channels,
    queryFn: () => apiClient.getChannels(),
    staleTime: 10 * 60 * 1000, // 10 minutes - channels don't change often
    gcTime: 30 * 60 * 1000,    // 30 minutes
    refetchOnWindowFocus: false,
    retry: 3,
  });
}

// LLM providers query
export function useLLMProvidersQuery() {
  return useQuery({
    queryKey: queryKeys.llmProviders,
    queryFn: () => apiClient.getLLMProviders(),
    staleTime: 15 * 60 * 1000, // 15 minutes
    gcTime: 30 * 60 * 1000,
  });
}
```

### Mutations

```typescript
// Query submission mutation
export function useSubmitQueryMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (query: QueryRequest) => {
      // Validate request before sending
      const validatedQuery = QueryRequestSchema.parse(query);
      return apiClient.submitQuery(validatedQuery);
    },
    onSuccess: (data, variables) => {
      // Invalidate health queries to update token usage
      queryClient.invalidateQueries({ queryKey: queryKeys.health });
      queryClient.invalidateQueries({ queryKey: queryKeys.llmHealth });
    },
    onError: (error, variables) => {
      console.error('Query submission failed:', error);
      // Error is handled by the error store in components
    },
    // Optional: optimistic updates for better UX
    onMutate: async (query) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: queryKeys.health });
      
      // Return context for rollback
      return { query };
    },
  });
}

// LLM provider switch mutation
export function useSwitchLLMProviderMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (providerId: string) => apiClient.switchLLMProvider(providerId),
    onSuccess: () => {
      // Invalidate related queries
      queryClient.invalidateQueries({ queryKey: queryKeys.llmProviders });
      queryClient.invalidateQueries({ queryKey: queryKeys.llmHealth });
      
      // Show success notification
      toast.success('LLM provider switched successfully');
    },
    onError: (error) => {
      toast.error('Failed to switch LLM provider');
      console.error('Provider switch failed:', error);
    },
  });
}
```

## Error Handling

### API Error Types

```typescript
// src/lib/errors.ts
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public details?: any
  ) {
    super(message);
    this.name = 'ApiError';
  }

  get isClientError() {
    return this.status >= 400 && this.status < 500;
  }

  get isServerError() {
    return this.status >= 500;
  }

  get isNetworkError() {
    return this.status === 0;
  }
}

export class ValidationError extends Error {
  constructor(
    message: string,
    public field?: string,
    public value?: any
  ) {
    super(message);
    this.name = 'ValidationError';
  }
}
```

### Error Handling Patterns

```typescript
// Component-level error handling
function DataComponent() {
  const { data, error, isLoading } = useChannelsQuery();
  const setError = useErrorStore((state) => state.setError);

  // Handle query errors
  useEffect(() => {
    if (error) {
      if (error instanceof ApiError) {
        if (error.isClientError) {
          setError('channels', 'Invalid request. Please try again.');
        } else if (error.isServerError) {
          setError('channels', 'Server error. Please try again later.');
        } else if (error.isNetworkError) {
          setError('channels', 'Network error. Check your connection.');
        }
      } else {
        setError('channels', 'An unexpected error occurred.');
      }
    }
  }, [error, setError]);

  if (isLoading) return <LoadingSkeleton />;
  
  if (error) {
    return (
      <ErrorDisplay 
        error={error}
        onRetry={() => queryClient.invalidateQueries({ queryKey: queryKeys.channels })}
      />
    );
  }

  return <DataDisplay data={data} />;
}

// Mutation error handling
function ChatInput() {
  const [message, setMessage] = useState('');
  const submitQuery = useSubmitQueryMutation();
  const setError = useErrorStore((state) => state.setError);

  const handleSubmit = async () => {
    try {
      const result = await submitQuery.mutateAsync({
        sessionId: getSessionId(),
        message,
        channels: selectedChannels,
        options: { includeFiles: false, includeThreads: true },
      });
      
      // Handle success
      setMessage('');
      onMessageSent(result);
      
    } catch (error) {
      if (error instanceof ApiError) {
        switch (error.status) {
          case 400:
            setError('chat', 'Invalid message format. Please try again.');
            break;
          case 401:
            setError('chat', 'Authentication required. Please refresh the page.');
            break;
          case 403:
            setError('chat', 'Access denied. Check channel permissions.');
            break;
          case 429:
            setError('chat', 'Rate limit exceeded. Please wait a moment.');
            break;
          case 500:
            setError('chat', 'Server error. Please try again later.');
            break;
          default:
            setError('chat', error.message);
        }
      } else if (error instanceof ValidationError) {
        setError('chat', `Validation error: ${error.message}`);
      } else {
        setError('chat', 'Failed to send message. Please try again.');
      }
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        disabled={submitQuery.isPending}
      />
      <button 
        type="submit" 
        disabled={!message.trim() || submitQuery.isPending}
      >
        {submitQuery.isPending ? 'Sending...' : 'Send'}
      </button>
    </form>
  );
}
```

### Global Error Interceptor

```typescript
// src/lib/query-client.ts
import { QueryClient } from '@tanstack/react-query';
import { toast } from '@/components/ui/use-toast';
import { useErrorStore } from '@/stores';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error) => {
        // Don't retry on client errors
        if (error instanceof ApiError && error.isClientError) {
          return false;
        }
        return failureCount < 3;
      },
      staleTime: 5 * 60 * 1000, // 5 minutes
      gcTime: 10 * 60 * 1000,   // 10 minutes
    },
    mutations: {
      onError: (error) => {
        // Global mutation error handling
        console.error('Mutation error:', error);
        
        if (error instanceof ApiError) {
          if (error.status === 401) {
            // Redirect to login or refresh
            window.location.reload();
          } else if (error.status >= 500) {
            toast({
              variant: "destructive",
              title: "Server Error",
              description: "Something went wrong on our end. Please try again.",
            });
          }
        }
      },
    },
  },
});
```

## Request/Response Validation

### Runtime Validation

```typescript
// src/lib/validation.ts
import { z } from 'zod';
import { ValidationError } from './errors';

export function validateRequest<T>(schema: z.ZodSchema<T>, data: unknown): T {
  try {
    return schema.parse(data);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const firstError = error.errors[0];
      throw new ValidationError(
        firstError.message,
        firstError.path.join('.'),
        firstError.code
      );
    }
    throw error;
  }
}

export function validateResponse<T>(schema: z.ZodSchema<T>, data: unknown): T {
  try {
    return schema.parse(data);
  } catch (error) {
    console.error('Response validation failed:', error);
    throw new ApiError(0, 'Invalid response format from server');
  }
}

// Usage in API client
async submitQuery(query: QueryRequest): Promise<QueryResponse> {
  // Validate request
  const validatedQuery = validateRequest(QueryRequestSchema, query);
  
  const response = await this.request<unknown>('/query', {
    method: 'POST',
    body: JSON.stringify(validatedQuery),
  });
  
  // Validate response
  return validateResponse(QueryResponseSchema, response);
}
```

### Form Validation

```typescript
// src/components/QueryForm.tsx
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

const QueryFormSchema = z.object({
  message: z.string().min(1, 'Message is required').max(1000, 'Message too long'),
  channels: z.array(z.string()).min(1, 'Select at least one channel'),
  includeFiles: z.boolean().default(false),
  includeThreads: z.boolean().default(true),
});

type QueryFormData = z.infer<typeof QueryFormSchema>;

function QueryForm() {
  const submitQuery = useSubmitQueryMutation();
  const selectedChannels = useSelectedChannels();
  
  const form = useForm<QueryFormData>({
    resolver: zodResolver(QueryFormSchema),
    defaultValues: {
      message: '',
      channels: selectedChannels,
      includeFiles: false,
      includeThreads: true,
    },
  });

  const onSubmit = async (data: QueryFormData) => {
    try {
      await submitQuery.mutateAsync({
        ...data,
        sessionId: getSessionId(),
        options: {
          includeFiles: data.includeFiles,
          includeThreads: data.includeThreads,
        },
      });
      
      form.reset();
    } catch (error) {
      // Error handling is done in the mutation
    }
  };

  return (
    <form onSubmit={form.handleSubmit(onSubmit)}>
      <div className="space-y-4">
        <div>
          <textarea
            {...form.register('message')}
            placeholder="Enter your question..."
            className="w-full min-h-[100px]"
          />
          {form.formState.errors.message && (
            <p className="text-sm text-destructive mt-1">
              {form.formState.errors.message.message}
            </p>
          )}
        </div>

        <div className="flex gap-4">
          <label className="flex items-center gap-2">
            <input
              {...form.register('includeFiles')}
              type="checkbox"
            />
            Include files
          </label>
          
          <label className="flex items-center gap-2">
            <input
              {...form.register('includeThreads')}
              type="checkbox"
            />
            Include threads
          </label>
        </div>

        <button
          type="submit"
          disabled={submitQuery.isPending || !form.formState.isValid}
          className="w-full"
        >
          {submitQuery.isPending ? 'Sending...' : 'Send Query'}
        </button>
      </div>
    </form>
  );
}
```

## Caching Strategies

### Cache Configuration

```typescript
// Different caching strategies for different data types
export const cacheConfig = {
  // Health status - frequent updates needed
  health: {
    staleTime: 1 * 60 * 1000,  // 1 minute
    gcTime: 5 * 60 * 1000,     // 5 minutes
    refetchInterval: 2 * 60 * 1000, // Auto-refresh every 2 minutes
  },
  
  // Channels - rarely change
  channels: {
    staleTime: 30 * 60 * 1000, // 30 minutes
    gcTime: 60 * 60 * 1000,    // 1 hour
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  },
  
  // User preferences - persist across sessions
  userSettings: {
    staleTime: Infinity, // Never goes stale
    gcTime: Infinity,    // Never garbage collected
  },
  
  // Query results - short-term cache
  queryResults: {
    staleTime: 5 * 60 * 1000,  // 5 minutes
    gcTime: 15 * 60 * 1000,    // 15 minutes
  },
};

// Apply cache config
export function useChannelsQuery() {
  return useQuery({
    queryKey: queryKeys.channels,
    queryFn: () => apiClient.getChannels(),
    ...cacheConfig.channels,
  });
}
```

### Cache Invalidation

```typescript
// Selective cache invalidation
function useRefreshData() {
  const queryClient = useQueryClient();

  const refreshAll = () => {
    queryClient.invalidateQueries();
  };

  const refreshHealth = () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.health });
    queryClient.invalidateQueries({ queryKey: queryKeys.slackHealth });
    queryClient.invalidateQueries({ queryKey: queryKeys.llmHealth });
  };

  const refreshChannels = () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.channels });
  };

  const prefetchChannels = () => {
    queryClient.prefetchQuery({
      queryKey: queryKeys.channels,
      queryFn: () => apiClient.getChannels(),
      staleTime: 10 * 60 * 1000,
    });
  };

  return {
    refreshAll,
    refreshHealth,
    refreshChannels,
    prefetchChannels,
  };
}
```

## Real-time Updates

### WebSocket Integration (Future Enhancement)

```typescript
// WebSocket client for real-time updates
class WebSocketClient {
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;

  connect() {
    const wsUrl = `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/ws`;
    
    this.ws = new WebSocket(wsUrl);
    
    this.ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      this.handleMessage(data);
    };
    
    this.ws.onclose = () => {
      this.handleReconnect();
    };
  }

  private handleMessage(data: any) {
    // Invalidate relevant queries based on message type
    switch (data.type) {
      case 'health_update':
        queryClient.invalidateQueries({ queryKey: queryKeys.health });
        break;
      case 'channels_updated':
        queryClient.invalidateQueries({ queryKey: queryKeys.channels });
        break;
      case 'query_complete':
        // Handle real-time query completion
        break;
    }
  }

  private handleReconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      setTimeout(() => {
        this.reconnectAttempts++;
        this.connect();
      }, 1000 * Math.pow(2, this.reconnectAttempts));
    }
  }
}
```

## Testing API Integration

### Mock API Client

```typescript
// __tests__/mocks/api.ts
export const mockApiClient = {
  getHealth: jest.fn(),
  getChannels: jest.fn(),
  submitQuery: jest.fn(),
  getSlackHealth: jest.fn(),
  getLLMHealth: jest.fn(),
  getLLMProviders: jest.fn(),
  switchLLMProvider: jest.fn(),
};

// Mock data
export const mockChannels: Channel[] = [
  {
    id: 'C1234567890',
    name: 'general',
    description: 'General discussion',
    isPrivate: false,
    memberCount: 25,
    lastActivity: '2024-01-15T10:30:00Z',
  },
  {
    id: 'C2345678901',
    name: 'engineering',
    description: 'Engineering team discussions',
    isPrivate: true,
    memberCount: 12,
    lastActivity: '2024-01-15T11:45:00Z',
  },
];

export const mockQueryResponse: QueryResponse = {
  message: {
    content: 'Based on the messages in #general...',
    metadata: {
      channels: ['C1234567890'],
      tokenUsage: { prompt: 150, completion: 75, total: 225 },
      processingTime: 1234,
      sources: [
        {
          type: 'message',
          id: 'M1234567890',
          channel: 'general',
          timestamp: '2024-01-15T10:00:00Z',
          author: 'john.doe',
          relevance: 0.85,
        },
      ],
    },
  },
  success: true,
};
```

### Query Testing

```typescript
// __tests__/hooks/api.test.ts
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useChannelsQuery } from '@/hooks/api';
import { mockApiClient, mockChannels } from './mocks/api';

// Mock the API client
jest.mock('@/lib/api', () => ({
  apiClient: mockApiClient,
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
}

describe('useChannelsQuery', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('fetches channels successfully', async () => {
    mockApiClient.getChannels.mockResolvedValue(mockChannels);

    const { result } = renderHook(() => useChannelsQuery(), {
      wrapper: createWrapper(),
    });

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toEqual(mockChannels);
    expect(mockApiClient.getChannels).toHaveBeenCalledTimes(1);
  });

  it('handles API errors correctly', async () => {
    const apiError = new ApiError(500, 'Internal server error');
    mockApiClient.getChannels.mockRejectedValue(apiError);

    const { result } = renderHook(() => useChannelsQuery(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error).toEqual(apiError);
  });
});
```

### Integration Testing

```typescript
// __tests__/integration/api.test.ts
import { setupServer } from 'msw/node';
import { rest } from 'msw';
import { apiClient } from '@/lib/api';

const server = setupServer(
  rest.get('/api/channels', (req, res, ctx) => {
    return res(ctx.json(mockChannels));
  }),
  
  rest.post('/api/query', (req, res, ctx) => {
    return res(ctx.json(mockQueryResponse));
  }),
  
  rest.get('/api/health', (req, res, ctx) => {
    return res(ctx.json({ status: 'healthy', timestamp: new Date().toISOString() }));
  })
);

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('API Integration', () => {
  it('fetches channels from API', async () => {
    const channels = await apiClient.getChannels();
    expect(channels).toEqual(mockChannels);
  });

  it('submits query to API', async () => {
    const queryRequest = {
      sessionId: 'test-session',
      message: 'Test query',
      channels: ['C1234567890'],
      options: { includeFiles: false, includeThreads: true },
    };

    const response = await apiClient.submitQuery(queryRequest);
    expect(response).toEqual(mockQueryResponse);
  });

  it('handles network errors', async () => {
    server.use(
      rest.get('/api/channels', (req, res) => {
        return res.networkError('Network error');
      })
    );

    await expect(apiClient.getChannels()).rejects.toThrow('Network error occurred');
  });
});
```

## Performance Optimization

### Request Batching

```typescript
// Batch multiple requests
function useDashboardData() {
  const queries = useQueries({
    queries: [
      {
        queryKey: queryKeys.health,
        queryFn: () => apiClient.getHealth(),
        staleTime: 1 * 60 * 1000,
      },
      {
        queryKey: queryKeys.channels,
        queryFn: () => apiClient.getChannels(),
        staleTime: 10 * 60 * 1000,
      },
      {
        queryKey: queryKeys.llmProviders,
        queryFn: () => apiClient.getLLMProviders(),
        staleTime: 15 * 60 * 1000,
      },
    ],
  });

  return {
    health: queries[0],
    channels: queries[1],
    providers: queries[2],
    isLoading: queries.some(q => q.isLoading),
    isError: queries.some(q => q.isError),
    errors: queries.filter(q => q.error).map(q => q.error),
  };
}
```

### Request Deduplication

```typescript
// TanStack Query automatically deduplicates identical requests
// But you can also implement custom deduplication for complex scenarios

class RequestDeduplicator {
  private pendingRequests = new Map<string, Promise<any>>();

  async deduplicate<T>(key: string, requestFn: () => Promise<T>): Promise<T> {
    if (this.pendingRequests.has(key)) {
      return this.pendingRequests.get(key);
    }

    const promise = requestFn().finally(() => {
      this.pendingRequests.delete(key);
    });

    this.pendingRequests.set(key, promise);
    return promise;
  }
}

const deduplicator = new RequestDeduplicator();

// Usage
async submitQuery(query: QueryRequest): Promise<QueryResponse> {
  const key = `query:${JSON.stringify(query)}`;
  return deduplicator.deduplicate(key, () => this.request('/query', {
    method: 'POST',
    body: JSON.stringify(query),
  }));
}
```

---

This comprehensive API integration guide covers all aspects of communicating with the backend API in the Slack Knowledge Agent frontend application. For specific implementation details, refer to the source code in `src/hooks/api.ts`, `src/lib/api.ts`, and `src/types/api.ts`.