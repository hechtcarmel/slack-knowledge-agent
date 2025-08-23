import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  ChevronDown, 
  ChevronRight, 
  Brain,
  Zap,
  ArrowRight,
  MessageSquare,
  Database,
  Hash,
  Code,
  Activity,
  Eye,
  Play,
  Copy,
  CheckCheck
} from 'lucide-react';
import { IntermediateStep } from '@/types/api';
import { cn } from '@/lib/utils';

interface ChainOfThoughtProps {
  intermediateSteps: IntermediateStep[];
  className?: string;
}

export function ChainOfThought({ intermediateSteps, className }: ChainOfThoughtProps) {
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

  const copyStepData = async (step: IntermediateStep, index: number) => {
    try {
      const stepData = JSON.stringify(step, null, 2);
      await navigator.clipboard.writeText(stepData);
      setCopiedStep(index);
      setTimeout(() => setCopiedStep(null), 2000);
    } catch (err) {
      console.error('Failed to copy step data:', err);
    }
  };

  const getToolIcon = (toolName: string) => {
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

  const formatToolName = (toolName: string) => {
    return toolName
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (l: string) => l.toUpperCase());
  };

  const getStepTypeColor = (_toolName: string, index: number) => {
    const colors = [
      'border-blue-200 bg-blue-50',
      'border-green-200 bg-green-50', 
      'border-purple-200 bg-purple-50',
      'border-orange-200 bg-orange-50',
      'border-pink-200 bg-pink-50',
      'border-cyan-200 bg-cyan-50'
    ];
    return colors[index % colors.length];
  };

  const getStepNumber = (index: number) => {
    const colors = [
      'bg-blue-500', 'bg-green-500', 'bg-purple-500', 
      'bg-orange-500', 'bg-pink-500', 'bg-cyan-500'
    ];
    return colors[index % colors.length];
  };

  if (!intermediateSteps || intermediateSteps.length === 0) {
    return null;
  }

  return (
    <div className={cn("space-y-4", className)}>
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="flex items-center justify-center w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full">
          <Brain className="h-5 w-5 text-white" />
        </div>
        <div>
          <h3 className="font-semibold text-lg text-gray-900">Chain of Thought</h3>
          <p className="text-sm text-gray-600">
            {intermediateSteps.length} reasoning {intermediateSteps.length === 1 ? 'step' : 'steps'}
          </p>
        </div>
      </div>

      {/* Chain Flow */}
      <div className="relative">
        {/* Vertical line connecting all steps */}
        <div className="absolute left-6 top-8 bottom-0 w-0.5 bg-gradient-to-b from-gray-200 via-gray-300 to-transparent"></div>
        
        {intermediateSteps.map((step, index) => {
          const isExpanded = expandedSteps.has(index);
          const toolName = step.action?.tool || 'unknown';
          const toolInput = step.action?.toolInput || {};
          const observation = step.observation;
          const reasoning = step.action?.log;
          
          return (
            <div key={index} className="relative mb-6">
              {/* Step Circle */}
              <div className="absolute left-0 top-4">
                <div className={cn(
                  "flex items-center justify-center w-12 h-12 rounded-full text-white font-semibold shadow-lg",
                  getStepNumber(index)
                )}>
                  {index + 1}
                </div>
              </div>

              {/* Step Content */}
              <div className="ml-16">
                <Card className={cn(
                  "border-2 transition-all duration-300 hover:shadow-md",
                  getStepTypeColor(toolName, index),
                  isExpanded && "shadow-lg"
                )}>
                  {/* Step Header */}
                  <div className="p-4">
                    <button
                      onClick={() => toggleStep(index)}
                      className="w-full text-left focus:outline-none focus:ring-2 focus:ring-blue-300 rounded-lg"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3 flex-1">
                          <div className="p-2 bg-white rounded-lg shadow-sm border">
                            {getToolIcon(toolName)}
                          </div>
                          <div className="flex-1">
                            <h4 className="font-semibold text-gray-900 mb-1">
                              {formatToolName(toolName)}
                            </h4>
                            <p className="text-sm text-gray-600 line-clamp-1">
                              {typeof toolInput === 'object' && toolInput !== null
                                ? Object.entries(toolInput)
                                    .slice(0, 2)
                                    .map(([key, value]) => `${key}: ${String(value).substring(0, 30)}`)
                                    .join(', ')
                                : String(toolInput).substring(0, 60)
                              }
                              {Object.keys(toolInput).length > 2 && '...'}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 ml-4">
                          {reasoning && (
                            <Badge variant="secondary" className="bg-amber-100 text-amber-800 border-amber-200">
                              <Brain className="h-3 w-3 mr-1" />
                              Reasoning
                            </Badge>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              copyStepData(step, index);
                            }}
                            className="p-2 hover:bg-white/50"
                          >
                            {copiedStep === index ? (
                              <CheckCheck className="h-4 w-4 text-green-600" />
                            ) : (
                              <Copy className="h-4 w-4 text-gray-500" />
                            )}
                          </Button>
                          <div className="text-gray-400">
                            {isExpanded ? (
                              <ChevronDown className="h-5 w-5" />
                            ) : (
                              <ChevronRight className="h-5 w-5" />
                            )}
                          </div>
                        </div>
                      </div>
                    </button>
                  </div>

                  {/* Expanded Content */}
                  {isExpanded && (
                    <CardContent className="pt-0 pb-4">
                      <div className="border-t border-white/50 pt-4 space-y-4">
                        
                        {/* Agent Reasoning */}
                        {reasoning && (
                          <div className="space-y-2">
                            <div className="flex items-center gap-2">
                              <Brain className="h-4 w-4 text-amber-600" />
                              <h5 className="font-medium text-amber-800">Agent Reasoning</h5>
                            </div>
                            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                              <pre className="text-sm text-amber-800 font-mono whitespace-pre-wrap leading-relaxed">
                                {reasoning}
                              </pre>
                            </div>
                          </div>
                        )}

                        {/* Tool Input */}
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <Play className="h-4 w-4 text-blue-600" />
                            <h5 className="font-medium text-blue-800">Input Parameters</h5>
                          </div>
                          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                            <div className="space-y-2">
                              {typeof toolInput === 'object' && toolInput !== null ? (
                                Object.entries(toolInput).map(([key, value]) => (
                                  <div key={key} className="flex items-start gap-2">
                                    <span className="font-semibold text-blue-700 text-sm uppercase tracking-wide min-w-fit">
                                      {key}:
                                    </span>
                                    <span className="font-mono text-sm text-blue-800 break-all">
                                      {typeof value === 'object' 
                                        ? JSON.stringify(value, null, 1) 
                                        : String(value)
                                      }
                                    </span>
                                  </div>
                                ))
                              ) : (
                                <span className="font-mono text-sm text-blue-800">
                                  {String(toolInput)}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Tool Output */}
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <Eye className="h-4 w-4 text-green-600" />
                            <h5 className="font-medium text-green-800">Tool Response</h5>
                          </div>
                          <div className="bg-green-50 border border-green-200 rounded-lg p-3 max-h-64 overflow-y-auto">
                            <pre className="text-sm text-green-800 font-mono whitespace-pre-wrap leading-relaxed">
                              {typeof observation === 'string' 
                                ? observation 
                                : JSON.stringify(observation, null, 2)
                              }
                            </pre>
                          </div>
                        </div>

                        {/* Step Continuation Indicator */}
                        {index < intermediateSteps.length - 1 && (
                          <div className="flex items-center justify-center pt-2">
                            <div className="flex items-center gap-2 text-gray-500">
                              <div className="w-1 h-1 bg-gray-400 rounded-full"></div>
                              <ArrowRight className="h-4 w-4" />
                              <div className="w-1 h-1 bg-gray-400 rounded-full"></div>
                            </div>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  )}
                </Card>
              </div>
            </div>
          );
        })}
      </div>

      {/* Summary Footer */}
      <div className="mt-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
        <div className="flex items-center gap-2 mb-2">
          <Zap className="h-4 w-4 text-gray-600" />
          <span className="font-medium text-gray-800">Execution Summary</span>
        </div>
        <div className="text-sm text-gray-600">
          <p>
            Completed {intermediateSteps.length} reasoning {intermediateSteps.length === 1 ? 'step' : 'steps'} using tools: {' '}
            <span className="font-mono">
              {[...new Set(intermediateSteps.map(step => step.action?.tool).filter(Boolean))].join(', ')}
            </span>
          </p>
        </div>
      </div>
    </div>
  );
}
