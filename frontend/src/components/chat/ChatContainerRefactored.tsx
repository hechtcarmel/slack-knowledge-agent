import React from 'react';
import { ChatHeader } from './ChatHeader';
import { ChatMessages } from './ChatMessages';
import { ChatInputContainer } from './ChatInputContainer';
import { useApp } from '@/hooks/useApp';

/**
 * Main chat container component - completely refactored
 * Now uses centralized state management and focused sub-components
 */
export function ChatContainer() {
  const { chat, channels, error, sendMessage, startNewConversation, isLoading } = useApp();

  return (
    <div className="flex flex-col h-full w-full">
      {/* Header */}
      <ChatHeader
        conversation={chat.currentConversation}
        onNewConversation={startNewConversation}
        isLoading={isLoading}
        selectedChannelsCount={channels.selectedChannelIds.length}
      />

      {/* Messages Area */}
      <ChatMessages
        messages={chat.messages}
        isAiTyping={chat.isAiTyping}
        isLoading={isLoading}
        error={error.chat}
      />

      {/* Input Area */}
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
}
