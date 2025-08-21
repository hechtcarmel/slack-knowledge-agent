import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { QueryResponse } from '@/types/api';
import { AdvancedMetadata } from '@/components/AdvancedMetadata';
import { 
  MessageSquareText, 
  Copy, 
  CheckCheck, 
  Clock, 
  Hash, 
  Zap, 
  ExternalLink,
  ChevronDown,
  ChevronRight,
  Activity
} from 'lucide-react';
import { formatDuration, formatTimestamp, cn } from '@/lib/utils';

interface ResponseDisplayProps {
  response: QueryResponse;
  query: string;
}

export function ResponseDisplay({ response, query }: ResponseDisplayProps) {
  const [copied, setCopied] = useState(false);
  const [showSources, setShowSources] = useState(false);
  const [showMetadata, setShowMetadata] = useState(false);
  const [showAdvancedMetadata, setShowAdvancedMetadata] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(response.response);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy text:', err);
    }
  };

  return (
    <div className="space-y-6">
      {/* Response Card */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <CardTitle className="flex items-center gap-2">
                <MessageSquareText className="h-5 w-5" />
                AI Response
              </CardTitle>
              <CardDescription className="mt-1">
                Query: "{query}"
              </CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleCopy}
              className="ml-4"
            >
              {copied ? (
                <>
                  <CheckCheck className="h-4 w-4 mr-2" />
                  Copied!
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4 mr-2" />
                  Copy
                </>
              )}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="prose prose-sm max-w-none dark:prose-invert">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              rehypePlugins={[rehypeHighlight]}
              components={{
                // Custom link component to open in new tab
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
                  <pre className="bg-muted p-4 rounded-lg overflow-x-auto" {...props}>
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
              {response.response}
            </ReactMarkdown>
          </div>
        </CardContent>
      </Card>

      {/* Metadata Card */}
      <Card>
        <CardHeader>
          <button
            onClick={() => setShowMetadata(!showMetadata)}
            className="flex items-center justify-between w-full text-left hover:opacity-80"
          >
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5" />
              Query Metadata
            </CardTitle>
            {showMetadata ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </button>
        </CardHeader>
        {showMetadata && (
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="font-medium">Processing Time</p>
                  <p className="text-muted-foreground">
                    {formatDuration(response.metadata.processingTime)}
                  </p>
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                <Hash className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="font-medium">Channels Searched</p>
                  <p className="text-muted-foreground">
                    {response.metadata.channels.length}
                  </p>
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                <MessageSquareText className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="font-medium">Messages Found</p>
                  <p className="text-muted-foreground">
                    {response.metadata.messagesFound}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Zap className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="font-medium">LLM Provider</p>
                  <p className="text-muted-foreground">
                    {response.metadata.llmProvider}
                  </p>
                </div>
              </div>
            </div>

            {response.metadata.tokenUsage && (
              <div className="mt-4 pt-4 border-t">
                <h4 className="font-medium text-sm mb-2">Token Usage</h4>
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Prompt</p>
                    <p className="font-mono">{response.metadata.tokenUsage.prompt.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Completion</p>
                    <p className="font-mono">{response.metadata.tokenUsage.completion.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Total</p>
                    <p className="font-mono font-medium">{response.metadata.tokenUsage.total.toLocaleString()}</p>
                  </div>
                </div>
              </div>
            )}

            {response.metadata.channels.length > 0 && (
              <div className="mt-4 pt-4 border-t">
                <h4 className="font-medium text-sm mb-2">Searched Channels</h4>
                <div className="flex flex-wrap gap-2">
                  {response.metadata.channels.map((channel) => (
                    <Badge key={channel} variant="secondary" className="flex items-center gap-1">
                      <Hash className="h-3 w-3" />
                      {channel}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        )}
      </Card>

      {/* Advanced Metadata Card */}
      {(response.metadata.intermediateSteps && response.metadata.intermediateSteps.length > 0) || response.metadata.executionTrace ? (
        <Card>
          <CardHeader>
            <button
              onClick={() => setShowAdvancedMetadata(!showAdvancedMetadata)}
              className="flex items-center justify-between w-full text-left hover:opacity-80"
            >
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="h-5 w-5" />
                  Advanced Metadata
                </CardTitle>
                <CardDescription>
                  Detailed execution trace and observability data
                </CardDescription>
              </div>
              {showAdvancedMetadata ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </button>
          </CardHeader>
          {showAdvancedMetadata && (
            <CardContent>
              <AdvancedMetadata response={response} query={query} />
            </CardContent>
          )}
        </Card>
      ) : null}

      {/* Sources Card */}
      {response.sources && response.sources.length > 0 && (
        <Card>
          <CardHeader>
            <button
              onClick={() => setShowSources(!showSources)}
              className="flex items-center justify-between w-full text-left hover:opacity-80"
            >
              <div>
                <CardTitle className="flex items-center gap-2">
                  <ExternalLink className="h-5 w-5" />
                  Sources ({response.sources.length})
                </CardTitle>
                <CardDescription>
                  Messages and files that informed this response
                </CardDescription>
              </div>
              {showSources ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </button>
          </CardHeader>
          {showSources && (
            <CardContent>
              <div className="space-y-3">
                {response.sources.map((source, index) => (
                  <div key={`${source.id}-${index}`} className="border rounded-lg p-3 hover:bg-accent/50 transition-colors">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant={source.type === 'message' ? 'default' : source.type === 'thread' ? 'secondary' : 'outline'}>
                          {source.type}
                        </Badge>
                        <Badge variant="outline" className="text-xs flex items-center gap-1">
                          <Hash className="h-3 w-3" />
                          {source.channelId}
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                          {formatTimestamp(source.timestamp)}
                        </Badge>
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground italic">
                      "{source.snippet}"
                    </p>
                  </div>
                ))}
              </div>
            </CardContent>
          )}
        </Card>
      )}
    </div>
  );
}