import { ChatHeader } from './ChatHeader';
import { ChatMessages } from './ChatMessages';
import { ChatInputContainer } from './ChatInputContainer';
import { useChatManager } from '@/hooks/useChatManager';
import { useSelectedChannels, useChatError } from '@/stores';
import { useInitialMessage } from '@/hooks/useInitialMessage';
import { useMemo } from 'react';

/**
 * Main chat container component - uses Zustand stores and chat manager
 * Now with direct store access for optimal performance
 */
export function ChatContainer() {
  const chat = useChatManager();
  const selectedChannelIds = useSelectedChannels();
  const chatError = useChatError();
  const { initialMessage } = useInitialMessage();

  const sendMessage = async (message: string) => {
    if (selectedChannelIds.length === 0) return;
    await chat.sendMessage(message, selectedChannelIds);
  };

  // Combine initial message with chat messages
  const allMessages = useMemo(() => {
    const messages = [...chat.messages];
    if (initialMessage && !messages.some(msg => msg.id === initialMessage.id)) {
      messages.unshift(initialMessage);
    }
    return messages;
  }, [chat.messages, initialMessage]);

  return (
    <div className="flex flex-col h-full w-full">
      {/* Header */}
      <ChatHeader
        conversation={chat.currentConversation}
        onNewConversation={chat.startNewConversation}
        isLoading={chat.isLoading}
        selectedChannelsCount={selectedChannelIds.length}
      />

      {/* Messages Area */}
      <ChatMessages
        messages={allMessages}
        isAiTyping={chat.isAiTyping}
        isLoading={chat.isLoading}
        error={chatError}
      />

      {/* Input Area */}
      <ChatInputContainer
        onSendMessage={sendMessage}
        isLoading={chat.isLoading || chat.isAiTyping}
        disabled={selectedChannelIds.length === 0}
        placeholder={
          selectedChannelIds.length === 0
            ? "Select channels to start chatting..."
            : chat.isAiTyping
              ? "AI is responding..."
              : "Ask me anything about your Slack workspace..."
        }
      />
    </div>
  );
}
