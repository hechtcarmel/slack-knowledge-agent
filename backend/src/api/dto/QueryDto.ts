/**
 * Data Transfer Objects for Query API endpoints
 *
 * These DTOs define the structure of request and response objects
 * for the query/LLM endpoints.
 */

import { z } from 'zod';

/**
 * Query request DTO schema
 */
export const QueryRequestDto = z.object({
  query: z.string().min(1, 'Query cannot be empty'),
  channels: z.array(z.string()).min(1, 'At least one channel is required'),
  llmOptions: z
    .object({
      provider: z.enum(['openai', 'anthropic']).optional(),
      model: z.string().optional(),
      maxTokens: z.number().int().min(50).max(4000).optional(),
      temperature: z.number().min(0).max(2).optional(),
      stream: z.boolean().default(false),
    })
    .optional(),
});

/**
 * Query response DTO schema
 */
export const QueryResponseDto = z.object({
  status: z.literal('success'),
  data: z.object({
    answer: z.string(),
    metadata: z.object({
      provider: z.string(),
      model: z.string(),
      usage: z.object({
        promptTokens: z.number(),
        completionTokens: z.number(),
        totalTokens: z.number(),
        costUsd: z.number().optional(),
      }),
      toolCalls: z.number(),
      responseTimeMs: z.number(),
      intermediateSteps: z.array(z.any()).optional(),
      executionTrace: z.object({
        queryTime: z.number(),
        channelsSearched: z.array(
          z.object({
            id: z.string(),
            name: z.string(),
          })
        ),
        context: z.any(),
      }),
    }),
  }),
});

/**
 * Stream chunk DTO schema
 */
export const StreamChunkDto = z.object({
  content: z.string().optional(),
  done: z.boolean().optional(),
  usage: z
    .object({
      promptTokens: z.number(),
      completionTokens: z.number(),
      totalTokens: z.number(),
    })
    .optional(),
});

/**
 * Provider info DTO schema
 */
export const ProviderInfoDto = z.object({
  name: z.string(),
  available: z.boolean(),
  models: z.array(z.string()),
});

/**
 * Providers response DTO schema
 */
export const ProvidersResponseDto = z.object({
  status: z.literal('success'),
  data: z.object({
    providers: z.record(z.string(), ProviderInfoDto),
    total: z.number(),
  }),
});

/**
 * Health response DTO schema
 */
export const HealthResponseDto = z.object({
  status: z.literal('success'),
  data: z.object({
    status: z.enum(['healthy', 'degraded', 'unhealthy']),
    details: z.record(z.string(), z.any()).optional(),
    availableModels: z.record(z.string(), z.array(z.string())).optional(),
  }),
});

/**
 * Error response DTO schema
 */
export const ErrorResponseDto = z.object({
  status: z.literal('error'),
  message: z.string(),
  error: z.string(),
});

// TypeScript types inferred from schemas
export type QueryRequestDto = z.infer<typeof QueryRequestDto>;
export type QueryResponseDto = z.infer<typeof QueryResponseDto>;
export type StreamChunkDto = z.infer<typeof StreamChunkDto>;
export type ProviderInfoDto = z.infer<typeof ProviderInfoDto>;
export type ProvidersResponseDto = z.infer<typeof ProvidersResponseDto>;
export type HealthResponseDto = z.infer<typeof HealthResponseDto>;
export type ErrorResponseDto = z.infer<typeof ErrorResponseDto>;

/**
 * Request validation middleware factory for query endpoints
 */
export function validateQueryRequest() {
  return (req: any, res: any, next: any) => {
    try {
      req.body = QueryRequestDto.parse(req.body);
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({
          status: 'error',
          message: 'Validation failed',
          error: error.errors
            .map(e => `${e.path.join('.')}: ${e.message}`)
            .join(', '),
        });
      } else {
        res.status(400).json({
          status: 'error',
          message: 'Invalid request',
          error: String(error),
        });
      }
    }
  };
}
