import { MainContent } from './MainContent';

/**
 * Simplified layout component for iframe embed mode
 * 
 * Features:
 * - Full-width layout without sidebar
 * - Channel indicator integrated into chat header
 * - Optimized for iframe context
 * - Maintains responsive design principles
 */
export function EmbedLayout() {
  return (
    <div className="h-screen bg-background flex flex-col">
      {/* Main content area - full width */}
      <div className="flex-1 flex flex-col min-w-0">
        <MainContent />
      </div>
    </div>
  );
}