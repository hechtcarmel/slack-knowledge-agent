import React, { memo, useCallback, useMemo } from 'react';
import { ChatInput } from './ChatInput';
import { ConversationOptions } from '@/types/chat';

interface ChatInputContainerProps {
  onSendMessage: (message: string, options?: Partial<ConversationOptions>) => Promise<void>;
  isLoading?: boolean;
  disabled?: boolean;
  placeholder?: string;
}

/**
 * Optimized container component for chat input with React.memo
 * Uses stable callbacks and memoized options to prevent unnecessary re-renders
 */
export const ChatInputContainer = memo(function ChatInputContainer({ 
  onSendMessage, 
  isLoading = false, 
  disabled = false,
  placeholder = "Type your message..." 
}: ChatInputContainerProps) {

  // Memoized default options to prevent object recreation
  const defaultOptions = useMemo((): Partial<ConversationOptions> => ({
    includeFiles: false,
    includeThreads: true,
  }), []);

  // Stable callback to prevent child re-renders
  const handleSendMessage = useCallback(async (message: string) => {
    await onSendMessage(message, defaultOptions);
  }, [onSendMessage, defaultOptions]);

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
});
