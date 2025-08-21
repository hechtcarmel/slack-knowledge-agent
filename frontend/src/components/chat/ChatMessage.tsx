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
        'max-w-[95%] lg:max-w-[80%] flex flex-col',
        isUser ? 'items-end' : 'items-start'
      )}>
        {/* Message Bubble */}
        <div className={cn(
          'rounded-lg px-3 lg:px-4 py-0 shadow-sm relative',
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



        </div>

        {/* Metadata Dialog Button for assistant messages */}
        {isAssistant && message.metadata && (
          <div className="mt-1">
            <Dialog open={showMetadataDialog} onOpenChange={setShowMetadataDialog}>
              <DialogTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground"
                >
                  <Info className="h-4 w-4 mr-1" />
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
                      {message.metadata.tokenUsage && (
                        <div className="text-blue-800">
                          <div className="font-medium mt-2 mb-1">Token Usage Breakdown:</div>
                          <div className="ml-2 space-y-1">
                            <div>• Prompt tokens: {(message.metadata.tokenUsage.prompt || 0).toLocaleString()}</div>
                            <div>• Completion tokens: {(message.metadata.tokenUsage.completion || 0).toLocaleString()}</div>
                            <div className="font-medium">• Total tokens: {(message.metadata.tokenUsage.total || 0).toLocaleString()}</div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Agent Interaction Flow */}
                  {message.metadata.intermediateSteps && message.metadata.intermediateSteps.length > 0 && (
                    <div className="space-y-2">
                      <h3 className="font-semibold text-sm">Agent Interaction Flow ({message.metadata.intermediateSteps.length} steps)</h3>
                      <div className="text-xs text-muted-foreground mb-3">
                        Complete trace of what was sent to the agent, tool calls made, and responses received
                      </div>
                    </div>
                  )}

                  {/* Enhanced Tool Calls Summary */}
                  {(message.metadata.toolCalls || (message.metadata.intermediateSteps && message.metadata.intermediateSteps.length > 0)) && (
                    <div className="space-y-2">
                      <h3 className="font-semibold text-sm">Tool Execution Summary</h3>
                      <div className="bg-green-50 border border-green-200 p-3 rounded-md text-sm">
                        <div className="text-green-800">
                          {message.metadata.toolCalls ? (
                            <div>Total tool calls made: {message.metadata.toolCalls}</div>
                          ) : (
                            <div>Total tool calls made: {message.metadata.intermediateSteps?.length || 0}</div>
                          )}
                          {message.metadata.intermediateSteps && (
                            <div className="mt-1">
                              Tools used: {[...new Set(message.metadata.intermediateSteps.map((step: any) => step.action?.tool || 'Unknown').filter(Boolean))].join(', ')}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Detailed Agent Steps */}
                  {message.metadata.intermediateSteps && message.metadata.intermediateSteps.length > 0 && (
                    <div className="space-y-4">
                      {message.metadata.intermediateSteps.map((step, index) => (
                        <div key={index} className="border-2 border-slate-200 rounded-lg overflow-hidden">
                          {/* Step Header */}
                          <div className="bg-slate-100 px-4 py-2 border-b">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <div className="w-6 h-6 bg-primary rounded-full flex items-center justify-center text-primary-foreground text-xs font-bold">
                                  {index + 1}
                                </div>
                                <span className="font-semibold text-sm">Tool: {step.action.tool}</span>
                              </div>
                              <Badge variant="secondary" className="text-xs">
                                Step {index + 1} of {message.metadata?.intermediateSteps?.length || 0}
                              </Badge>
                            </div>
                          </div>

                          <div className="p-4 space-y-4">
                            {/* Agent Reasoning */}
                            {step.action.log && (
                              <div className="space-y-2">
                                <h5 className="font-semibold text-sm text-amber-700">🧠 Agent Reasoning</h5>
                                <div className="bg-amber-50 border border-amber-200 rounded p-3">
                                  <pre className="whitespace-pre-wrap text-xs text-amber-800 font-mono">
                                    {step.action.log}
                                  </pre>
                                </div>
                              </div>
                            )}

                            {/* Input Sent to Tool */}
                            <div className="space-y-2">
                              <h5 className="font-semibold text-sm text-blue-700">📤 Input Sent to Tool</h5>
                              <div className="bg-blue-50 border border-blue-200 rounded p-3">
                                <pre className="text-xs font-mono text-blue-800 overflow-x-auto">
                                  {JSON.stringify(step.action.toolInput, null, 2)}
                                </pre>
                              </div>
                            </div>

                            {/* Response Received */}
                            <div className="space-y-2">
                              <h5 className="font-semibold text-sm text-green-700">📥 Response Received from Tool</h5>
                              <div className="bg-green-50 border border-green-200 rounded p-3 max-h-48 overflow-y-auto">
                                <pre className="text-xs font-mono text-green-800 whitespace-pre-wrap">
                                  {typeof step.observation === 'string' 
                                    ? step.observation 
                                    : JSON.stringify(step.observation, null, 2)
                                  }
                                </pre>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
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

                  {/* Execution Trace */}
                  {message.metadata.executionTrace && (
                    <div className="space-y-2">
                      <h3 className="font-semibold text-sm">Execution Trace</h3>
                      <div className="bg-muted p-3 rounded-md text-sm space-y-2">
                        <div>Query Time: {message.metadata.executionTrace.query_time}ms</div>
                        <div>Channels Searched: {message.metadata.executionTrace.channels_searched.map((c: any) => c.name).join(', ')}</div>
                        <div>Total Messages: {message.metadata.executionTrace.context.metadata.total_messages}</div>
                        <div>Search Time: {message.metadata.executionTrace.context.metadata.search_time_ms}ms</div>
                      </div>
                    </div>
                  )}
                </div>
              </DialogContent>
            </Dialog>
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
