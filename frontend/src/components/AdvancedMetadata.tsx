import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { QueryResponse } from '@/types/api';
import { 
  ChevronDown, 
  ChevronRight, 
  Activity,
  Clock,
  Settings,
  Play,
  CheckCircle,
  XCircle,
  ArrowRight,
  Hash,
  Database,
  Cpu,
  Code,
  MessageSquare,
  Copy,
  CheckCheck
} from 'lucide-react';
import { formatDuration, formatTimestamp, cn } from '@/lib/utils';

interface AdvancedMetadataProps {
  response: QueryResponse;
  query: string;
}

export function AdvancedMetadata({ response, query }: AdvancedMetadataProps) {
  const [expandedSteps, setExpandedSteps] = useState<Set<number>>(new Set());
  const [copiedStep, setCopiedStep] = useState<number | null>(null);
  
  const toggleStep = (index: number) => {
    const newExpanded = new Set(expandedSteps);
    if (newExpanded.has(index)) {
      newExpanded.delete(index);
    } else {
      newExpanded.add(index);
    }
    setExpandedSteps(newExpanded);
  };

  const copyStepData = async (step: any, index: number) => {
    try {
      const stepData = JSON.stringify(step, null, 2);
      await navigator.clipboard.writeText(stepData);
      setCopiedStep(index);
      setTimeout(() => setCopiedStep(null), 2000);
    } catch (err) {
      console.error('Failed to copy step data:', err);
    }
  };

  const renderToolInput = (toolInput: any) => {
    if (typeof toolInput === 'string') {
      return <span className="font-mono text-sm">{toolInput}</span>;
    }
    
    return (
      <div className="space-y-1">
        {Object.entries(toolInput).map(([key, value]) => (
          <div key={key} className="flex items-start gap-2">
            <span className="font-medium text-muted-foreground text-xs uppercase tracking-wide min-w-0 shrink-0">
              {key}:
            </span>
            <span className="font-mono text-sm break-all">
              {typeof value === 'object' ? JSON.stringify(value) : String(value)}
            </span>
          </div>
        ))}
      </div>
    );
  };

  const renderObservation = (observation: any) => {
    if (typeof observation === 'string') {
      return (
        <div className="bg-muted/50 rounded p-3 text-sm">
          <pre className="whitespace-pre-wrap font-mono text-xs">{observation}</pre>
        </div>
      );
    }

    if (observation?.data) {
      const data = observation.data;
      return (
        <div className="bg-muted/50 rounded p-3 space-y-2">
          <div className="flex items-center gap-2 text-xs">
            {observation.success ? (
              <CheckCircle className="h-4 w-4 text-green-600" />
            ) : (
              <XCircle className="h-4 w-4 text-red-600" />
            )}
            <span className={cn(
              "font-medium",
              observation.success ? "text-green-700" : "text-red-700"
            )}>
              {observation.success ? 'Success' : 'Failed'}
            </span>
            {observation.metadata?.executionTime && (
              <>
                <span className="text-muted-foreground">•</span>
                <span className="text-muted-foreground">
                  {formatDuration(observation.metadata.executionTime)}
                </span>
              </>
            )}
          </div>
          
          {Array.isArray(data) && data.length > 0 && (
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground">
                Found {data.length} items:
              </p>
              <div className="max-h-32 overflow-y-auto space-y-1">
                {data.slice(0, 5).map((item: any, idx: number) => (
                  <div key={idx} className="text-xs bg-background rounded p-2">
                    {item.text ? (
                      <p className="truncate">{item.text.substring(0, 100)}...</p>
                    ) : (
                      <pre className="whitespace-pre-wrap">{JSON.stringify(item, null, 1)}</pre>
                    )}
                  </div>
                ))}
                {data.length > 5 && (
                  <p className="text-xs text-muted-foreground italic">
                    ... and {data.length - 5} more
                  </p>
                )}
              </div>
            </div>
          )}
          
          {observation.error && (
            <div className="bg-red-50 border border-red-200 rounded p-2">
              <p className="text-red-800 text-xs font-medium">Error:</p>
              <p className="text-red-700 text-xs">{observation.error}</p>
            </div>
          )}
        </div>
      );
    }

    return (
      <div className="bg-muted/50 rounded p-3">
        <pre className="whitespace-pre-wrap text-xs font-mono">
          {JSON.stringify(observation, null, 2)}
        </pre>
      </div>
    );
  };

  const getStepIcon = (toolName: string) => {
    const iconMap: Record<string, React.ElementType> = {
      search_messages: MessageSquare,
      get_channel_history: Database,
      get_channel_info: Hash,
      list_files: Code,
      get_file_content: Code,
      get_thread: MessageSquare,
    };
    
    const IconComponent = iconMap[toolName] || Activity;
    return <IconComponent className="h-4 w-4" />;
  };

  return (
    <div className="space-y-4">
      {/* Execution Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Cpu className="h-5 w-5" />
            Execution Overview
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="font-medium">Total Time</p>
                <p className="text-muted-foreground">
                  {formatDuration(response.metadata.processingTime)}
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="font-medium">Steps Executed</p>
                <p className="text-muted-foreground">
                  {response.metadata.intermediateSteps?.length || 0}
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <Settings className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="font-medium">Model</p>
                <p className="text-muted-foreground">
                  {response.metadata.model || response.metadata.llmProvider}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Hash className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="font-medium">Channels</p>
                <p className="text-muted-foreground">
                  {response.metadata.channels.length}
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Execution Timeline */}
      {response.metadata.intermediateSteps && response.metadata.intermediateSteps.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Play className="h-5 w-5" />
              Execution Timeline
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Step-by-step breakdown of how your query was processed
            </p>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {response.metadata.intermediateSteps.map((step: any, index: number) => {
                const isExpanded = expandedSteps.has(index);
                const toolName = step.action?.tool || 'unknown';
                const toolInput = step.action?.toolInput || {};
                const observation = step.observation;
                
                return (
                  <div key={index} className="border rounded-lg overflow-hidden">
                    <button
                      onClick={() => toggleStep(index)}
                      className="w-full p-4 text-left hover:bg-accent/50 transition-colors flex items-center justify-between"
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2">
                          <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-primary text-sm font-medium">
                            {index + 1}
                          </span>
                          {getStepIcon(toolName)}
                        </div>
                        <div>
                          <h4 className="font-medium">
                            {toolName.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                          </h4>
                          <p className="text-sm text-muted-foreground">
                            {typeof toolInput === 'string' 
                              ? toolInput.substring(0, 80) + (toolInput.length > 80 ? '...' : '')
                              : Object.keys(toolInput).join(', ')
                            }
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            copyStepData(step, index);
                          }}
                          className="p-1"
                        >
                          {copiedStep === index ? (
                            <CheckCheck className="h-4 w-4 text-green-600" />
                          ) : (
                            <Copy className="h-4 w-4" />
                          )}
                        </Button>
                        {isExpanded ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                      </div>
                    </button>
                    
                    {isExpanded && (
                      <div className="border-t bg-muted/20 p-4 space-y-4">
                        {/* Tool Input */}
                        <div>
                          <div className="flex items-center gap-2 mb-2">
                            <ArrowRight className="h-4 w-4 text-blue-600" />
                            <h5 className="font-medium text-blue-700">Input</h5>
                          </div>
                          <div className="bg-blue-50 rounded p-3 border border-blue-200">
                            {renderToolInput(toolInput)}
                          </div>
                        </div>
                        
                        {/* Tool Output */}
                        <div>
                          <div className="flex items-center gap-2 mb-2">
                            <ArrowRight className="h-4 w-4 text-green-600 rotate-180" />
                            <h5 className="font-medium text-green-700">Output</h5>
                          </div>
                          {renderObservation(observation)}
                        </div>

                        {/* Step Log */}
                        {step.action?.log && (
                          <div>
                            <h5 className="font-medium text-muted-foreground mb-2">Agent Reasoning</h5>
                            <div className="bg-amber-50 border border-amber-200 rounded p-3">
                              <pre className="whitespace-pre-wrap text-xs font-mono text-amber-800">
                                {step.action.log}
                              </pre>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Context Information */}
      {response.metadata.executionTrace && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Database className="h-5 w-5" />
              Context & Configuration
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <h4 className="font-medium mb-2">Query</h4>
                <div className="bg-muted/50 rounded p-3">
                  <p className="text-sm font-mono">{query}</p>
                </div>
              </div>

              <div>
                <h4 className="font-medium mb-2">Searched Channels</h4>
                <div className="flex flex-wrap gap-2">
                  {response.metadata.executionTrace.channels_searched?.map((channel: any) => (
                    <Badge key={channel.id} variant="outline" className="flex items-center gap-1">
                      <Hash className="h-3 w-3" />
                      {channel.name}
                    </Badge>
                  ))}
                </div>
              </div>

              {response.metadata.executionTrace.context?.messages && (
                <div>
                  <h4 className="font-medium mb-2">Messages Analyzed</h4>
                  <div className="text-sm text-muted-foreground">
                    <p>{response.metadata.executionTrace.context.messages.length} messages processed</p>
                    <p>Search time: {formatDuration(response.metadata.executionTrace.context.metadata?.search_time_ms || 0)}</p>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
