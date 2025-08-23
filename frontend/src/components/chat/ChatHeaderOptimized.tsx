import React, { memo, useState, useCallback, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { 
  Plus, 
  Copy, 
  CheckCheck, 
  CheckCircle, 
  AlertCircle, 
  Loader2 as HealthLoader 
} from 'lucide-react';
import { Conversation } from '@/types/chat';
import { useHealthQuery } from '@/hooks/api';

interface ChatHeaderProps {
  conversation: Conversation | null;
  onNewConversation: () => void;
  isLoading: boolean;
  selectedChannelsCount: number;
}

/**
 * Optimized chat header component with React.memo and performance optimizations
 */
export const ChatHeader = memo(function ChatHeader({ 
  conversation, 
  onNewConversation, 
  isLoading,
  selectedChannelsCount
}: ChatHeaderProps) {
  const [chatCopied, setChatCopied] = useState(false);
  const { data: health, isLoading: healthLoading } = useHealthQuery();

  // Memoized values to prevent unnecessary recalculations
  const hasMessages = useMemo(() => 
    (conversation?.messages.length ?? 0) > 0, 
    [conversation?.messages.length]
  );

  // Stable callbacks to prevent child re-renders
  const handleCopyWholeChat = useCallback(async () => {
    if (!conversation?.messages || conversation.messages.length === 0) return;
    
    try {
      const chatText = conversation.messages
        .map(msg => `${msg.role === 'user' ? 'You' : 'Assistant'}: ${msg.content}`)
        .join('\n\n');
      
      await navigator.clipboard.writeText(chatText);
      setChatCopied(true);
      setTimeout(() => setChatCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy chat:', error);
    }
  }, [conversation?.messages]);

  // Memoized status indicator component
  const StatusIndicator = useMemo(() => {
    if (healthLoading) {
      return (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <HealthLoader className="h-4 w-4 animate-spin" />
          <span>Checking status...</span>
        </div>
      );
    }

    const isHealthy = health?.status === 'healthy';
    const slackConnected = health?.services.slack.status === 'connected';
    const llmConnected = health?.services.llm.status === 'connected';

    return (
      <div className="flex items-center gap-4 text-sm">
        <div className="flex items-center gap-1">
          {isHealthy ? (
            <CheckCircle className="h-4 w-4 text-green-500" />
          ) : (
            <AlertCircle className="h-4 w-4 text-red-500" />
          )}
          <span className={isHealthy ? 'text-green-600 font-medium' : 'text-red-600 font-medium'}>
            {isHealthy ? 'Healthy' : 'Unhealthy'}
          </span>
        </div>

        <div className="flex items-center gap-1">
          <div 
            className={`w-2 h-2 rounded-full ${
              slackConnected ? 'bg-green-500' : 'bg-red-500'
            }`} 
          />
          <span className="text-muted-foreground">Slack</span>
        </div>

        <div className="flex items-center gap-1">
          <div 
            className={`w-2 h-2 rounded-full ${
              llmConnected ? 'bg-green-500' : 'bg-red-500'
            }`} 
          />
          <span className="text-muted-foreground">
            {health?.services?.llm?.provider || 'LLM'}
          </span>
        </div>
      </div>
    );
  }, [healthLoading, health]);

  return (
    <div className="flex-shrink-0 border-b border-border bg-card p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 min-w-0">
          {/* Add space for mobile hamburger menu */}
          <div className="lg:hidden w-10"></div>
          
          <div className="flex items-center gap-1 lg:gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={onNewConversation}
              disabled={isLoading || !conversation}
              className="lg:h-9 lg:px-3 h-8 px-2"
            >
              <Plus className="h-4 w-4 lg:mr-2" />
              <span className="hidden lg:inline">New Chat</span>
            </Button>

            {/* Desktop: Copy chat button */}
            {hasMessages && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleCopyWholeChat}
                disabled={isLoading}
                className="lg:flex hidden lg:px-3 lg:h-9"
              >
                {chatCopied ? (
                  <CheckCheck className="h-4 w-4 lg:mr-2" />
                ) : (
                  <Copy className="h-4 w-4 lg:mr-2" />
                )}
                <span className="hidden lg:inline">{chatCopied ? 'Copied!' : 'Copy Chat'}</span>
              </Button>
            )}
            
            {/* Mobile: Icon-only copy button */}
            {hasMessages && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleCopyWholeChat}
                disabled={isLoading}
                className="lg:hidden h-8 w-8 p-0"
              >
                {chatCopied ? (
                  <CheckCheck className="h-4 w-4" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 lg:gap-4">
          {/* Desktop: Full status indicator */}
          <div className="hidden lg:block">
            {StatusIndicator}
          </div>
          
          {/* Mobile: Compact status indicator */}
          <div className="lg:hidden">
            <div className="text-xs text-muted-foreground">
              {selectedChannelsCount} channels
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});
