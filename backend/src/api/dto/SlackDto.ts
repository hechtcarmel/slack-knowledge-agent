/**
 * Data Transfer Objects for Slack API endpoints
 *
 * These DTOs define the structure of request and response objects
 * for the Slack-related endpoints.
 */

import { z } from 'zod';

/**
 * Channel DTO schema
 */
export const ChannelDto = z.object({
  id: z.string(),
  name: z.string(),
  purpose: z
    .object({
      value: z.string(),
    })
    .optional(),
  topic: z
    .object({
      value: z.string(),
    })
    .optional(),
  numMembers: z.number().optional(),
});

/**
 * Message DTO schema
 */
export const MessageDto = z.object({
  user: z.string(),
  text: z.string(),
  ts: z.string(),
  channel: z.string(),
  threadTs: z.string().optional(),
});

/**
 * File DTO schema
 */
export const FileDto = z.object({
  id: z.string(),
  name: z.string(),
  filetype: z.string(),
  size: z.number(),
  urlPrivate: z.string(),
  channels: z.array(z.string()),
});

/**
 * Search request DTO schema
 */
export const SearchRequestDto = z.object({
  query: z.string().min(1, 'Search query cannot be empty'),
  channels: z.array(z.string()).min(1, 'At least one channel is required'),
  limit: z.number().int().min(1).max(100).default(20),
  timeRange: z
    .object({
      start: z.string().datetime(),
      end: z.string().datetime(),
    })
    .optional(),
});

/**
 * Search response DTO schema
 */
export const SearchResponseDto = z.object({
  status: z.literal('success'),
  data: z.object({
    messages: z.array(MessageDto),
    metadata: z.object({
      totalResults: z.number(),
      searchTime: z.number(),
      channels: z.array(ChannelDto),
    }),
  }),
});

/**
 * Channels response DTO schema
 */
export const ChannelsResponseDto = z.object({
  status: z.literal('success'),
  data: z.object({
    channels: z.array(ChannelDto),
    total: z.number(),
  }),
});

/**
 * Files response DTO schema
 */
export const FilesResponseDto = z.object({
  status: z.literal('success'),
  data: z.object({
    files: z.array(FileDto),
    metadata: z.object({
      totalFiles: z.number(),
      channels: z.array(ChannelDto),
    }),
  }),
});

/**
 * Health response DTO schema
 */
export const SlackHealthResponseDto = z.object({
  status: z.literal('success'),
  data: z.object({
    slack: z.object({
      status: z.enum(['connected', 'error', 'unavailable']),
      lastCheck: z.string(),
      channels: z.number().optional(),
      cacheStatus: z.string().optional(),
      tokens: z.record(z.string(), z.string()).optional(),
      error: z.string().optional(),
    }),
    timestamp: z.string(),
  }),
});

// TypeScript types inferred from schemas
export type ChannelDto = z.infer<typeof ChannelDto>;
export type MessageDto = z.infer<typeof MessageDto>;
export type FileDto = z.infer<typeof FileDto>;
export type SearchRequestDto = z.infer<typeof SearchRequestDto>;
export type SearchResponseDto = z.infer<typeof SearchResponseDto>;
export type ChannelsResponseDto = z.infer<typeof ChannelsResponseDto>;
export type FilesResponseDto = z.infer<typeof FilesResponseDto>;
export type SlackHealthResponseDto = z.infer<typeof SlackHealthResponseDto>;

/**
 * Request validation middleware factory for Slack endpoints
 */
export function validateSearchRequest() {
  return (req: any, res: any, next: any) => {
    try {
      req.body = SearchRequestDto.parse(req.body);
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

/**
 * Response transformation utilities
 */
export const transformers = {
  /**
   * Transform internal Channel to ChannelDto
   */
  transformChannel: (channel: any): ChannelDto => ({
    id: channel.id,
    name: channel.name,
    purpose: channel.purpose,
    topic: channel.topic,
    numMembers: channel.num_members,
  }),

  /**
   * Transform internal Message to MessageDto
   */
  transformMessage: (message: any): MessageDto => ({
    user: message.user,
    text: message.text,
    ts: message.ts,
    channel: message.channel,
    threadTs: message.thread_ts,
  }),

  /**
   * Transform internal File to FileDto
   */
  transformFile: (file: any): FileDto => ({
    id: file.id,
    name: file.name,
    filetype: file.filetype,
    size: file.size,
    urlPrivate: file.url_private,
    channels: file.channels,
  }),
};
