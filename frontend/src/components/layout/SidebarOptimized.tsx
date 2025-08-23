import React, { memo } from 'react';
import { SidebarHeader } from './SidebarHeader';
import { ChannelSelectorContainer } from '@/components/channels/ChannelSelectorContainerOptimized';
import ErrorBoundary from '@/components/ErrorBoundary';
import { AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * Optimized desktop sidebar component with React.memo
 * Prevents re-renders when sidebar content hasn't changed
 */
export const Sidebar = memo(function Sidebar() {
  return (
    <ErrorBoundary
      fallback={
        <div className="flex items-center justify-center h-32 text-sm text-muted-foreground">
          <div className="text-center space-y-2">
            <AlertCircle className="h-8 w-8 mx-auto text-destructive" />
            <p>Failed to load sidebar</p>
            <Button variant="outline" size="sm" onClick={() => window.location.reload()}>
              Reload
            </Button>
          </div>
        </div>
      }
    >
      <div className="flex flex-col h-full">
        {/* Header - memoized separately */}
        <SidebarHeader />
        
        {/* Channel Selection */}
        <div className="flex-1 overflow-hidden p-4">
          <ChannelSelectorContainer />
        </div>
      </div>
    </ErrorBoundary>
  );
});
