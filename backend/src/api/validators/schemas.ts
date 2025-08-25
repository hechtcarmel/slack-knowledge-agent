import { z } from 'zod';

// Message schema for conversation history
const ConversationMessageSchema = z.object({
  id: z.string(),
  role: z.enum(['user', 'assistant']),
  content: z.string(),
  timestamp: z.string(),
  metadata: z.any().optional(),
});

export const QueryRequestSchema = z.object({
  query: z.string().min(1, 'Query cannot be empty').max(1000, 'Query too long'),
  channels: z
    .array(z.string().regex(/^C[A-Z0-9]+$/, 'Invalid channel ID format'))
    .min(1, 'At least one channel must be selected')
    .max(20, 'Too many channels selected'),
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
  conversationHistory: z.array(ConversationMessageSchema).optional(),
});

export const ChannelsQuerySchema = z.object({
  includeArchived: z
    .string()
    .transform(val => val === 'true')
    .optional(),
});

export const HealthQuerySchema = z.object({
  detailed: z
    .string()
    .transform(val => val === 'true')
    .optional(),
});

export const SlackEventSchema = z.object({
  type: z.string(),
  token: z.string().optional(),
  challenge: z.string().optional(),
  event: z
    .object({
      type: z.string(),
      channel: z.string().optional(),
      user: z.string().optional(),
      text: z.string().optional(),
      ts: z.string().optional(),
      thread_ts: z.string().optional(),
    })
    .optional(),
});

// Response schemas
export const ChannelResponseSchema = z.object({
  id: z.string(),
  name: z.string(),
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

export const ChannelsDataResponseSchema = z.object({
  channels: z.array(ChannelResponseSchema),
  total: z.number(),
});

export const SuccessResponseSchema = <T extends z.ZodTypeAny>(dataSchema: T) =>
  z.object({
    status: z.literal('success'),
    data: dataSchema,
  });

export const ErrorResponseSchema = z.object({
  status: z.literal('error'),
  message: z.string(),
  error: z.string().optional(),
});

export const ChannelsResponseSchema = SuccessResponseSchema(
  ChannelsDataResponseSchema
);

export const HealthStatusResponseSchema = z.object({
  status: z.enum(['healthy', 'unhealthy']),
  timestamp: z.string(),
  uptime: z.number().optional(),
  version: z.string().optional(),
  services: z
    .object({
      slack: z.object({
        status: z.enum(['connected', 'disconnected', 'error']),
        lastCheck: z.string(),
        error: z.string().optional(),
      }),
      llm: z.object({
        status: z.enum(['connected', 'disconnected', 'error']),
        provider: z.string(),
        lastCheck: z.string(),
        error: z.string().optional(),
      }),
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

export type QueryRequestType = z.infer<typeof QueryRequestSchema>;
export type ChannelsQueryType = z.infer<typeof ChannelsQuerySchema>;
export type HealthQueryType = z.infer<typeof HealthQuerySchema>;
export type SlackEventType = z.infer<typeof SlackEventSchema>;
export type ChannelResponseType = z.infer<typeof ChannelResponseSchema>;
export type ChannelsDataResponseType = z.infer<
  typeof ChannelsDataResponseSchema
>;
export type ChannelsResponseType = z.infer<typeof ChannelsResponseSchema>;
export type HealthStatusResponseType = z.infer<
  typeof HealthStatusResponseSchema
>;
