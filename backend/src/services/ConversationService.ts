import { randomUUID } from 'crypto';
import { Logger } from '@/utils/logger.js';
import {
  Conversation,
  ChatMessage,
  ConversationOptions,
  ConversationSummary,
  ConversationList,
} from '@/types/chat.js';
import { IInitializableService } from '@/core/container/interfaces.js';

/**
 * Configuration for conversation service
 */
export interface ConversationServiceConfig {
  maxConversations: number;
  maxMessagesPerConversation: number;
  conversationTimeoutMs: number;
  enablePersistence: boolean;
}

/**
 * Service for managing conversations and chat history
 *
 * Handles conversation lifecycle, message storage, and context management
 * for the chat interface. Currently uses in-memory storage with plans
 * for database persistence.
 */
export class ConversationService implements IInitializableService {
  private logger = Logger.create('ConversationService');
  private conversations = new Map<string, Conversation>();
  private conversationAccessTimes = new Map<string, number>();
  private config: ConversationServiceConfig = {
    maxConversations: 1000,
    maxMessagesPerConversation: 100,
    conversationTimeoutMs: 24 * 60 * 60 * 1000, // 24 hours
    enablePersistence: false, // In-memory for now
  };

  constructor(config?: Partial<ConversationServiceConfig>) {
    if (config) {
      this.config = { ...this.config, ...config };
    }
  }

  /**
   * Initialize the conversation service
   */
  public async initialize(): Promise<void> {
    this.logger.info('ConversationService initialized', {
      maxConversations: this.config.maxConversations,
      maxMessages: this.config.maxMessagesPerConversation,
      persistence: this.config.enablePersistence,
    });

    // Start cleanup interval for old conversations
    this.startCleanupInterval();
  }

  /**
   * Create a new conversation
   */
  public createConversation(
    channels: string[],
    options: ConversationOptions
  ): Conversation {
    const conversation: Conversation = {
      id: randomUUID(),
      messages: [],
      channels,
      options,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.conversations.set(conversation.id, conversation);
    this.updateAccessTime(conversation.id);

    this.logger.info('Created new conversation', {
      conversationId: conversation.id,
      channels,
      options,
    });

    return conversation;
  }

  /**
   * Get a conversation by ID
   */
  public getConversation(conversationId: string): Conversation | null {
    const conversation = this.conversations.get(conversationId);
    if (conversation) {
      this.updateAccessTime(conversationId);
    }
    return conversation || null;
  }

  /**
   * Add a message to a conversation
   */
  public addMessage(
    conversationId: string,
    message: Omit<ChatMessage, 'id' | 'timestamp'>
  ): ChatMessage {
    const conversation = this.getConversation(conversationId);
    if (!conversation) {
      throw new Error(`Conversation ${conversationId} not found`);
    }

    // Check message limit
    if (
      conversation.messages.length >= this.config.maxMessagesPerConversation
    ) {
      this.logger.warn(
        'Conversation reached message limit, removing oldest messages',
        {
          conversationId,
          currentCount: conversation.messages.length,
          limit: this.config.maxMessagesPerConversation,
        }
      );

      // Remove oldest messages to make room (keep at least 2 messages for context)
      const messagesToRemove =
        conversation.messages.length -
        this.config.maxMessagesPerConversation +
        1;
      conversation.messages = conversation.messages.slice(messagesToRemove);
    }

    const chatMessage: ChatMessage = {
      id: randomUUID(),
      timestamp: new Date(),
      ...message,
    };

    conversation.messages.push(chatMessage);
    conversation.updatedAt = new Date();

    // Auto-generate title from first user message
    if (
      !conversation.title &&
      message.role === 'user' &&
      conversation.messages.length === 1
    ) {
      conversation.title = this.generateConversationTitle(message.content);
    }

    this.updateAccessTime(conversationId);

    this.logger.debug('Added message to conversation', {
      conversationId,
      messageId: chatMessage.id,
      role: message.role,
      contentLength: message.content.length,
    });

    return chatMessage;
  }

  /**
   * Get conversation history for LLM context
   * Returns the most recent messages within token limits
   */
  public getConversationContext(
    conversationId: string,
    maxTokens: number = 2000
  ): ChatMessage[] {
    const conversation = this.getConversation(conversationId);
    if (!conversation) {
      return [];
    }

    // Estimate tokens and truncate if necessary
    let totalTokens = 0;
    const contextMessages: ChatMessage[] = [];

    // Process messages in reverse order (newest first)
    for (let i = conversation.messages.length - 1; i >= 0; i--) {
      const message = conversation.messages[i];
      const estimatedTokens = Math.ceil(message.content.length / 4);

      if (
        totalTokens + estimatedTokens > maxTokens &&
        contextMessages.length > 0
      ) {
        break;
      }

      contextMessages.unshift(message);
      totalTokens += estimatedTokens;
    }

    this.logger.debug('Generated conversation context', {
      conversationId,
      totalMessages: conversation.messages.length,
      contextMessages: contextMessages.length,
      estimatedTokens: totalTokens,
    });

    return contextMessages;
  }

  /**
   * List all conversations with summary information
   */
  public listConversations(): ConversationList {
    const summaries: ConversationSummary[] = Array.from(
      this.conversations.values()
    )
      .map(conv => ({
        id: conv.id,
        title: conv.title,
        lastMessage:
          conv.messages.length > 0
            ? conv.messages[conv.messages.length - 1].content.substring(0, 100)
            : undefined,
        messageCount: conv.messages.length,
        channels: conv.channels,
        createdAt: conv.createdAt,
        updatedAt: conv.updatedAt,
      }))
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());

    return {
      conversations: summaries,
      total: summaries.length,
    };
  }

