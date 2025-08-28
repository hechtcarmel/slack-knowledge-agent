import { useState, useEffect } from 'react';
import { ChatMessage } from '@/types/chat';
import { useEmbedModeConfig } from '@/stores';

/**
 * Hook to handle initial welcome message in embed mode
 * Creates a fake AI message that appears after a delay for greeting purposes
 * This message is UI-only and never sent to the backend
 */
export function useInitialMessage(): {
  initialMessage: ChatMessage | null;
  hasShownInitialMessage: boolean;
} {
  const embedConfig = useEmbedModeConfig();
  const [initialMessage, setInitialMessage] = useState<ChatMessage | null>(null);
  const [hasShownInitialMessage, setHasShownInitialMessage] = useState(false);

  useEffect(() => {
    // Only show initial message in embed mode when configured
    if (!embedConfig?.initialMessage || hasShownInitialMessage) {
      return;
    }

    const timer = setTimeout(() => {
      const message: ChatMessage = {
        id: 'initial-embed-message',
        role: 'assistant',
        content: embedConfig.initialMessage!,
        timestamp: new Date().toISOString(),
        metadata: {
          isInitialMessage: true, // Mark as initial message
          processingTime: 0,
          llmProvider: 'system',
        }
      };

      setInitialMessage(message);
      setHasShownInitialMessage(true);
    }, 1000); // 1 second delay

    return () => clearTimeout(timer);
  }, [embedConfig?.initialMessage, hasShownInitialMessage, embedConfig?.channels]);

  return {
    initialMessage,
    hasShownInitialMessage,
  };
}