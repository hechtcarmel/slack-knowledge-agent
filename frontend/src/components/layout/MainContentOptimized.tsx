import React, { memo, useCallback } from 'react';
import { ChatContainer } from '@/components/chat/ChatContainerOptimized';
import ErrorBoundary from '@/components/ErrorBoundary';
import { AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * Optimized main content area component with React.memo
 * Contains the chat interface with performance optimizations
 */
export const MainContent = memo(function MainContent() {
  
  // Stable callback to prevent re-renders
  const handleReload = useCallback(() => {
    window.location.reload();
  }, []);

  return (
    <ErrorBoundary
      fallback={
        <div className="flex items-center justify-center h-full text-center space-y-4">
          <div>
            <AlertCircle className="h-12 w-12 mx-auto text-destructive mb-4" />
            <h2 className="text-lg font-semibold mb-2">Chat Error</h2>
            <p className="text-muted-foreground mb-4">
              Something went wrong with the chat interface
            </p>
            <Button onClick={handleReload}>
              Reload Application
            </Button>
          </div>
        </div>
      }
    >
      <ChatContainer />
    </ErrorBoundary>
  );
});
