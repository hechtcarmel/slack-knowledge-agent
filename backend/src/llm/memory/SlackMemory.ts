import { BaseMemory } from '@langchain/core/memory';
import {
  InputValues,
  MemoryVariables,
  OutputValues,
} from '@langchain/core/memory';
import { BaseChatMessageHistory } from '@langchain/core/chat_history';
import { HumanMessage, AIMessage, BaseMessage } from '@langchain/core/messages';

// Create a simple in-memory chat history implementation
class InMemoryChatMessageHistory extends BaseChatMessageHistory {
  lc_namespace = ['langchain', 'memory', 'chat_message_histories'];
  private messages: BaseMessage[] = [];

  async getMessages(): Promise<BaseMessage[]> {
    return this.messages;
  }

  async addMessage(message: BaseMessage): Promise<void> {
    this.messages.push(message);
  }

  async addUserMessage(message: string): Promise<void> {
    await this.addMessage(new HumanMessage(message));
  }

  async addAIChatMessage(message: string): Promise<void> {
    await this.addMessage(new AIMessage(message));
  }

  async clear(): Promise<void> {
    this.messages = [];
  }
}
import { Logger } from '@/utils/logger.js';

export interface SlackMemoryConfig {
  maxTokens?: number;
  maxMessages?: number;
  sessionId?: string;
  compressionEnabled?: boolean;
  compressionThreshold?: number;
}

/**
 * Chat message from frontend
 */
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  metadata?: any;
}

export class SlackConversationMemory extends BaseMemory {
  protected chatHistory = new InMemoryChatMessageHistory();
  protected maxMessages: number;
  protected maxTokens: number;
  public sessionId?: string;
  protected logger = Logger.create('SlackMemory');
  private compressionEnabled: boolean;
  private compressionThreshold: number;

  memoryKeys = ['chat_history'];

  constructor(config: SlackMemoryConfig = {}) {
    super();
    this.maxMessages = config.maxMessages || 20;
    this.maxTokens = config.maxTokens || 2000; // Reasonable default for context window
    this.sessionId = config.sessionId;
    this.compressionEnabled = config.compressionEnabled ?? true;
    this.compressionThreshold = config.compressionThreshold ?? 0.8; // Compress at 80% of token limit
  }

  async loadMemoryVariables(_values: InputValues): Promise<MemoryVariables> {
    const messages = await this.chatHistory.getMessages();

    // Implement truncation to stay within limits
    const truncatedMessages = this.truncateMessages(messages);

    this.logger.debug('Loading memory variables', {
      originalMessageCount: messages.length,
      truncatedMessageCount: truncatedMessages.length,
      sessionId: this.sessionId,
    });

    return {
      chat_history: truncatedMessages,
    };
  }

  async saveContext(
    inputValues: InputValues,
    outputValues: OutputValues
  ): Promise<void> {
    const input = inputValues.input || inputValues.question;
    const output = outputValues.output || outputValues.answer;

    if (input) {
      await this.chatHistory.addMessage(new HumanMessage(input));
      this.logger.debug('Saved human message to memory', {
        messageLength: input.length,
        sessionId: this.sessionId,
      });
    }

    if (output) {
      await this.chatHistory.addMessage(new AIMessage(output));
      this.logger.debug('Saved AI message to memory', {
        messageLength: output.length,
        sessionId: this.sessionId,
      });
    }
  }

  async clear(): Promise<void> {
    await this.chatHistory.clear();
    this.logger.info('Memory cleared', {
      sessionId: this.sessionId,
    });
  }

  /**
   * Get the current message count in memory
   */
  async getMessageCount(): Promise<number> {
    const messages = await this.chatHistory.getMessages();
    return messages.length;
  }

