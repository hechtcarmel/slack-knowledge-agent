import { Sidebar } from './Sidebar';
import { MobileSidebar } from './MobileSidebar';
import { MainContent } from './MainContent';
import { useUIStore } from '@/stores';
import { useResponsiveLayout } from '@/hooks/useResponsiveLayout';

/**
 * Main application layout component
 * Handles responsive layout, sidebar management, and overall app structure
 */
export function AppLayout() {
  const isMobileSidebarOpen = useUIStore((state) => state.isMobileSidebarOpen);
  const toggleMobileSidebar = useUIStore((state) => state.toggleMobileSidebar);
  const { isMobile, isDesktop } = useResponsiveLayout();

  return (
    <div className="h-screen bg-background">
      <div className="h-full flex">
        {/* Mobile: Hamburger Menu & Sheet Sidebar */}
        {isMobile && (
          <MobileSidebar
            isOpen={isMobileSidebarOpen}
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
