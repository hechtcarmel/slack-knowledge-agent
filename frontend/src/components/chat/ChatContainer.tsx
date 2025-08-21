import { useEffect, useRef, useState } from 'react';
import { ChatMessage } from './ChatMessage';
import { ChatInput } from './ChatInput';
import { Conversation, ChatMessage as ChatMessageType } from '@/types/chat';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { AlertCircle, CheckCircle, Loader2 as HealthLoader } from 'lucide-react';
import { useHealthQuery } from '@/hooks/api';
import ErrorBoundary from '@/components/ErrorBoundary';
import { 
  MessageSquare, 
  Plus,
  Loader2,
  Bot,
  Copy,
  CheckCheck
} from 'lucide-react';

interface ChatContainerProps {
  conversation: Conversation | null;
  onSendMessage: (message: string) => void;
  onNewConversation: () => void;
  isLoading?: boolean;
  streamingMessage?: string;
  isAiTyping?: boolean;
  error?: string | null;
  selectedChannels: string[];
}

export function ChatContainer({ 
  conversation, 
  onSendMessage,
  onNewConversation,
  isLoading = false,
  streamingMessage = '',
  isAiTyping = false,
  error,
  selectedChannels
}: ChatContainerProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [streamingMessageId] = useState(() => `streaming-${Date.now()}`);
  const [chatCopied, setChatCopied] = useState(false);
  const { data: health, isLoading: healthLoading } = useHealthQuery();

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [conversation?.messages, streamingMessage]);

  const displayMessages = conversation?.messages || [];
  
  // Add streaming message if present
  if (streamingMessage) {
    const streamingMsg: ChatMessageType = {
      id: streamingMessageId,
      role: 'assistant',
      content: streamingMessage,
      timestamp: new Date().toISOString(),
    };
    displayMessages.push(streamingMsg);
  }

  const hasMessages = displayMessages.length > 0;

  // Copy whole chat functionality
  const handleCopyWholeChat = async () => {
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
  };

  // Status indicator component
  const StatusIndicator = () => {
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
  };

  return (
    <div className="flex flex-col h-full w-full">
      {/* Header */}
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
              <StatusIndicator />
            </div>
            
            {/* Mobile: Compact status indicator */}
            <div className="lg:hidden">
              <div className="text-xs text-muted-foreground">
                {selectedChannels.length} channels
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Chat Messages Area */}
      <div className="flex-1 flex flex-col min-h-0">
        {hasMessages ? (
          <ScrollArea className="flex-1 p-2 lg:p-4">
            <div className="space-y-2 max-w-4xl mx-auto w-full">
              {displayMessages.map((message) => (
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
                  <ChatMessage
                    message={message}
                    isStreaming={message.id === streamingMessageId && !!streamingMessage}
                  />
                </ErrorBoundary>
              ))}
              
              {/* AI Typing indicator */}
              {isAiTyping && (
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
              )}

              {/* Loading indicator for other operations */}
              {isLoading && !streamingMessage && !isAiTyping && (
                <div className="flex justify-start">
                  <div className="flex items-center gap-2 bg-card border border-border rounded-lg px-4 py-3">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span className="text-sm text-muted-foreground">Loading...</span>
                  </div>
                </div>
              )}
              
              <div ref={messagesEndRef} />
            </div>
          </ScrollArea>
        ) : (
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

        {/* Input Area */}
        <div className="flex-shrink-0 p-2 lg:p-4 border-t border-border">
          <div className="max-w-4xl mx-auto w-full">
            <ChatInput
              onSendMessage={onSendMessage}
              isLoading={isLoading || isAiTyping}
              disabled={isLoading || isAiTyping || selectedChannels.length === 0}
              placeholder={
                selectedChannels.length === 0 
                  ? "Select channels to start chatting..." 
                  : isAiTyping
                    ? "AI is responding..."
                    : "Ask me anything about your Slack workspace..."
              }
            />
          </div>
        </div>
      </div>
    </div>
  );
}