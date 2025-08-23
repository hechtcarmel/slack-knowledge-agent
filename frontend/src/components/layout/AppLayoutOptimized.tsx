import React, { memo } from 'react';
import { Sidebar } from './SidebarOptimized';
import { MobileSidebar } from './MobileSidebarOptimized';
import { MainContent } from './MainContentOptimized';
import { useApp } from '@/hooks/useApp';

/**
 * Optimized main application layout component with React.memo
 * Prevents unnecessary re-renders when app state hasn't changed
 */
export const AppLayout = memo(function AppLayout() {
  const { layout, toggleMobileSidebar } = useApp();

  return (
    <div className="h-screen bg-background">
      <div className="h-full flex">
        {/* Mobile: Hamburger Menu & Sheet Sidebar */}
        {layout.isMobile && (
          <MobileSidebar
            isOpen={layout.isMobileSidebarOpen}
            onOpenChange={toggleMobileSidebar}
          />
        )}

        {/* Desktop: Fixed Sidebar */}
        {layout.isDesktop && (
          <div className="w-80 border-r border-border bg-card flex-col h-full flex">
            <Sidebar />
          </div>
        )}

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col min-w-0">
          <MainContent />
        </div>
      </div>
    </div>
  );
});
