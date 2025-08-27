import { AppStateProvider } from '@/contexts/AppStateContext';
import { AppLayout } from '@/components/layout/AppLayout';
import ErrorBoundary from '@/components/ErrorBoundary';

/**
 * Main App component - completely refactored for readability and maintainability
 * 
 * This component is now focused solely on:
 * 1. Providing app-level context
 * 2. Error boundary wrapping  
 * 3. Layout orchestration
 * 
 * All business logic has been extracted to:
 * - Custom hooks (useApp, useChatManager, useChannelSelection, etc.)
 * - Service layers (StorageService, NotificationService)
 * - Context providers (AppStateProvider)
 * - Focused components (AppLayout, Sidebar, ChatContainer, etc.)
 */
function App() {
  return (
    <ErrorBoundary
      onError={(error, errorInfo) => {
        console.error('Global error boundary caught:', error, errorInfo);
        // In production, log to error reporting service
      }}
    >
      <AppStateProvider>
        <AppLayout />
      </AppStateProvider>
    </ErrorBoundary>
  );
}

export default App;
