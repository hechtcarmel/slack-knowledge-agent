import { z } from 'zod';

/**
 * Chat message DTO for API communication
 */
export const ChatMessageDtoSchema = z.object({
  id: z.string(),
  role: z.enum(['user', 'assistant']),
  content: z.string(),
  timestamp: z.string().datetime(),
  metadata: z
    .object({
      tokenUsage: z
        .object({
          prompt: z.number(),
          completion: z.number(),
          total: z.number(),
        })
        .optional(),
      processingTime: z.number().optional(),
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
      llmProvider: z.string().optional(),
      model: z.string().optional(),
    })
    .optional(),
});

export type ChatMessageDto = z.infer<typeof ChatMessageDtoSchema>;

/**
 * Conversation options DTO
 */
export const ConversationOptionsDtoSchema = z.object({
  includeFiles: z.boolean().default(false),
  includeThreads: z.boolean().default(true),
  dateRange: z
    .object({
      start: z.string().optional(),
      end: z.string().optional(),
    })
    .optional(),
});

export type ConversationOptionsDto = z.infer<
  typeof ConversationOptionsDtoSchema
>;

/**
 * Conversation DTO for API communication
 */
export const ConversationDtoSchema = z.object({
  id: z.string(),
  title: z.string().optional(),
  messages: z.array(ChatMessageDtoSchema),
  channels: z.array(z.string()),
  options: ConversationOptionsDtoSchema,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type ConversationDto = z.infer<typeof ConversationDtoSchema>;

/**
 * Chat request DTO for sending messages
 */
export const ChatRequestDtoSchema = z.object({
  conversationId: z.string().optional().nullable(),
  message: z.string().min(1).max(4000),
  channels: z.array(z.string()).min(1),
  options: ConversationOptionsDtoSchema.optional(),
  stream: z.boolean().default(false),
});

export type ChatRequestDto = z.infer<typeof ChatRequestDtoSchema>;

/**
 * Chat response DTO for API responses
 */
export const ChatResponseDtoSchema = z.object({
  conversationId: z.string(),
  message: ChatMessageDtoSchema,
  conversation: ConversationDtoSchema,
});

export type ChatResponseDto = z.infer<typeof ChatResponseDtoSchema>;

/**
 * Conversation list DTO
 */
export const ConversationListDtoSchema = z.object({
  conversations: z.array(
    z.object({
      id: z.string(),
      title: z.string().optional(),
      lastMessage: z.string().optional(),
      messageCount: z.number(),
      channels: z.array(z.string()),
      createdAt: z.string().datetime(),
      updatedAt: z.string().datetime(),
    })
  ),
  total: z.number(),
});

export type ConversationListDto = z.infer<typeof ConversationListDtoSchema>;

/**
 * Streaming chunk DTO for real-time responses
 */
export const StreamChunkDtoSchema = z.object({
  conversationId: z.string(),
  messageId: z.string(),
  content: z.string(),
  done: z.boolean().default(false),
  metadata: z
    .object({
      tokenUsage: z
        .object({
          prompt: z.number(),
          completion: z.number(),
          total: z.number(),
        })
        .optional(),
    })
    .optional(),
});

export type StreamChunkDto = z.infer<typeof StreamChunkDtoSchema>;
