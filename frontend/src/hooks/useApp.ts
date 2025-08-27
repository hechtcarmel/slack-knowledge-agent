import { useCallback } from 'react';
import { useUIStore, useErrorStore, useChannelStore } from '@/stores';
import { useChatManager } from './useChatManager';
import { useChannelSelection } from './useChannelSelection';
import { useResponsiveLayout } from './useResponsiveLayout';
import { ConversationOptions } from '@/types/chat';

/**
 * Simplified app hook - now just coordinates between stores and managers
 * Components should primarily use stores directly for better performance
 */
export function useApp() {
  // Store selectors - only what this hook actually needs
  const toggleMobileSidebar = useUIStore((state) => state.toggleMobileSidebar);
  const closeMobileSidebar = useUIStore((state) => state.closeMobileSidebar);
  const setError = useErrorStore((state) => state.setError);
  const clearAllErrors = useErrorStore((state) => state.clearAllErrors);
  const selectedChannelIds = useChannelStore((state) => state.selectedChannelIds);

  // Layout management (keep existing responsive behavior)
  const layoutManager = useResponsiveLayout();

  // Channel selection management
  const channelManager = useChannelSelection();

  // Chat management (simplified - no context integration)
  const chatManager = useChatManager();

  // Main chat action - sends message with current channel selection
  const sendMessage = useCallback(
    async (message: string, options?: Partial<ConversationOptions>) => {
      if (selectedChannelIds.length === 0) {
        setError('chat', 'Please select at least one channel');
        return;
      }

      const conversationOptions: ConversationOptions = {
        includeFiles: false,
        includeThreads: true,
        ...options,
      };

      await chatManager.sendMessage(message, selectedChannelIds, conversationOptions);
    },
    [selectedChannelIds, chatManager, setError]
  );

  // Start new conversation
  const startNewConversation = useCallback(() => {
    chatManager.startNewConversation();
    clearAllErrors();
  }, [chatManager, clearAllErrors]);

  // Handle mobile actions (actions that should close sidebar on mobile)
  const handleMobileAction = useCallback(
    (callback?: () => void) => {
      layoutManager.handleMobileAction(callback);
    },
    [layoutManager]
  );

  return {
    // Layout
    layout: layoutManager,

    // Channels
    channels: channelManager,

    // Chat
    chat: chatManager,

    // Actions
    sendMessage,
    startNewConversation,
    toggleMobileSidebar,
    closeMobileSidebar,
    handleMobileAction,
  };
}
