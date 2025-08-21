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
  private sessionId?: string;
  private logger = Logger.create('SlackMemory');

  memoryKeys = ['chat_history'];

  constructor(config: SlackMemoryConfig = {}) {
    super();
    this.maxMessages = config.maxMessages || 20;
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
    // Simple implementation - keep last N messages
    // In production, implement token-aware truncation
    if (messages.length <= this.maxMessages) {
      return messages;
    }

    const truncated = messages.slice(-this.maxMessages);

    this.logger.info('Messages truncated', {
      originalCount: messages.length,
      truncatedCount: truncated.length,
      maxMessages: this.maxMessages,
      sessionId: this.sessionId,
    });

    return truncated;
  }
}
