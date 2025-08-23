import React from 'react';
import { SidebarHeader } from './SidebarHeader';
import { ChannelSelectorContainer } from '@/components/channels/ChannelSelectorContainer';
import ErrorBoundary from '@/components/ErrorBoundary';
import { AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * Desktop sidebar component
 * Contains channel selector and app navigation
 */
export function Sidebar() {
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
        {/* Header */}
        <SidebarHeader />
        
        {/* Channel Selection */}
        <div className="flex-1 overflow-hidden p-4">
          <ChannelSelectorContainer />
        </div>
      </div>
    </ErrorBoundary>
  );
}
