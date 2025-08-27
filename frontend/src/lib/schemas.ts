import { z } from 'zod';

/**
 * Zod schemas for API response validation
 */

export const ChannelSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  memberCount: z.number().optional(),
  purpose: z.object({
    value: z.string(),
    creator: z.string(),
    last_set: z.number(),
  }).optional(),
  topic: z.object({
    value: z.string(), 
    creator: z.string(),
    last_set: z.number(),
  }).optional(),
  num_members: z.number().optional(),
});

export const ChannelsDataSchema = z.object({
  channels: z.array(ChannelSchema),
  total: z.number().optional(),
});

export const ChannelsResponseSchema = z.object({
  status: z.string(),
  data: ChannelsDataSchema.optional(),
  error: z.string().optional(),
});

export const HealthStatusSchema = z.object({
  status: z.string(),
  timestamp: z.string(),
  uptime: z.number(),
  version: z.string(),
  services: z.object({
    slack: z.object({
      status: z.string(),
      lastCheck: z.string().optional(),
      channels: z.number().optional(),
      cacheStatus: z.string().optional(),
      tokens: z.string().optional(),
    }),
    llm: z.object({
      status: z.string(),
      lastCheck: z.string().optional(),
      currentProvider: z.string().optional(),
      availableProviders: z.array(z.string()).optional(),
      toolsCount: z.number().optional(),
      memory: z.object({
        enabled: z.boolean(),
        messageCount: z.number(),
      }).optional(),
    }),
  }),
});

export const ApiErrorSchema = z.object({
  error: z.string(),
  details: z.string().optional(),
});