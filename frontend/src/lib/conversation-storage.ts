import { Conversation, ConversationSummary } from '@/types/chat';

const STORAGE_KEY = 'slack-knowledge-agent-conversations';
const CURRENT_CONVERSATION_KEY = 'slack-knowledge-agent-current-conversation';
const SELECTED_CHANNELS_KEY = 'slack-knowledge-agent-selected-channels';

/**
 * Utility class for managing conversation persistence in localStorage
 */
export class ConversationStorage {
  /**
   * Save a conversation to localStorage
   */
  static saveConversation(conversation: Conversation): void {
    try {
      const conversations = this.loadConversations();
      const existingIndex = conversations.findIndex(
        c => c.id === conversation.id
      );

      if (existingIndex >= 0) {
        conversations[existingIndex] = conversation;
      } else {
        conversations.push(conversation);
      }

      localStorage.setItem(STORAGE_KEY, JSON.stringify(conversations));
    } catch (error) {
      console.error('Failed to save conversation:', error);
    }
  }

  /**
   * Load all conversations from localStorage
   */
  static loadConversations(): Conversation[] {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) return [];

      const conversations = JSON.parse(stored) as Conversation[];
      // Sort by updatedAt descending
      return conversations.sort(
        (a, b) =>
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      );
    } catch (error) {
      console.error('Failed to load conversations:', error);
      return [];
    }
  }

  /**
   * Get conversation summaries (without full message content)
   */
  static getConversationSummaries(): ConversationSummary[] {
    const conversations = this.loadConversations();
    return conversations.map(conv => ({
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
    }));
  }

  /**
   * Load a specific conversation
   */
  static loadConversation(conversationId: string): Conversation | null {
    try {
      const conversations = this.loadConversations();
      return conversations.find(c => c.id === conversationId) || null;
    } catch (error) {
      console.error('Failed to load conversation:', error);
      return null;
    }
  }

  /**
   * Delete a conversation
   */
  static deleteConversation(conversationId: string): void {
    try {
      const conversations = this.loadConversations();
      const filtered = conversations.filter(c => c.id !== conversationId);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));

      // Clear current conversation if it was deleted
      const currentId = this.getCurrentConversationId();
      if (currentId === conversationId) {
        this.setCurrentConversationId(null);
      }
    } catch (error) {
      console.error('Failed to delete conversation:', error);
    }
  }

  /**
   * Save current conversation ID
   */
  static setCurrentConversationId(conversationId: string | null): void {
    try {
      if (conversationId) {
        localStorage.setItem(CURRENT_CONVERSATION_KEY, conversationId);
      } else {
        localStorage.removeItem(CURRENT_CONVERSATION_KEY);
      }
    } catch (error) {
      console.error('Failed to save current conversation ID:', error);
    }
  }

  /**
   * Load current conversation ID
   */
  static getCurrentConversationId(): string | null {
    try {
      return localStorage.getItem(CURRENT_CONVERSATION_KEY);
    } catch (error) {
      console.error('Failed to load current conversation ID:', error);
      return null;
    }
  }

  /**
   * Save selected channels
   */
  static setSelectedChannels(channels: string[]): void {
    try {
      localStorage.setItem(SELECTED_CHANNELS_KEY, JSON.stringify(channels));
    } catch (error) {
      console.error('Failed to save selected channels:', error);
    }
  }

  /**
   * Load selected channels
   */
  static getSelectedChannels(): string[] {
    try {
      const stored = localStorage.getItem(SELECTED_CHANNELS_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      console.error('Failed to load selected channels:', error);
      return [];
    }
  }

  /**
   * Clear all stored data
   */
  static clearAll(): void {
    try {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(CURRENT_CONVERSATION_KEY);
      localStorage.removeItem(SELECTED_CHANNELS_KEY);
    } catch (error) {
      console.error('Failed to clear storage:', error);
    }
  }

  /**
   * Export conversations as JSON
   */
  static exportConversations(): string {
    const conversations = this.loadConversations();
    return JSON.stringify(conversations, null, 2);
  }

  /**
   * Import conversations from JSON
   */
  static importConversations(jsonData: string): boolean {
    try {
      const conversations = JSON.parse(jsonData) as Conversation[];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(conversations));
      return true;
    } catch (error) {
      console.error('Failed to import conversations:', error);
      return false;
    }
  }
}
