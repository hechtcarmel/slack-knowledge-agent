import { useState, useCallback, useMemo } from 'react';
import { useSendMessageMutation } from './chat';
import { useErrorHandler } from './useErrorHandler';
import { ChatMessage, ConversationOptions, Conversation } from '@/types/chat';

export interface ChatManagerOptions {
  onMessageSent?: (message: ChatMessage) => void;
  onResponseReceived?: (message: ChatMessage) => void;
  onError?: (error: Error) => void;
}

/**
 * Custom hook for managing chat state and business logic
 * Handles message sending, conversation state, and AI interaction
 */
export function useChatManager(options: ChatManagerOptions = {}) {
  const { handleError } = useErrorHandler({ component: 'useChatManager' });
  const sendMessageMutation = useSendMessageMutation();

  // Chat state
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isAiTyping, setIsAiTyping] = useState(false);

  // Default conversation options
  const defaultOptions: ConversationOptions = {
    includeFiles: false,
    includeThreads: true,
  };

  // Send message to AI
  const sendMessage = useCallback(
    async (
      message: string,
      channels: string[],
      conversationOptions: ConversationOptions = defaultOptions
    ) => {
      if (!message.trim()) {
        handleError(new Error('Message cannot be empty'), {
          action: 'send_message',
        });
        return;
      }

      if (channels.length === 0) {
        handleError(new Error('Please select at least one channel'), {
          action: 'send_message',
        });
        return;
      }

      try {
        // Create user message
        const userMessage: ChatMessage = {
          id: `user-${Date.now()}`,
          role: 'user',
          content: message.trim(),
          timestamp: new Date().toISOString(),
        };

        // Add user message immediately to UI
        setMessages(prev => [...prev, userMessage]);
        options.onMessageSent?.(userMessage);

        // Show AI typing indicator
        setIsAiTyping(true);

        // Send to backend
        const response = await sendMessageMutation.mutateAsync({
          message: message.trim(),
          channels,
          options: conversationOptions,
          stream: false,
        });

        // Hide typing indicator
        setIsAiTyping(false);

        // Add AI response
        if (response.message) {
          const aiMessage: ChatMessage = {
            id: `ai-${Date.now()}`,
            role: 'assistant',
            content: response.message.content,
            timestamp: new Date().toISOString(),
            metadata: response.message.metadata,
          };

          setMessages(prev => [...prev, aiMessage]);
          options.onResponseReceived?.(aiMessage);
        }
      } catch (error) {
        setIsAiTyping(false);
        const errorMessage =
          error instanceof Error ? error.message : 'Failed to send message';
        handleError(new Error(errorMessage), { action: 'send_message' });
        options.onError?.(error as Error);
      }
    },
    [sendMessageMutation, handleError, options, defaultOptions]
  );

  // Create new conversation (clear messages)
  const startNewConversation = useCallback(() => {
    setMessages([]);
    setIsAiTyping(false);
  }, []);

  // Add message to conversation
  const addMessage = useCallback((message: ChatMessage) => {
    setMessages(prev => [...prev, message]);
  }, []);

  // Update message in conversation
  const updateMessage = useCallback(
    (messageId: string, updates: Partial<ChatMessage>) => {
      setMessages(prev =>
        prev.map(msg => (msg.id === messageId ? { ...msg, ...updates } : msg))
      );
    },
    []
  );

  // Remove message from conversation
  const removeMessage = useCallback((messageId: string) => {
    setMessages(prev => prev.filter(msg => msg.id !== messageId));
  }, []);

  // Get conversation object
  const currentConversation: Conversation | null = useMemo(() => {
    if (messages.length === 0) return null;

    return {
      id: 'current',
      title: 'Chat',
      messages,
      channels: [], // This will be set by the consuming component
      options: defaultOptions,
      createdAt: messages[0]?.timestamp || new Date().toISOString(),
      updatedAt:
        messages[messages.length - 1]?.timestamp || new Date().toISOString(),
    };
  }, [messages, defaultOptions]);

  // Chat statistics
  const chatStats = useMemo(
    () => ({
      totalMessages: messages.length,
      userMessages: messages.filter(m => m.role === 'user').length,
      assistantMessages: messages.filter(m => m.role === 'assistant').length,
      hasMessages: messages.length > 0,
      isActive: isAiTyping || sendMessageMutation.isPending,
    }),
    [messages, isAiTyping, sendMessageMutation.isPending]
  );

  // Loading states
  const isLoading = sendMessageMutation.isPending;
  const error = sendMessageMutation.error;

  return {
    // State
    messages,
    currentConversation,
    isAiTyping,
    isLoading,
    error,

    // Actions
    sendMessage,
    startNewConversation,
    addMessage,
    updateMessage,
    removeMessage,

    // Statistics
    chatStats,

    // Mutation object for advanced usage
    sendMessageMutation,
  };
}
