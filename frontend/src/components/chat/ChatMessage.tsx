import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import { ChatMessage as ChatMessageType } from '@/types/chat';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Copy,
  CheckCheck,
  Hash,
  ExternalLink,
  ChevronDown,
  ChevronRight,
  User,
  Bot,
  Clock,
  Zap,
} from 'lucide-react';
import { cn, formatTimestamp } from '@/lib/utils';

interface ChatMessageProps {
  message: ChatMessageType;
  isStreaming?: boolean;
}

export function ChatMessage({ message, isStreaming = false }: ChatMessageProps) {
  const [copied, setCopied] = useState(false);
  const [showMetadata, setShowMetadata] = useState(false);
  const [showSources, setShowSources] = useState(false);

  const isUser = message.role === 'user';
  const isAssistant = message.role === 'assistant';

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy text:', err);
    }
  };

  return (
    <div className={cn(
      'flex gap-3 group',
      isUser ? 'justify-end' : 'justify-start'
    )}>
      {/* Avatar */}
      {!isUser && (
        <div className="flex-shrink-0 w-8 h-8 bg-secondary rounded-full flex items-center justify-center">
          <Bot className="h-4 w-4 text-secondary-foreground" />
        </div>
      )}

      {/* Message Content */}
      <div className={cn(
        'max-w-[80%] flex flex-col',
        isUser ? 'items-end' : 'items-start'
      )}>
        {/* Message Bubble */}
        <div className={cn(
          'rounded-lg px-4 py-3 shadow-sm relative',
          isUser 
            ? 'bg-primary text-primary-foreground' 
            : 'bg-card border border-border',
          isStreaming && 'animate-pulse'
        )}>
          {/* Copy Button */}
          <Button
            variant="ghost"
            size="sm"
            onClick={handleCopy}
            className={cn(
              'absolute -top-2 -right-2 h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity',
              'bg-background border border-border shadow-sm hover:bg-accent'
            )}
          >
            {copied ? (
              <CheckCheck className="h-3 w-3" />
            ) : (
              <Copy className="h-3 w-3" />
            )}
          </Button>

          {/* Message Content */}
          <div className="prose prose-sm max-w-none">
            {isUser ? (
              <p className="m-0 text-primary-foreground">{message.content}</p>
            ) : (
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                rehypePlugins={[rehypeHighlight]}
                components={{
                  // Custom link component
                  a: ({ href, children, ...props }) => (
                    <a
                      href={href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:text-primary/80 inline-flex items-center gap-1"
                      {...props}
                    >
                      {children}
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  ),
                  // Custom code block styling
                  pre: ({ children, ...props }) => (
                    <pre className="bg-muted p-3 rounded-md overflow-x-auto text-sm" {...props}>
                      {children}
                    </pre>
                  ),
                  code: ({ className, children, ...props }) => {
                    const isInline = !className;
                    return (
                      <code 
                        className={cn(
                          isInline 
                            ? "bg-muted px-1 py-0.5 rounded text-sm" 
                            : className
                        )}
                        {...props}
                      >
                        {children}
                      </code>
                    );
                  }
                }}
              >
                {message.content}
              </ReactMarkdown>
            )}
          </div>
        </div>

        {/* Message Footer */}
        <div className={cn(
          'flex items-center gap-2 mt-1 text-xs text-muted-foreground',
          isUser ? 'justify-end' : 'justify-start'
        )}>
          <Clock className="h-3 w-3" />
          <span>{formatTimestamp(message.timestamp)}</span>
          
          {/* Show processing time for assistant messages */}
          {isAssistant && message.metadata?.processingTime && (
            <>
              <span>•</span>
              <Zap className="h-3 w-3" />
              <span>{(message.metadata.processingTime / 1000).toFixed(1)}s</span>
            </>
          )}

          {/* Show token usage for assistant messages */}
          {isAssistant && message.metadata?.tokenUsage && (
            <>
              <span>•</span>
              <span>{message.metadata.tokenUsage.total} tokens</span>
            </>
          )}

          {/* Metadata toggle for assistant messages */}
          {isAssistant && (message.metadata?.sources?.length || message.metadata?.intermediateSteps?.length) && (
            <>
              <span>•</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowMetadata(!showMetadata)}
                className="h-4 px-1 text-xs text-muted-foreground hover:text-foreground"
              >
                {showMetadata ? (
                  <ChevronDown className="h-3 w-3" />
                ) : (
                  <ChevronRight className="h-3 w-3" />
                )}
                Details
              </Button>
            </>
          )}
        </div>

        {/* Expanded Metadata */}
        {showMetadata && isAssistant && (
          <div className="mt-2 space-y-2 w-full">
            {/* Sources */}
            {message.metadata?.sources && message.metadata.sources.length > 0 && (
              <div className="bg-accent/30 rounded-md p-3 text-sm">
                <button
                  onClick={() => setShowSources(!showSources)}
                  className="flex items-center gap-2 font-medium text-foreground mb-2 hover:opacity-80"
                >
                  <ExternalLink className="h-4 w-4" />
                  Sources ({message.metadata.sources.length})
                  {showSources ? (
                    <ChevronDown className="h-3 w-3" />
                  ) : (
                    <ChevronRight className="h-3 w-3" />
                  )}
                </button>
                
                {showSources && (
                  <div className="space-y-2">
                    {message.metadata.sources.map((source, index) => (
                      <div key={`${source.id}-${index}`} className="border rounded-md p-2 bg-background">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant={source.type === 'message' ? 'default' : 'secondary'} className="text-xs">
                            {source.type}
                          </Badge>
                          <Badge variant="outline" className="text-xs flex items-center gap-1">
                            <Hash className="h-2 w-2" />
                            {source.channelId}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {formatTimestamp(source.timestamp)}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground italic">
                          "{source.snippet}"
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Technical Metadata */}
            {message.metadata && (
              <div className="bg-muted/30 rounded-md p-3 text-xs space-y-1">
                <div className="font-medium text-foreground mb-2">Technical Details</div>
                {message.metadata.llmProvider && (
                  <div>Provider: {message.metadata.llmProvider}</div>
                )}
                {message.metadata.model && (
                  <div>Model: {message.metadata.model}</div>
                )}
                {message.metadata.tokenUsage && (
                  <div>
                    Tokens: {message.metadata.tokenUsage.prompt} prompt + {message.metadata.tokenUsage.completion} completion = {message.metadata.tokenUsage.total} total
                  </div>
                )}
                {message.metadata.toolCalls && (
                  <div>Tool Calls: {message.metadata.toolCalls}</div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* User Avatar */}
      {isUser && (
        <div className="flex-shrink-0 w-8 h-8 bg-primary rounded-full flex items-center justify-center">
          <User className="h-4 w-4 text-primary-foreground" />
        </div>
      )}
    </div>
  );
}
