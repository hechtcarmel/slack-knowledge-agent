import { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { MessageSquare, Send, Loader2, FileText, MessageCircle } from 'lucide-react';

interface QueryInputProps {
  query: string;
  onQueryChange: (query: string) => void;
  onSubmit: (query: string, options: QueryOptions) => void;
  isLoading?: boolean;
  disabled?: boolean;
}

interface QueryOptions {
  includeFiles: boolean;
  includeThreads: boolean;
  dateRange?: {
    start?: string;
    end?: string;
  };
}

export function QueryInput({ 
  query, 
  onQueryChange, 
  onSubmit, 
  isLoading = false,
  disabled = false 
}: QueryInputProps) {
  const [options, setOptions] = useState<QueryOptions>({
    includeFiles: true,
    includeThreads: true,
  });
  const [dateRange, setDateRange] = useState({
    start: '',
    end: ''
  });

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [query]);

  const handleSubmit = () => {
    if (!query.trim() || isLoading || disabled) return;

    const finalOptions = {
      ...options,
      dateRange: dateRange.start || dateRange.end ? {
        start: dateRange.start || undefined,
        end: dateRange.end || undefined,
      } : undefined,
    };

    onSubmit(query.trim(), finalOptions);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const characterCount = query.length;
  const maxCharacters = 4000;
  const isNearLimit = characterCount > maxCharacters * 0.8;
  const isOverLimit = characterCount > maxCharacters;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5" />
          Ask a Question
        </CardTitle>
        <CardDescription>
          Ask any question about your Slack workspace content
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Query Input */}
        <div className="space-y-2">
          <Textarea
            ref={textareaRef}
            placeholder="What would you like to know? e.g., 'What decisions were made in the last engineering meeting?' or 'Find discussions about the new product launch'"
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            onKeyDown={handleKeyDown}
            className={`min-h-[100px] resize-none ${
              isOverLimit ? 'border-red-500 focus-visible:ring-red-500' : ''
            }`}
            disabled={disabled}
          />
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">
              Press Cmd+Enter (Mac) or Ctrl+Enter (Windows) to submit
            </span>
            <span className={`
              ${isOverLimit ? 'text-red-600' : isNearLimit ? 'text-orange-600' : 'text-muted-foreground'}
            `}>
              {characterCount} / {maxCharacters}
            </span>
          </div>
        </div>

        {/* Query Options */}
        <div className="space-y-4 border-t pt-4">
          <h4 className="text-sm font-medium">Search Options</h4>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Include Options */}
            <div className="space-y-3">
              <h5 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Include Content
              </h5>
              <div className="space-y-2">
                <label className="flex items-center space-x-2 cursor-pointer">
                  <Checkbox 
                    checked={options.includeFiles}
                    onCheckedChange={(checked) => 
                      setOptions(prev => ({ ...prev, includeFiles: !!checked }))
                    }
                  />
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    <span className="text-sm">Files and attachments</span>
                  </div>
                </label>
                <label className="flex items-center space-x-2 cursor-pointer">
                  <Checkbox 
                    checked={options.includeThreads}
                    onCheckedChange={(checked) => 
                      setOptions(prev => ({ ...prev, includeThreads: !!checked }))
                    }
                  />
                  <div className="flex items-center gap-2">
                    <MessageCircle className="h-4 w-4" />
                    <span className="text-sm">Thread replies</span>
                  </div>
                </label>
              </div>
            </div>

            {/* Date Range */}
            <div className="space-y-3">
              <h5 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Date Range (Optional)
              </h5>
              <div className="space-y-2">
                <div>
                  <label className="text-xs text-muted-foreground">From</label>
                  <input
                    type="date"
                    value={dateRange.start}
                    onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
                    className="w-full mt-1 px-3 py-2 border border-input rounded-md bg-background text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">To</label>
                  <input
                    type="date"
                    value={dateRange.end}
                    onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
                    className="w-full mt-1 px-3 py-2 border border-input rounded-md bg-background text-sm"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Submit Button */}
        <div className="flex items-center justify-between pt-4 border-t">
          <div className="text-xs text-muted-foreground">
            {query.trim() ? (
              <span>Ready to search your selected channels</span>
            ) : (
              <span>Enter your question above</span>
            )}
          </div>
          <Button 
            onClick={handleSubmit}
            disabled={!query.trim() || isLoading || disabled || isOverLimit}
            className="min-w-[120px]"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Searching...
              </>
            ) : (
              <>
                <Send className="h-4 w-4 mr-2" />
                Submit Query
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}