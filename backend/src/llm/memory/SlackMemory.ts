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
}

export class SlackConversationMemory extends BaseMemory {
  private chatHistory = new InMemoryChatMessageHistory();
  private maxMessages: number;
  private maxTokens: number;
  private sessionId?: string;
  private logger = Logger.create('SlackMemory');

  memoryKeys = ['chat_history'];

  constructor(config: SlackMemoryConfig = {}) {
    super();
    this.maxMessages = config.maxMessages || 20;
    this.maxTokens = config.maxTokens || 2000; // Reasonable default for context window
    this.sessionId = config.sessionId;
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
  private estimateTokenCount(messages: BaseMessage[]): number {
    // Simple estimation: ~4 characters per token (OpenAI standard)
    const totalChars = messages
      .map(msg => msg.content.toString().length)
      .reduce((sum, len) => sum + len, 0);
    return Math.ceil(totalChars / 4);
  }
}