  /**
   * Truncate messages to stay within token and message limits
   */
  private truncateMessages(messages: BaseMessage[]): BaseMessage[] {
    // Keep current simple logic as primary approach
    if (messages.length <= this.maxMessages) {
      return messages;
    }

    let truncated = messages.slice(-this.maxMessages);

    // Simple token check - if too long, reduce message count
    const estimatedTokens = this.estimateTokenCount(truncated);
    if (estimatedTokens > this.maxTokens) {
      // Reduce to fewer messages if token limit exceeded
      const targetMessages = Math.floor(this.maxMessages * 0.7); // 70% of max
      truncated = messages.slice(-targetMessages);

      this.logger.info('Messages further truncated due to token limit', {
        originalCount: messages.length,
        afterMessageLimit: this.maxMessages,
        finalCount: truncated.length,
        estimatedTokens: estimatedTokens,
        maxTokens: this.maxTokens,
        sessionId: this.sessionId,
      });
    } else {
      this.logger.info('Messages truncated by message count only', {
        originalCount: messages.length,
        truncatedCount: truncated.length,
        estimatedTokens: estimatedTokens,
        maxMessages: this.maxMessages,
        sessionId: this.sessionId,
      });
    }

    return truncated;
  }

  /**
   * Estimate token count for messages using simple heuristic
   */
  protected estimateTokenCount(messages: BaseMessage[]): number {
    // Simple estimation: ~4 characters per token (OpenAI standard)
    const totalChars = messages
      .map(msg => msg.content.toString().length)
      .reduce((sum, len) => sum + len, 0);
    return Math.ceil(totalChars / 4);
  }

  /**
   * Synchronize memory with frontend conversation history
   * This rebuilds the memory from the frontend's message history
   */
  public async syncWithFrontendHistory(messages: ChatMessage[]): Promise<void> {
    if (!messages || messages.length === 0) {
      this.logger.debug('No frontend history to sync');
      return;
    }

    this.logger.debug('Syncing with frontend history', {
      messageCount: messages.length,
      sessionId: this.sessionId,
    });

    // Clear existing memory
    await this.clear();

    // Add messages from frontend history
    for (const message of messages) {
      try {
        if (message.role === 'user') {
          await this.chatHistory.addUserMessage(message.content);
        } else if (message.role === 'assistant') {
          await this.chatHistory.addAIChatMessage(message.content);
        }
      } catch (error) {
        this.logger.warn('Failed to add message to memory', {
          messageId: message.id,
          role: message.role,
          error: (error as Error).message,
        });
      }
    }

    // Check if compression is needed after sync
    const currentMessages = await this.chatHistory.getMessages();
    if (this.shouldCompress(currentMessages)) {
      await this.compressOldMessages();
    }

    this.logger.info('Frontend history synced successfully', {
      originalCount: messages.length,
      finalCount: (await this.chatHistory.getMessages()).length,
      sessionId: this.sessionId,
    });
  }

  /**
   * Add a new message pair (user input + AI response) to memory
   */
  public async addMessageExchange(userMessage: string, aiResponse: string): Promise<void> {
    await this.chatHistory.addUserMessage(userMessage);
    await this.chatHistory.addAIChatMessage(aiResponse);

    // Check if compression is needed
    const messages = await this.chatHistory.getMessages();
    if (this.shouldCompress(messages)) {
      await this.compressOldMessages();
    }

    this.logger.debug('Message exchange added to memory', {
      userMessageLength: userMessage.length,
      aiResponseLength: aiResponse.length,
      totalMessages: messages.length,
      sessionId: this.sessionId,
    });
  }

  /**
   * Compress old messages when approaching token/message limits
   */
  public async compressOldMessages(): Promise<void> {
    if (!this.compressionEnabled) {
      return;
    }

    const messages = await this.chatHistory.getMessages();
    
    if (messages.length <= 6) { // Keep at least 3 exchanges
      return;
    }

    this.logger.info('Starting message compression', {
      originalCount: messages.length,
      sessionId: this.sessionId,
    });

    // Keep the most recent messages and create a summary of older ones
    const recentMessages = messages.slice(-4); // Keep last 2 exchanges
    const oldMessages = messages.slice(0, -4);

    if (oldMessages.length === 0) {
      return;
    }

    // Create a simple summary of old messages
    const summary = this.createMessageSummary(oldMessages);

    // Clear and rebuild with summary + recent messages
    await this.chatHistory.clear();
    
    // Add summary as system context
    if (summary) {
      await this.chatHistory.addMessage(new AIMessage(
        `Previous conversation summary: ${summary}`
      ));
    }

    // Re-add recent messages
    for (const message of recentMessages) {
      await this.chatHistory.addMessage(message);
    }

    const finalMessages = await this.chatHistory.getMessages();
    this.logger.info('Message compression completed', {
      originalCount: messages.length,
      compressedCount: oldMessages.length,
      finalCount: finalMessages.length,
      sessionId: this.sessionId,
    });
  }

