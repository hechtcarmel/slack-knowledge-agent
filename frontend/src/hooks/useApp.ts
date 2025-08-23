import { useEffect, useCallback } from 'react';
import { useAppState } from '@/contexts/AppStateContext';
import { useChatManager } from './useChatManager';
import { useChannelSelection } from './useChannelSelection';
import { useResponsiveLayout } from './useResponsiveLayout';
import { useErrorHandler } from './useErrorHandler';
import { ConversationOptions } from '@/types/chat';

/**
 * Main app hook that orchestrates all app-level state and business logic
 * This is the primary hook that components should use to interact with app state
 */
export function useApp() {
  const { state, dispatch } = useAppState();
  const { handleError } = useErrorHandler({ component: 'useApp' });

  // Layout management
  const layoutManager = useResponsiveLayout();

  // Channel selection management
  const channelManager = useChannelSelection();

  // Chat management with integrated error handling
  const chatManager = useChatManager({
    onMessageSent: message => {
      dispatch({ type: 'ADD_CHAT_MESSAGE', payload: message });
    },
    onResponseReceived: message => {
      dispatch({ type: 'ADD_CHAT_MESSAGE', payload: message });
    },
    onError: error => {
      dispatch({ type: 'SET_CHAT_ERROR', payload: error.message });
    },
  });

  // Sync mobile sidebar state with layout manager
  useEffect(() => {
    if (layoutManager.isMobileSidebarOpen !== state.ui.isMobileSidebarOpen) {
      dispatch({
        type: 'SET_MOBILE_SIDEBAR',
        payload: layoutManager.isMobileSidebarOpen,
      });
    }
  }, [
    layoutManager.isMobileSidebarOpen,
    state.ui.isMobileSidebarOpen,
    dispatch,
  ]);

  // Sync loading states
  useEffect(() => {
    const isLoading = chatManager.isLoading || channelManager.isLoading;
    if (isLoading !== state.ui.isLoading) {
      dispatch({ type: 'SET_LOADING', payload: isLoading });
    }
  }, [
    chatManager.isLoading,
    channelManager.isLoading,
    state.ui.isLoading,
    dispatch,
  ]);

  // Handle channel selection errors
  useEffect(() => {
    if (channelManager.error) {
      const errorMessage =
        channelManager.error instanceof Error
          ? channelManager.error.message
          : 'Failed to load channels';
      dispatch({ type: 'SET_CHANNELS_ERROR', payload: errorMessage });
    } else {
      dispatch({ type: 'SET_CHANNELS_ERROR', payload: null });
    }
  }, [channelManager.error, dispatch]);

  // Handle chat errors
  useEffect(() => {
    if (chatManager.error) {
      const errorMessage =
        chatManager.error instanceof Error
          ? chatManager.error.message
          : 'Chat error occurred';
      dispatch({ type: 'SET_CHAT_ERROR', payload: errorMessage });
    } else {
      dispatch({ type: 'SET_CHAT_ERROR', payload: null });
    }
  }, [chatManager.error, dispatch]);

  // Main chat action - sends message with current channel selection
  const sendMessage = useCallback(
    async (message: string, options?: Partial<ConversationOptions>) => {
      if (channelManager.selectedChannelIds.length === 0) {
        handleError(new Error('Please select at least one channel'), {
          action: 'send_message',
        });
        return;
      }

      const conversationOptions: ConversationOptions = {
        includeFiles: false,
        includeThreads: true,
        ...options,
      };

      await chatManager.sendMessage(
        message,
        channelManager.selectedChannelIds,
        conversationOptions
      );
    },
    [channelManager.selectedChannelIds, chatManager, handleError]
  );

  // Start new conversation
  const startNewConversation = useCallback(() => {
    chatManager.startNewConversation();
    dispatch({ type: 'CLEAR_CHAT_MESSAGES' });
    dispatch({ type: 'CLEAR_ALL_ERRORS' });
  }, [chatManager, dispatch]);

  // Toggle mobile sidebar
  const toggleMobileSidebar = useCallback(() => {
    layoutManager.toggleMobileSidebar();
  }, [layoutManager]);

  // Close mobile sidebar
  const closeMobileSidebar = useCallback(() => {
    layoutManager.closeMobileSidebar();
  }, [layoutManager]);

  // Handle mobile actions (actions that should close sidebar on mobile)
  const handleMobileAction = useCallback(
    (callback?: () => void) => {
      layoutManager.handleMobileAction(callback);
    },
    [layoutManager]
  );

  // Clear specific error
  const clearError = useCallback(
    (errorType: 'global' | 'chat' | 'channels' | 'all') => {
      switch (errorType) {
        case 'global':
          dispatch({ type: 'SET_GLOBAL_ERROR', payload: null });
          break;
        case 'chat':
          dispatch({ type: 'SET_CHAT_ERROR', payload: null });
          break;
        case 'channels':
          dispatch({ type: 'SET_CHANNELS_ERROR', payload: null });
          break;
        case 'all':
          dispatch({ type: 'CLEAR_ALL_ERRORS' });
          break;
      }
    },
    [dispatch]
  );

  // Get combined error state
  const hasAnyError = !!(
    state.error.global ||
    state.error.chat ||
    state.error.channels
  );
  const currentError =
    state.error.global || state.error.chat || state.error.channels;

  return {
    // State
    ui: state.ui,
    error: state.error,
    hasAnyError,
    currentError,

    // Layout
    layout: layoutManager,

    // Channels
    channels: channelManager,

    // Chat
    chat: {
      ...chatManager,
      messages: chatManager.messages,
      currentConversation: chatManager.currentConversation,
      isAiTyping: chatManager.isAiTyping,
      isLoading: chatManager.isLoading,
    },

    // Actions
    sendMessage,
    startNewConversation,
    toggleMobileSidebar,
    closeMobileSidebar,
    handleMobileAction,
    clearError,

    // Combined loading state
    isLoading: state.ui.isLoading,

    // Direct dispatch for advanced usage
    dispatch,
  };
}
