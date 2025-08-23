import React from 'react';
import { ChatContainer } from '@/components/chat/ChatContainer';
import ErrorBoundary from '@/components/ErrorBoundary';
import { AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * Main content area component
 * Contains the chat interface and handles chat-related errors
 */
export function MainContent() {
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
            <Button onClick={() => window.location.reload()}>
              Reload Application
            </Button>
          </div>
        </div>
      }
    >
      <ChatContainer />
    </ErrorBoundary>
  );
}
