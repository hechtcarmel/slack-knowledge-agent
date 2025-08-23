import React, { memo, useEffect, useRef, useMemo } from 'react';
import { ChatMessage } from './ChatMessage';
import { ScrollArea } from '@/components/ui/scroll-area';
import { AlertCircle, MessageSquare, Bot, Loader2 } from 'lucide-react';
import ErrorBoundary from '@/components/ErrorBoundary';
import { ChatMessage as ChatMessageType } from '@/types/chat';

interface ChatMessagesProps {
  messages: ChatMessageType[];
  isAiTyping?: boolean;
  isLoading?: boolean;
  error?: string | null;
}

/**
 * Optimized chat messages display component with React.memo
 * Uses memoization to prevent unnecessary re-renders of message list
 */
export const ChatMessages = memo(function ChatMessages({ 
  messages, 
  isAiTyping = false, 
  isLoading = false,
  error 
}: ChatMessagesProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // Memoized calculation to prevent recalculation on every render
  const hasMessages = useMemo(() => messages.length > 0, [messages.length]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isAiTyping]);

  // Memoized empty state to prevent re-creation
  const EmptyState = useMemo(() => (
    <div className="flex-1 flex items-center justify-center p-4 lg:p-8">
      <div className="text-center max-w-md mx-auto space-y-6">
        <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto">
          <MessageSquare className="h-8 w-8 text-primary" />
        </div>
        
        <div className="space-y-2">
          <h3 className="text-lg font-semibold">Ready to Chat</h3>
          <p className="text-muted-foreground">
            Ask me anything about your selected Slack channels
          </p>
        </div>
      </div>
    </div>
  ), []);

  // Memoized typing indicator
  const TypingIndicator = useMemo(() => (
    <div className="flex justify-start">
      <div className="flex items-center gap-2">
        <div className="flex-shrink-0 w-8 h-8 bg-secondary rounded-full flex items-center justify-center">
          <Bot className="h-4 w-4 text-secondary-foreground" />
        </div>
        <div className="bg-card border border-border rounded-lg px-4 py-3 flex items-center gap-2">
          <div className="flex gap-1">
            <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
            <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
            <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
          </div>
          <span className="text-sm text-muted-foreground">AI is thinking...</span>
        </div>
      </div>
    </div>
  ), []);

  // Memoized loading indicator
  const LoadingIndicator = useMemo(() => (
    <div className="flex justify-start">
      <div className="flex items-center gap-2 bg-card border border-border rounded-lg px-4 py-3">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span className="text-sm text-muted-foreground">Loading...</span>
      </div>
    </div>
  ), []);

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {hasMessages ? (
        <ScrollArea className="flex-1 p-2 lg:p-4">
          <div className="space-y-2 max-w-4xl mx-auto w-full">
            {messages.map((message) => (
              <ErrorBoundary
                key={message.id}
                fallback={
                  <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3 text-sm">
                    <div className="flex items-center gap-2">
                      <AlertCircle className="h-4 w-4 text-destructive flex-shrink-0" />
                      <span className="text-destructive">Failed to render message</span>
                    </div>
                  </div>
                }
              >
                <ChatMessage message={message} />
              </ErrorBoundary>
            ))}
            
            {/* AI Typing indicator */}
            {isAiTyping && TypingIndicator}

            {/* Loading indicator for other operations */}
            {isLoading && !isAiTyping && LoadingIndicator}
            
            <div ref={messagesEndRef} />
          </div>
        </ScrollArea>
      ) : (
        EmptyState
      )}

      {/* Error Display */}
      {error && (
        <div className="flex-shrink-0 p-2 lg:p-4 border-t border-border">
          <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3 text-sm max-w-4xl mx-auto">
            <div className="flex items-start gap-2">
              <AlertCircle className="h-4 w-4 text-destructive mt-0.5 flex-shrink-0" />
              <p className="text-destructive">{error}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});