  /**
   * Delete a conversation
   */
  public deleteConversation(conversationId: string): boolean {
    const deleted = this.conversations.delete(conversationId);
    this.conversationAccessTimes.delete(conversationId);

    if (deleted) {
      this.logger.info('Deleted conversation', { conversationId });
    }

    return deleted;
  }

  /**
   * Update conversation channels
   */
  public updateConversationChannels(
    conversationId: string,
    channels: string[]
  ): boolean {
    const conversation = this.getConversation(conversationId);
    if (!conversation) {
      return false;
    }

    conversation.channels = channels;
    conversation.updatedAt = new Date();

    this.logger.info('Updated conversation channels', {
      conversationId,
      channels,
    });

    return true;
  }

  /**
   * Update conversation options
   */
  public updateConversationOptions(
    conversationId: string,
    options: ConversationOptions
  ): boolean {
    const conversation = this.getConversation(conversationId);
    if (!conversation) {
      return false;
    }

    conversation.options = options;
    conversation.updatedAt = new Date();

    this.logger.info('Updated conversation options', {
      conversationId,
      options,
    });

    return true;
  }

  /**
   * Update a specific message in a conversation
   */
  public updateMessage(
    conversationId: string,
    messageId: string,
    updates: Partial<Pick<ChatMessage, 'content' | 'metadata'>>
  ): boolean {
    const conversation = this.getConversation(conversationId);
    if (!conversation) {
      return false;
    }

    const messageIndex = conversation.messages.findIndex(
      msg => msg.id === messageId
    );
    if (messageIndex === -1) {
      return false;
    }

    // Update the message
    const message = conversation.messages[messageIndex];
    if (updates.content !== undefined) {
      message.content = updates.content;
    }
    if (updates.metadata !== undefined) {
      message.metadata = { ...message.metadata, ...updates.metadata };
    }

    conversation.updatedAt = new Date();
    this.updateAccessTime(conversationId);

    this.logger.debug('Updated message in conversation', {
      conversationId,
      messageId,
      contentLength: message.content.length,
    });

    return true;
  }

  /**
   * Get service statistics
   */
  public getStats(): {
    totalConversations: number;
    totalMessages: number;
    averageMessagesPerConversation: number;
  } {
    const totalMessages = Array.from(this.conversations.values()).reduce(
      (sum, conv) => sum + conv.messages.length,
      0
    );

    return {
      totalConversations: this.conversations.size,
      totalMessages,
      averageMessagesPerConversation:
        this.conversations.size > 0
          ? Math.round((totalMessages / this.conversations.size) * 100) / 100
          : 0,
    };
  }

  /**
   * Generate a conversation title from the first user message
   */
  private generateConversationTitle(firstMessage: string): string {
    // Take first 50 characters and clean up
    let title = firstMessage.substring(0, 50).trim();

    // Remove incomplete words at the end
    const lastSpaceIndex = title.lastIndexOf(' ');
    if (lastSpaceIndex > 20) {
      title = title.substring(0, lastSpaceIndex);
    }

    // Add ellipsis if truncated
    if (title.length < firstMessage.length) {
      title += '...';
    }

    return title;
  }

  /**
   * Update conversation access time for cleanup
   */
  private updateAccessTime(conversationId: string): void {
    this.conversationAccessTimes.set(conversationId, Date.now());
  }

  /**
   * Start cleanup interval to remove old conversations
   */
  private startCleanupInterval(): void {
    setInterval(
      () => {
        this.cleanupOldConversations();
      },
      60 * 60 * 1000
    ); // Run every hour
  }

  /**
   * Remove old conversations that haven't been accessed recently
   */
  private cleanupOldConversations(): void {
    const now = Date.now();
    const cutoffTime = now - this.config.conversationTimeoutMs;

    let removedCount = 0;

    for (const [
      conversationId,
      lastAccess,
    ] of this.conversationAccessTimes.entries()) {
      if (lastAccess < cutoffTime) {
        this.conversations.delete(conversationId);
        this.conversationAccessTimes.delete(conversationId);
        removedCount++;
      }
    }

    if (removedCount > 0) {
      this.logger.info('Cleaned up old conversations', {
        removedCount,
        remainingConversations: this.conversations.size,
      });
    }

    // Also enforce max conversation limit
    if (this.conversations.size > this.config.maxConversations) {
      const conversationsToRemove =
        this.conversations.size - this.config.maxConversations;

      // Sort by access time and remove oldest
      const sortedByAccess = Array.from(this.conversationAccessTimes.entries())
        .sort((a, b) => a[1] - b[1])
        .slice(0, conversationsToRemove);

      for (const [conversationId] of sortedByAccess) {
        this.conversations.delete(conversationId);
        this.conversationAccessTimes.delete(conversationId);
      }

      this.logger.info('Enforced conversation limit', {
        removedCount: conversationsToRemove,
        limit: this.config.maxConversations,
      });
    }
  }
}
