import { useState, useCallback, useMemo } from 'react';
import { useSendMessageMutation } from './chat';
import { useErrorStore } from '@/stores';
import { ChatMessage, ConversationOptions, Conversation } from '@/types/chat';
import { getOrCreateSessionId, clearSessionId } from '@/utils/session';

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
  const setError = useErrorStore((state) => state.setError);
  const clearError = useErrorStore((state) => state.clearError);
  const sendMessageMutation = useSendMessageMutation();

  // Chat state
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isAiTyping, setIsAiTyping] = useState(false);
  const [sessionId, setSessionId] = useState(() => getOrCreateSessionId());

  // Default conversation options
  const defaultOptions: ConversationOptions = useMemo(() => ({
    includeFiles: false,
    includeThreads: true,
  }), []);

  // Send message to AI
  const sendMessage = useCallback(
    async (
      message: string,
      channels: string[],
      conversationOptions: ConversationOptions = defaultOptions
    ) => {
      if (!message.trim()) {
        setError('chat', 'Message cannot be empty');
        return;
      }

      if (channels.length === 0) {
        setError('chat', 'Please select at least one channel');
        return;
      }

      try {
        // Clear previous chat errors
        clearError('chat');

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

        // Send to backend with conversation history
        const response = await sendMessageMutation.mutateAsync({
          sessionId,
          message: message.trim(),
          channels,
          options: conversationOptions,
          stream: false,
          conversationHistory: messages, // Include all previous messages for context
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
        setError('chat', errorMessage);
        options.onError?.(error as Error);
      }
    },
    [sendMessageMutation, setError, clearError, options.onMessageSent, options.onResponseReceived, options.onError, defaultOptions, sessionId, messages]
  );

  // Create new conversation (clear messages and create new session)
  const startNewConversation = useCallback(() => {
    setMessages([]);
    setIsAiTyping(false);
    const newSessionId = clearSessionId();
    setSessionId(newSessionId);
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
    sessionId,

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
