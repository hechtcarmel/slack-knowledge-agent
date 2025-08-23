import React from 'react';
import { Sidebar } from './Sidebar';
import { MobileSidebar } from './MobileSidebar';
import { MainContent } from './MainContent';
import { useApp } from '@/hooks/useApp';

/**
 * Main application layout component
 * Handles responsive layout, sidebar management, and overall app structure
 */
export function AppLayout() {
  const { layout, toggleMobileSidebar, layout: { isMobile, isDesktop } } = useApp();

  return (
    <div className="h-screen bg-background">
      <div className="h-full flex">
        {/* Mobile: Hamburger Menu & Sheet Sidebar */}
        {isMobile && (
          <MobileSidebar
            isOpen={layout.isMobileSidebarOpen}
            onOpenChange={toggleMobileSidebar}
          />
        )}

        {/* Desktop: Fixed Sidebar */}
        {isDesktop && (
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
}
