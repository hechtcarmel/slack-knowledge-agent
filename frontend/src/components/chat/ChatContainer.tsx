import { useEffect, useRef, useState } from 'react';
import { ChatMessage } from './ChatMessage';
import { ChatInput } from './ChatInput';
import { Conversation, ChatMessage as ChatMessageType } from '@/types/chat';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  MessageSquare, 
  Hash, 
  Settings, 
  Plus,
  Loader2,
  Sparkles,
  Bot
} from 'lucide-react';


interface ChatContainerProps {
  conversation: Conversation | null;
  onSendMessage: (message: string) => void;
  onNewConversation: () => void;
  onShowSettings?: () => void;
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
  onShowSettings,
  isLoading = false,
  streamingMessage = '',
  isAiTyping = false,
  error,
  selectedChannels
}: ChatContainerProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [streamingMessageId] = useState(() => `streaming-${Date.now()}`);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [conversation?.messages, streamingMessage]);

  // Build display messages including streaming message
  const displayMessages: ChatMessageType[] = [
    ...(conversation?.messages || [])
  ];

  // Add streaming message if present
  if (streamingMessage && conversation) {
    const streamingMsg: ChatMessageType = {
      id: streamingMessageId,
      role: 'assistant',
      content: streamingMessage,
      timestamp: new Date().toISOString(),
    };
    displayMessages.push(streamingMsg);
  }

  const hasMessages = displayMessages.length > 0;
  // selectedChannels is now passed as a prop

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Header */}
      <div className="flex-shrink-0 border-b bg-card/50 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5 text-primary" />
                <h1 className="text-lg font-semibold">
                  {conversation?.title || 'New Conversation'}
                </h1>
              </div>
              
              {/* Channel badges */}
              {selectedChannels.length > 0 && (
                <div className="flex items-center gap-1">
                  <span className="text-xs text-muted-foreground">in</span>
                  {selectedChannels.slice(0, 3).map(channelId => (
                    <Badge key={channelId} variant="outline" className="text-xs">
                      <Hash className="h-2 w-2 mr-1" />
                      {channelId}
                    </Badge>
                  ))}
                  {selectedChannels.length > 3 && (
                    <Badge variant="outline" className="text-xs">
                      +{selectedChannels.length - 3} more
                    </Badge>
                  )}
                </div>
              )}
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={onNewConversation}
                className="flex items-center gap-2"
              >
                <Plus className="h-4 w-4" />
                New Chat
              </Button>
              
              {onShowSettings && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onShowSettings}
                  className="flex items-center gap-2"
                >
                  <Settings className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-hidden">
        {hasMessages ? (
          <ScrollArea className="h-full">
            <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
              {displayMessages.map((message) => (
                <ChatMessage
                  key={message.id}
                  message={message}
                  isStreaming={message.id === streamingMessageId && !!streamingMessage}
                />
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
          /* Empty State */
          <div className="h-full flex items-center justify-center">
            <div className="text-center space-y-4 max-w-md mx-auto px-4">
              <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto">
                <Sparkles className="h-8 w-8 text-primary" />
              </div>
              <div className="space-y-2">
                <h3 className="text-lg font-semibold">Ready to help!</h3>
                <p className="text-muted-foreground text-sm">
                  Ask me anything about your Slack workspace. I can search through messages, 
                  files, and threads to help you find what you need.
                </p>
              </div>
              
              {selectedChannels.length === 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm">
                  <p className="text-amber-800">
                    💡 <strong>Tip:</strong> Select some channels first to get started!
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Error Display */}
      {error && (
        <div className="flex-shrink-0 border-t border-red-200 bg-red-50 px-4 py-2">
          <div className="max-w-4xl mx-auto">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        </div>
      )}

      {/* Input Area */}
      <div className="flex-shrink-0">
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
  );
}
