import React, { memo, useCallback } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Menu } from 'lucide-react';
import { ChannelSelectorContainer } from '@/components/channels/ChannelSelectorContainerOptimized';
import ErrorBoundary from '@/components/ErrorBoundary';
import { AlertCircle } from 'lucide-react';

interface MobileSidebarProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Optimized mobile sidebar component with React.memo
 * Uses useCallback for stable function references
 */
export const MobileSidebar = memo(function MobileSidebar({ 
  isOpen, 
  onOpenChange 
}: MobileSidebarProps) {
  
  // Stable callback to prevent child re-renders
  const handleReload = useCallback(() => {
    window.location.reload();
  }, []);

  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      {/* Hamburger Menu Button */}
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="fixed top-4 left-4 z-40 lg:hidden"
        >
          <Menu className="h-5 w-5" />
          <span className="sr-only">Open sidebar</span>
        </Button>
      </SheetTrigger>

      {/* Sidebar Content */}
      <SheetContent side="left" className="w-80 p-0 flex flex-col">
        <SheetHeader className="p-4 border-b border-border">
          <SheetTitle className="text-left">Channel Selection</SheetTitle>
        </SheetHeader>
        
        <div className="flex-1 overflow-hidden">
          <ErrorBoundary
            fallback={
              <div className="flex items-center justify-center h-32 text-sm text-muted-foreground">
                <div className="text-center space-y-2">
                  <AlertCircle className="h-8 w-8 mx-auto text-destructive" />
                  <p>Failed to load channels</p>
                  <Button variant="outline" size="sm" onClick={handleReload}>
                    Reload
                  </Button>
                </div>
              </div>
            }
          >
            <div className="p-4">
              <ChannelSelectorContainer isMobile />
            </div>
          </ErrorBoundary>
        </div>
      </SheetContent>
    </Sheet>
  );
});
