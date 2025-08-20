import { z } from 'zod';

// Base API response structure
const ApiResponseSchema = <T extends z.ZodTypeAny>(dataSchema: T) =>
  z
    .object({
      status: z.literal('success'),
      data: dataSchema,
    })
    .or(
      z.object({
        status: z.literal('error'),
        message: z.string(),
        error: z.string().optional(),
      })
    );

// Channel schemas
export const ChannelSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  memberCount: z.number().optional(),
  purpose: z
    .object({
      value: z.string(),
      creator: z.string(),
      last_set: z.number(),
    })
    .optional(),
  topic: z
    .object({
      value: z.string(),
      creator: z.string(),
      last_set: z.number(),
    })
    .optional(),
  num_members: z.number().optional(),
});

export const ChannelsDataSchema = z.object({
  channels: z.array(ChannelSchema),
  total: z.number(),
});

export const ChannelsResponseSchema = ApiResponseSchema(ChannelsDataSchema);

// Health schemas
export const ServiceStatusSchema = z.object({
  status: z.enum(['connected', 'disconnected', 'error']),
  lastCheck: z.string(),
  error: z.string().optional(),
});

export const LLMServiceSchema = ServiceStatusSchema.extend({
  provider: z.string(),
});

export const HealthStatusSchema = z.object({
  status: z.enum(['healthy', 'unhealthy']),
  timestamp: z.string(),
  uptime: z.number().optional(),
  version: z.string().optional(),
  services: z
    .object({
      slack: ServiceStatusSchema,
      llm: LLMServiceSchema,
    })
    .optional(),
  system: z
    .object({
      memory: z.object({
        used: z.number(),
        total: z.number(),
        external: z.number(),
      }),
      cpu: z.object({
        usage: z.object({
          user: z.number(),
          system: z.number(),
        }),
      }),
    })
    .optional(),
});

// Query schemas
export const QueryRequestSchema = z.object({
  query: z.string().min(1),
  channels: z.array(z.string()).min(1),
  context: z
    .object({
      includeFiles: z.boolean().optional(),
      includeThreads: z.boolean().optional(),
      dateRange: z
        .object({
          start: z.string().optional(),
          end: z.string().optional(),
        })
        .optional(),
    })
    .optional(),
});

export const QueryResponseSchema = z.object({
  response: z.string(),
  metadata: z.object({
    channels: z.array(z.string()),
    messagesFound: z.number(),
    tokenUsage: z
      .object({
        prompt: z.number(),
        completion: z.number(),
        total: z.number(),
      })
      .optional(),
    processingTime: z.number(),
    llmProvider: z.string(),
  }),
  sources: z
    .array(
      z.object({
        type: z.enum(['message', 'thread', 'file']),
        id: z.string(),
        channelId: z.string(),
        timestamp: z.string(),
        snippet: z.string(),
      })
    )
    .optional(),
});

export const QueryResponseApiSchema = ApiResponseSchema(QueryResponseSchema);

// LLM Provider schemas
export const LLMProviderSchema = z.object({
  id: z.string(),
  name: z.string(),
  models: z.array(z.string()),
  status: z.enum(['available', 'unavailable']),
  currentModel: z.string().optional(),
});

export const LLMProvidersResponseSchema = ApiResponseSchema(
  z.array(LLMProviderSchema)
);

// Error schema
export const ApiErrorSchema = z.object({
  error: z.object({
    message: z.string(),
    code: z.string(),
    details: z.record(z.unknown()).optional(),
  }),
});

// Type exports
export type Channel = z.infer<typeof ChannelSchema>;
export type ChannelsData = z.infer<typeof ChannelsDataSchema>;
export type ChannelsResponse = z.infer<typeof ChannelsResponseSchema>;
export type HealthStatus = z.infer<typeof HealthStatusSchema>;
export type QueryRequest = z.infer<typeof QueryRequestSchema>;
export type QueryResponse = z.infer<typeof QueryResponseSchema>;
export type QueryResponseApi = z.infer<typeof QueryResponseApiSchema>;
export type LLMProvider = z.infer<typeof LLMProviderSchema>;
export type LLMProvidersResponse = z.infer<typeof LLMProvidersResponseSchema>;
export type ApiError = z.infer<typeof ApiErrorSchema>;
