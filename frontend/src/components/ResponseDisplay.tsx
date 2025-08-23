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
  Hash, 
  ExternalLink,
  ChevronDown,
  ChevronRight,
  Activity
} from 'lucide-react';
import { formatTimestamp, cn } from '@/lib/utils';

interface ResponseDisplayProps {
  response: QueryResponse;
  query: string;
}

export function ResponseDisplay({ response, query }: ResponseDisplayProps) {
  const [copied, setCopied] = useState(false);
  const [showSources, setShowSources] = useState(false);
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
      {/* Response Card with References */}
      <div className="relative">
        <Card className="border-secondary/20 bg-gradient-to-br from-card to-secondary-light/10 shadow-lg">
          <CardHeader>
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <CardTitle className="flex items-center gap-2 text-secondary-text">
                  <MessageSquareText className="h-5 w-5 text-secondary-text" />
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
            <div className="prose prose-sm max-w-none">
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
          
          {/* References Section - Attached to Card */}
          {response.relevantPermalinks && response.relevantPermalinks.length > 0 && (
            <div className="border-t border-border/40">
              <div className="px-6 py-4 bg-gradient-to-b from-muted/20 to-muted/10">
                <div className="flex items-center gap-2 mb-3">
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
                    <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">References</span>
                  </div>
                  <span className="text-xs text-muted-foreground">•</span>
                  <span className="text-xs text-muted-foreground">
                    {response.relevantPermalinks.length} source{response.relevantPermalinks.length > 1 ? 's' : ''} found
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {response.relevantPermalinks.map((permalink, index) => {
                    // Extract channel from permalink if possible
                    const match = permalink.match(/\/archives\/([^/]+)\/(p\d+)/);
                    const channelId = match?.[1];
                    
                    return (
                      <a
                        key={index}
                        href={permalink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-background/60 backdrop-blur-sm border border-border/30 hover:bg-primary/10 hover:border-primary/30 hover:shadow-sm transition-all duration-200 group"
                        title="Open in Slack"
                      >
                        <div className="flex items-center gap-1.5">
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
                        </div>
                      </a>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </Card>
      </div>

      {/* Advanced Metadata Card */}
      {(response.metadata.intermediateSteps && response.metadata.intermediateSteps.length > 0) || response.metadata.executionTrace ? (
        <Card className="border-warning/20 bg-gradient-to-br from-card to-warning-light/10 shadow-lg">
          <CardHeader>
            <button
              onClick={() => setShowAdvancedMetadata(!showAdvancedMetadata)}
              className="flex items-center justify-between w-full text-left hover:opacity-80"
            >
              <div>
                <CardTitle className="flex items-center gap-2 text-foreground">
                  <Activity className="h-5 w-5 text-warning" />
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
        <Card className="border-success/20 bg-gradient-to-br from-card to-success-light/10 shadow-lg">
          <CardHeader>
            <button
              onClick={() => setShowSources(!showSources)}
              className="flex items-center justify-between w-full text-left hover:opacity-80"
            >
              <div>
                <CardTitle className="flex items-center gap-2 text-foreground">
                  <ExternalLink className="h-5 w-5 text-success" />
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