import { AppLayout } from '@/components/layout/AppLayout';
import ErrorBoundary from '@/components/ErrorBoundary';

/**
 * Main App component - streamlined with Zustand state management
 * 
 * This component is now focused solely on:
 * 1. Error boundary wrapping  
 * 2. Layout orchestration
 * 
 * State management is handled by:
 * - Zustand stores (UI, Error, Channel, Settings)
 * - TanStack Query (Server state)
 * - Custom hooks (useChatManager for session state)
 */
function App() {
  return (
    <ErrorBoundary
      onError={(error, errorInfo) => {
        console.error('Global error boundary caught:', error, errorInfo);
        // In production, log to error reporting service
      }}
    >
      <AppLayout />
    </ErrorBoundary>
  );
}

export default App;
