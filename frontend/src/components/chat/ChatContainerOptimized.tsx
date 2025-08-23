import React, { memo } from 'react';
import { ChatHeader } from './ChatHeaderOptimized';
import { ChatMessages } from './ChatMessagesOptimized';
import { ChatInputContainer } from './ChatInputContainerOptimized';
import { useApp } from '@/hooks/useApp';

/**
 * Optimized main chat container component with React.memo
 * Uses centralized state management and performance-optimized sub-components
 */
export const ChatContainer = memo(function ChatContainer() {
  const { chat, channels, error, sendMessage, startNewConversation, isLoading } = useApp();

  return (
    <div className="flex flex-col h-full w-full">
      {/* Header - optimized separately */}
      <ChatHeader
        conversation={chat.currentConversation}
        onNewConversation={startNewConversation}
        isLoading={isLoading}
        selectedChannelsCount={channels.selectedChannelIds.length}
      />

      {/* Messages Area - optimized separately */}
      <ChatMessages
        messages={chat.messages}
        isAiTyping={chat.isAiTyping}
        isLoading={isLoading}
        error={error.chat}
      />

      {/* Input Area - optimized separately */}
      <ChatInputContainer
        onSendMessage={sendMessage}
        isLoading={isLoading || chat.isAiTyping}
        disabled={channels.selectedChannelIds.length === 0}
        placeholder={
          channels.selectedChannelIds.length === 0
            ? "Select channels to start chatting..."
            : chat.isAiTyping
              ? "AI is responding..."
              : "Ask me anything about your Slack workspace..."
        }
      />
    </div>
  );
});
