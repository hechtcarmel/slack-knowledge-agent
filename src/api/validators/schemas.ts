import { z } from 'zod';

export const QueryRequestSchema = z.object({
  question: z.string().min(1, 'Question cannot be empty').max(1000, 'Question too long'),
  channels: z
    .array(z.string().regex(/^C[A-Z0-9]+$/, 'Invalid channel ID format'))
    .min(1, 'At least one channel must be selected')
    .max(20, 'Too many channels selected'),
  options: z.object({
    maxResults: z.number().min(1).max(200).optional(),
    llmProvider: z.enum(['openai', 'anthropic']).optional()
  }).optional()
});

export const ChannelsQuerySchema = z.object({
  includeArchived: z
    .string()
    .transform(val => val === 'true')
    .optional()
});

export const HealthQuerySchema = z.object({
  detailed: z
    .string()
    .transform(val => val === 'true')
    .optional()
});

export const SlackEventSchema = z.object({
  type: z.string(),
  token: z.string().optional(),
  challenge: z.string().optional(),
  event: z.object({
    type: z.string(),
    channel: z.string().optional(),
    user: z.string().optional(),
    text: z.string().optional(),
    ts: z.string().optional(),
    thread_ts: z.string().optional()
  }).optional()
});

export type QueryRequestType = z.infer<typeof QueryRequestSchema>;
export type ChannelsQueryType = z.infer<typeof ChannelsQuerySchema>;
export type HealthQueryType = z.infer<typeof HealthQuerySchema>;
export type SlackEventType = z.infer<typeof SlackEventSchema>;