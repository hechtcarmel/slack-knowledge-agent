import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { QueryRequest } from '@/types/api';

// Query keys
const queryKeys = {
  health: ['health'] as const,
  channels: ['channels'] as const,
  llmProviders: ['llm', 'providers'] as const,
  slackHealth: ['slack', 'health'] as const,
  llmHealth: ['llm', 'health'] as const,
};

// Health queries
export function useHealthQuery() {
  return useQuery({
    queryKey: queryKeys.health,
    queryFn: () => apiClient.getHealth(),
    staleTime: 5 * 60 * 1000, // 5 minutes before considering data stale
    gcTime: 10 * 60 * 1000, // 10 minutes in cache (formerly cacheTime)
  });
}

export function useSlackHealthQuery() {
  return useQuery({
    queryKey: queryKeys.slackHealth,
    queryFn: () => apiClient.getSlackHealth(),
    staleTime: 5 * 60 * 1000, // 5 minutes before considering data stale
    gcTime: 10 * 60 * 1000, // 10 minutes in cache (formerly cacheTime)
  });
}

export function useLLMHealthQuery() {
  return useQuery({
    queryKey: queryKeys.llmHealth,
    queryFn: () => apiClient.getLLMHealth(),
    staleTime: 5 * 60 * 1000, // 5 minutes before considering data stale
    gcTime: 10 * 60 * 1000, // 10 minutes in cache (formerly cacheTime)
  });
}

// Channels query
export function useChannelsQuery() {
  return useQuery({
    queryKey: queryKeys.channels,
    queryFn: () => apiClient.getChannels(),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

// LLM providers query
export function useLLMProvidersQuery() {
  return useQuery({
    queryKey: queryKeys.llmProviders,
    queryFn: () => apiClient.getLLMProviders(),
  });
}

// Query mutation
export function useSubmitQueryMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (query: QueryRequest) => apiClient.submitQuery(query),
    onSuccess: () => {
      // Invalidate health queries to update token usage
      queryClient.invalidateQueries({ queryKey: queryKeys.health });
      queryClient.invalidateQueries({ queryKey: queryKeys.llmHealth });
    },
  });
}

// Switch LLM provider mutation
export function useSwitchLLMProviderMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (providerId: string) => apiClient.switchLLMProvider(providerId),
    onSuccess: () => {
      // Invalidate LLM-related queries
      queryClient.invalidateQueries({ queryKey: queryKeys.llmProviders });
      queryClient.invalidateQueries({ queryKey: queryKeys.llmHealth });
    },
  });
}
