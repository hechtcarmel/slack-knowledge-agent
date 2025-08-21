import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Send, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ChatInputProps {
  onSendMessage: (message: string) => void;
  isLoading?: boolean;
  disabled?: boolean;
  placeholder?: string;
}

export function ChatInput({ 
  onSendMessage, 
  isLoading = false, 
  disabled = false,
  placeholder = "Type your message..." 
}: ChatInputProps) {
  const [message, setMessage] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const maxCharacters = 4000;
  const characterCount = message.length;
  const isNearLimit = characterCount > maxCharacters * 0.8;
  const isOverLimit = characterCount > maxCharacters;

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  }, [message]);

  // Focus on mount
  useEffect(() => {
    if (textareaRef.current && !disabled) {
      textareaRef.current.focus();
    }
  }, [disabled]);

  const handleSubmit = () => {
    if (!message.trim() || isLoading || disabled || isOverLimit) return;

    onSendMessage(message.trim());
    setMessage('');
    
    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const canSend = message.trim() && !isLoading && !disabled && !isOverLimit;

  return (
    <div className="border-t bg-background p-4 rounded-lg">
      <div className="max-w-4xl mx-auto">
        <div className="flex gap-3 items-center">
          {/* Message Input */}
          <div className="flex-1 space-y-2">
            <div className="relative">
              <Textarea
                ref={textareaRef}
                placeholder={placeholder}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={disabled || isLoading}
                className={cn(
                  'min-h-[50px] max-h-[200px] resize-none pr-12',
                  'focus:ring-2 focus:ring-primary/20 border-border',
                  isOverLimit && 'border-red-500 focus:ring-red-500/20'
                )}
                style={{ 
                  scrollbarWidth: 'thin',
                }}
              />
              
              {/* Character count */}
              <div className={cn(
                'absolute bottom-2 right-2 text-xs px-2 py-1 rounded',
                'bg-background/80 backdrop-blur-sm',
                isOverLimit 
                  ? 'text-red-600' 
                  : isNearLimit 
                    ? 'text-orange-600' 
                    : 'text-muted-foreground'
              )}>
                {characterCount}/{maxCharacters}
              </div>
            </div>

            {/* Helper text */}
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>
                Press Enter to send, Shift+Enter for new line
              </span>
              {isOverLimit && (
                <span className="text-red-600 font-medium">
                  Message too long
                </span>
              )}
            </div>
          </div>

          {/* Send Button */}
          <Button
            onClick={handleSubmit}
            disabled={!canSend}
            size="lg"
            className={cn(
              'h-[50px] px-6 rounded-lg',
              'bg-primary hover:bg-primary/90 text-primary-foreground',
              'disabled:opacity-50 disabled:cursor-not-allowed',
              'shadow-lg hover:shadow-xl transition-all duration-200',
              canSend && 'hover:scale-105'
            )}
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Sending...
              </>
            ) : (
              <>
                <Send className="h-4 w-4 mr-2" />
                Send
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
