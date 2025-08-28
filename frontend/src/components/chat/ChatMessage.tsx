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
  User,
  Bot,
  Clock,
  Zap,
  Info,
} from 'lucide-react';
import { cn, formatTimestamp } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { ChainOfThought } from '@/components/ChainOfThought';

interface ChatMessageProps {
  message: ChatMessageType;
  isStreaming?: boolean;
}

export function ChatMessage({ message, isStreaming = false }: ChatMessageProps) {
  const [copied, setCopied] = useState(false);
  const [showMetadataDialog, setShowMetadataDialog] = useState(false);

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
      'flex gap-3 group w-full min-w-0',
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
        'max-w-[70%] xs:max-w-[75%] sm:max-w-[70%] lg:max-w-[80%] flex flex-col min-w-0',
        isUser ? 'items-end' : 'items-start'
      )}>
        {/* Message Bubble */}
        <div className={cn(
          'rounded-lg px-3 lg:px-4 py-3 shadow-sm relative break-words overflow-hidden hyphens-auto',
          'word-break-break-all [word-break:break-word] [overflow-wrap:break-word]',
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
          <div className="prose prose-sm max-w-none min-w-0 overflow-wrap-anywhere break-words hyphens-auto [word-break:break-word]">
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

        {/* Metadata Footer - Date, Time, and Flow Details */}
        {isAssistant && message.metadata && (
          <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
            {/* Date and Time */}
            <div className="flex items-center gap-2">
              <Clock className="h-3 w-3" />
              <span>{formatTimestamp(message.timestamp)}</span>
              {message.metadata.processingTime && (
                <>
                  <span>•</span>
                  <span className="flex items-center gap-1">
                    <Zap className="h-3 w-3" />
                    {(message.metadata.processingTime / 1000).toFixed(1)}s
                  </span>
                </>
              )}
            </div>
            
            {/* View Flow Details Button */}
            <div className="ml-auto">
              <Dialog open={showMetadataDialog} onOpenChange={setShowMetadataDialog}>
                <DialogTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground"
                  >
                    <Info className="h-3 w-3 mr-1" />
                    View Flow Details
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>Message Flow Details</DialogTitle>
                    <DialogDescription>
                      Detailed information about how this response was generated
                    </DialogDescription>
                  </DialogHeader>
                  
                  <div className="space-y-6">
                    {/* Query Flow Overview */}
                    <div className="space-y-2">
                      <h3 className="font-semibold text-sm">Query Flow Overview</h3>
                      <div className="bg-blue-50 border border-blue-200 p-4 rounded-md text-sm space-y-2">
                        <div className="font-medium text-blue-900">Initial Request</div>
                        <div className="text-blue-800">Provider: {message.metadata.llmProvider}</div>
                        {message.metadata.model && (
                          <div className="text-blue-800">Model: {message.metadata.model}</div>
                        )}
                        {message.metadata.processingTime && (
                          <div className="text-blue-800">Total Processing Time: {(message.metadata.processingTime / 1000).toFixed(1)}s</div>
                        )}

                      </div>
                    </div>

                    {/* Chain of Thought */}
                    {message.metadata.intermediateSteps && message.metadata.intermediateSteps.length > 0 && (
                      <ChainOfThought 
                        intermediateSteps={message.metadata.intermediateSteps}
                        className="mt-4"
                      />
                    )}

                    {/* Sources */}
                    {message.metadata.sources && message.metadata.sources.length > 0 && (
                      <div className="space-y-2">
                        <h3 className="font-semibold text-sm">Sources ({message.metadata.sources.length})</h3>
                        <div className="space-y-2">
                          {message.metadata.sources.map((source, index) => (
                            <div key={`${source.id}-${index}`} className="border rounded-md p-3">
                              <div className="flex items-center gap-2 mb-2">
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
                              <p className="text-sm text-muted-foreground italic">
                                "{source.snippet}"
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        )}

        {/* References Section - Use permalinkReferences if available, fall back to relevantPermalinks */}
        {isAssistant && message.metadata && 
         ((message.metadata.permalinkReferences && message.metadata.permalinkReferences.length > 0) || 
          (message.metadata.relevantPermalinks && message.metadata.relevantPermalinks.length > 0)) && (
          <div className="mt-2 p-3 bg-muted/50 rounded-lg border border-border/50">
            <div className="flex items-center gap-2 mb-2">
              <div className="flex items-center gap-1.5">
                <div className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">References</span>
              </div>
              <span className="text-xs text-muted-foreground">•</span>
              <span className="text-xs text-muted-foreground">
                {(message.metadata?.permalinkReferences?.length || message.metadata?.relevantPermalinks?.length || 0)} source{((message.metadata?.permalinkReferences?.length || message.metadata?.relevantPermalinks?.length || 0) > 1) ? 's' : ''}
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              {message.metadata?.permalinkReferences ? (
                // Use permalinkReferences with descriptions
                message.metadata.permalinkReferences.map((ref, index) => (
                  <a
                    key={index}
                    href={ref.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-background/80 backdrop-blur-sm border border-border/30 hover:bg-primary/10 hover:border-primary/30 hover:shadow-sm transition-all duration-200 group max-w-xs"
                    title="Open in Slack"
                  >
                    <ExternalLink className="h-3 w-3 text-muted-foreground/70 group-hover:text-primary transition-colors flex-shrink-0" />
                    <span className="text-xs font-medium text-foreground/80 group-hover:text-foreground transition-colors truncate">
                      {ref.description}
                    </span>
                  </a>
                ))
              ) : (
                // Fallback to relevantPermalinks with channel IDs
                message.metadata?.relevantPermalinks?.map((permalink, index) => {
                  const match = permalink.match(/\/archives\/([^/]+)\/(p\d+)/);
                  const channelId = match?.[1];
                  
                  return (
                    <a
                      key={index}
                      href={permalink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-background/80 backdrop-blur-sm border border-border/30 hover:bg-primary/10 hover:border-primary/30 hover:shadow-sm transition-all duration-200 group"
                      title="Open in Slack"
                    >
                      <ExternalLink className="h-3 w-3 text-muted-foreground/70 group-hover:text-primary transition-colors" />
                      <span className="text-xs font-medium text-foreground/80 group-hover:text-foreground transition-colors">
                        {channelId ? (
                          <>
                            <Hash className="inline h-2.5 w-2.5 mr-0.5 opacity-60" />
                            {channelId}
                          </>
                        ) : (
                          `Source ${index + 1}`
                        )}
                      </span>
                    </a>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* User Message Footer - Just timestamp */}
        {isUser && (
          <div className="flex items-center justify-end gap-2 mt-1 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" />
            <span>{formatTimestamp(message.timestamp)}</span>
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
