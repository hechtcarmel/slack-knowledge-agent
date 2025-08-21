import { Router, type Router as ExpressRouter } from 'express';
import {
  ChatRequestDtoSchema,
  ChatResponseDto,
  ConversationListDto,
  StreamChunkDto,
} from '@/api/dto/ChatDto.js';
import { validateRequest } from '@/middleware/validation.js';
import { Logger } from '@/utils/logger.js';
import { ConversationService } from '@/services/ConversationService.js';
import { ILLMService } from '@/interfaces/services/ILLMService.js';
import { SlackService } from '@/services/SlackService.js';
import { ConversationLLMContext } from '@/types/chat.js';

const router: ExpressRouter = Router();
const logger = Logger.create('ChatRoutes');

// Services (will be injected by server)
let conversationService: ConversationService;
let llmService: ILLMService;
let slackService: SlackService;

export function initializeChatRoutes(
  convService: ConversationService,
  llm: ILLMService,
  slack: SlackService
) {
  conversationService = convService;
  llmService = llm;
  slackService = slack;
}

// POST /chat - Send a message in a conversation
router.post('/', validateRequest(ChatRequestDtoSchema), async (req, res) => {
  const startTime = Date.now();

  try {
    const {
      conversationId,
      message,
      channels,
      options,
      stream = false,
    } = req.body;

    logger.info('Processing chat message', {
      conversationId: conversationId || 'new',
      messageLength: message.length,
      channels,
      stream,
    });

    // Get or create conversation
    let conversation = conversationId
      ? conversationService.getConversation(conversationId)
      : null;

    if (!conversation) {
      // Create new conversation
      conversation = conversationService.createConversation(
        channels,
        options || {
          includeFiles: false,
          includeThreads: true,
        }
      );
    }

    // Add user message to conversation
    const userMessage = conversationService.addMessage(conversation.id, {
      role: 'user',
      content: message,
    });

    // Build LLM context with conversation history
    const conversationHistory = conversationService.getConversationContext(
      conversation.id,
      1500 // Reserve tokens for conversation context
    );

    // Build channel information
    const channelInfo = await Promise.all(
      conversation.channels.map(async (channelId: string) => {
        const channel = await slackService.getChannelById(channelId);
        return {
          id: channelId,
          name: channel?.name || channelId,
        };
      })
    );

    const llmContext: ConversationLLMContext = {
      query: message,
      channelIds: conversation.channels,
      messages: [], // Will be populated by tools
      conversationHistory: conversationHistory.filter(
        msg => msg.id !== userMessage.id
      ), // Exclude current message
      metadata: {
        total_messages: 0,
        channels: channelInfo,
        search_time_ms: 0,
        token_count: 0,
        conversationId: conversation.id,
      },
    };

    if (stream) {
      // Set headers for streaming response
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Cache-Control',
      });

      try {
        // Create assistant message placeholder
        const assistantMessage = conversationService.addMessage(
          conversation.id,
          {
            role: 'assistant',
            content: '',
          }
        );

        // Stream the response
        let accumulatedContent = '';

        for await (const chunk of llmService.streamConversationQuery(
          llmContext
        )) {
          if (chunk.content) {
            accumulatedContent += chunk.content;
          }

          const streamChunk: StreamChunkDto = {
            conversationId: conversation.id,
            messageId: assistantMessage.id,
            content: chunk.content || '',
            done: chunk.done || false,
            metadata: chunk.usage
              ? {
                  tokenUsage: {
                    prompt: chunk.usage.promptTokens,
                    completion: chunk.usage.completionTokens,
                    total: chunk.usage.totalTokens,
                  },
                }
              : undefined,
          };

          res.write(`data: ${JSON.stringify(streamChunk)}\n\n`);

          if (chunk.done) {
            // Update the assistant message with final content and metadata
            conversationService.updateMessage(
              conversation.id,
              assistantMessage.id,
              {
                content: accumulatedContent,
                metadata: {
                  tokenUsage: chunk.usage
                    ? {
                        prompt: chunk.usage.promptTokens,
                        completion: chunk.usage.completionTokens,
                        total: chunk.usage.totalTokens,
                      }
                    : undefined,
                  processingTime: Date.now() - startTime,
                },
              }
            );

            res.write('data: [DONE]\n\n');
            break;
          }
        }
      } catch (error) {
        const errorData = JSON.stringify({
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        res.write(`data: ${errorData}\n\n`);
      } finally {
        res.end();
      }
    } else {
      // Regular non-streaming response
      const result = await llmService.processConversationQuery(llmContext);

      const responseTime = Date.now() - startTime;

      // Add assistant message to conversation
      const assistantMessage = conversationService.addMessage(conversation.id, {
        role: 'assistant',
        content: result.response,
        metadata: {
          tokenUsage: {
            prompt: result.usage.promptTokens,
            completion: result.usage.completionTokens,
            total: result.usage.totalTokens,
          },
          processingTime: responseTime,
          llmProvider: result.provider,
          model: result.model,
          toolCalls: result.toolCalls,
          intermediateSteps: result.intermediateSteps,
        },
      });

      const chatResponse: ChatResponseDto = {
        conversationId: conversation.id,
        message: {
          ...assistantMessage,
          timestamp: assistantMessage.timestamp.toISOString(),
        },
        conversation: {
          ...conversation,
          messages: conversation.messages.map(msg => ({
            ...msg,
            timestamp: msg.timestamp.toISOString(),
          })),
          createdAt: conversation.createdAt.toISOString(),
          updatedAt: conversation.updatedAt.toISOString(),
        },
      };

      logger.info('Chat message processed successfully', {
        conversationId: conversation.id,
        responseTime,
        provider: result.provider,
        model: result.model,
        usage: result.usage,
      });

      res.json({
        status: 'success',
        data: chatResponse,
      });
    }
  } catch (error) {
    logger.error('Chat message processing failed', error as Error, {
      conversationId: req.body.conversationId,
      message: req.body.message?.substring(0, 100),
      channels: req.body.channels,
    });

    if (res.headersSent) {
      // If streaming, send error through stream
      const errorData = JSON.stringify({
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      res.write(`data: ${errorData}\n\n`);
      res.end();
    } else {
      res.status(500).json({
        status: 'error',
        message: 'Chat message processing failed',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
});

// GET /chat - List all conversations
router.get('/', async (req, res) => {
  try {
    const conversationList = conversationService.listConversations();

    const response: ConversationListDto = {
      conversations: conversationList.conversations.map(conv => ({
        ...conv,
        createdAt: conv.createdAt.toISOString(),
        updatedAt: conv.updatedAt.toISOString(),
      })),
      total: conversationList.total,
    };

    res.json({
      status: 'success',
      data: response,
    });
  } catch (error) {
    logger.error('Failed to list conversations', error as Error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to list conversations',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// GET /chat/:conversationId - Get conversation history
router.get('/:conversationId', async (req, res) => {
  try {
    const { conversationId } = req.params;
    const conversation = conversationService.getConversation(conversationId);

    if (!conversation) {
      res.status(404).json({
        status: 'error',
        message: 'Conversation not found',
      });
      return;
    }

    const conversationDto = {
      ...conversation,
      messages: conversation.messages.map(msg => ({
        ...msg,
        timestamp: msg.timestamp.toISOString(),
      })),
      createdAt: conversation.createdAt.toISOString(),
      updatedAt: conversation.updatedAt.toISOString(),
    };

    res.json({
      status: 'success',
      data: conversationDto,
    });
  } catch (error) {
    logger.error('Failed to get conversation', error as Error, {
      conversationId: req.params.conversationId,
    });
    res.status(500).json({
      status: 'error',
      message: 'Failed to get conversation',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// DELETE /chat/:conversationId - Delete a conversation
router.delete('/:conversationId', async (req, res) => {
  try {
    const { conversationId } = req.params;
    const deleted = conversationService.deleteConversation(conversationId);

    if (!deleted) {
      res.status(404).json({
        status: 'error',
        message: 'Conversation not found',
      });
      return;
    }

    res.json({
      status: 'success',
      data: { deleted: true },
    });
  } catch (error) {
    logger.error('Failed to delete conversation', error as Error, {
      conversationId: req.params.conversationId,
    });
    res.status(500).json({
      status: 'error',
      message: 'Failed to delete conversation',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// POST /chat/new - Create a new conversation with same settings
router.post('/new', async (req, res) => {
  try {
    const { channels, options } = req.body;

    if (!channels || !Array.isArray(channels) || channels.length === 0) {
      res.status(400).json({
        status: 'error',
        message: 'Channels array is required',
      });
      return;
    }

    const conversation = conversationService.createConversation(
      channels,
      options || {
        includeFiles: false,
        includeThreads: true,
      }
    );

    const conversationDto = {
      ...conversation,
      messages: [],
      createdAt: conversation.createdAt.toISOString(),
      updatedAt: conversation.updatedAt.toISOString(),
    };

    res.json({
      status: 'success',
      data: conversationDto,
    });
  } catch (error) {
    logger.error('Failed to create new conversation', error as Error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to create new conversation',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export { router as chatRouter };