  /**
   * Get conversation summary for context
   */
  public async getConversationSummary(): Promise<string> {
    const messages = await this.chatHistory.getMessages();
    
    if (messages.length === 0) {
      return 'No conversation history.';
    }

    // Create a simple summary
    const userMessages = messages.filter(m => m instanceof HumanMessage);
    const aiMessages = messages.filter(m => m instanceof AIMessage);

    const topics = this.extractTopics(messages);
    
    return [
      `Conversation with ${userMessages.length} user questions and ${aiMessages.length} responses.`,
      topics.length > 0 ? `Main topics: ${topics.join(', ')}.` : '',
      `Started: recently`,
    ].filter(Boolean).join(' ');
  }

  /**
   * Get detailed memory statistics
   */
  public async getDetailedStats(): Promise<{
    messageCount: number;
    estimatedTokens: number;
    memoryUtilization: number;
    sessionId?: string;
    compressionEnabled: boolean;
  }> {
    const messages = await this.chatHistory.getMessages();
    const estimatedTokens = this.estimateTokenCount(messages);
    
    return {
      messageCount: messages.length,
      estimatedTokens,
      memoryUtilization: Math.min(1.0, estimatedTokens / this.maxTokens),
      sessionId: this.sessionId,
      compressionEnabled: this.compressionEnabled,
    };
  }

  /**
   * Check if compression should be triggered
   */
  private shouldCompress(messages: BaseMessage[]): boolean {
    if (!this.compressionEnabled) {
      return false;
    }

    // Check message count threshold
    if (messages.length >= this.maxMessages) {
      return true;
    }

    // Check token threshold
    const estimatedTokens = this.estimateTokenCount(messages);
    const tokenThreshold = this.maxTokens * this.compressionThreshold;
    
    return estimatedTokens >= tokenThreshold;
  }

  /**
   * Create a summary of messages for compression
   */
  private createMessageSummary(messages: BaseMessage[]): string {
    if (messages.length === 0) {
      return '';
    }

    const userQuestions: string[] = [];

    for (const message of messages) {
      if (message instanceof HumanMessage) {
        const content = message.content.toString();
        // Extract key phrases or topics
        if (content.length > 0) {
          userQuestions.push(content.substring(0, 50) + '...');
        }
      }
    }

    const summary = [
      `Earlier in this conversation, the user asked about: ${userQuestions.slice(0, 3).join('; ')}.`,
      messages.length > 6 ? `Total of ${Math.floor(messages.length / 2)} question-answer exchanges.` : '',
    ].filter(Boolean).join(' ');

    return summary;
  }

  /**
   * Extract main topics from messages
   */
  private extractTopics(messages: BaseMessage[]): string[] {
    const topics: string[] = [];
    
    for (const message of messages) {
      if (message instanceof HumanMessage) {
        const content = message.content.toString().toLowerCase();
        
        // Simple keyword extraction
        if (content.includes('channel') || content.includes('slack')) {
          topics.push('Slack channels');
        }
        if (content.includes('file') || content.includes('document')) {
          topics.push('files');
        }
        if (content.includes('user') || content.includes('member')) {
          topics.push('users');
        }
        if (content.includes('message') || content.includes('thread')) {
          topics.push('messages');
        }
      }
    }

    // Remove duplicates and limit
    return [...new Set(topics)].slice(0, 3);
  }
}
