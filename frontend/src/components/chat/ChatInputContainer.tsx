import React from 'react';
import { ChatInput } from './ChatInput';
import { ConversationOptions } from '@/types/chat';

interface ChatInputContainerProps {
  onSendMessage: (message: string, options?: Partial<ConversationOptions>) => Promise<void>;
  isLoading?: boolean;
  disabled?: boolean;
  placeholder?: string;
}

/**
 * Container component for chat input
 * Handles message sending with conversation options
 */
export function ChatInputContainer({ 
  onSendMessage, 
  isLoading = false, 
  disabled = false,
  placeholder = "Type your message..." 
}: ChatInputContainerProps) {

  const handleSendMessage = async (message: string) => {
    // For now, use default conversation options
    // In the future, we could add UI controls for these options
    const defaultOptions: Partial<ConversationOptions> = {
      includeFiles: false,
      includeThreads: true,
    };

    await onSendMessage(message, defaultOptions);
  };

  return (
    <div className="flex-shrink-0 p-2 lg:p-4 border-t border-border">
      <div className="max-w-4xl mx-auto w-full">
        <ChatInput
          onSendMessage={handleSendMessage}
          isLoading={isLoading}
          disabled={disabled}
          placeholder={placeholder}
        />
      </div>
    </div>
  );
}
