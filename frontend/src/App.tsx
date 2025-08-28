import { useEffect } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import ErrorBoundary from '@/components/ErrorBoundary';
import { TooltipProvider } from '@/components/ui/tooltip';
import { useEmbedConfig } from '@/hooks/useEmbedConfig';
import { useUIStore, useChannelStore } from '@/stores';

/**
 * Main App component - streamlined with Zustand state management
 * 
 * This component is now focused on:
 * 1. Error boundary wrapping  
 * 2. Layout orchestration
 * 3. Tooltip provider for global tooltip functionality
 * 4. Embed mode initialization (when applicable)
 * 
 * State management is handled by:
 * - Zustand stores (UI, Error, Channel, Settings)
 * - TanStack Query (Server state)
 * - Custom hooks (useChatManager for session state)
 */
function App() {
  const embedConfig = useEmbedConfig();
  const setEmbedMode = useUIStore((state) => state.setEmbedMode);
  const setEmbedChannels = useChannelStore((state) => state.setEmbedChannels);

  // Initialize embed mode when app starts
  useEffect(() => {
    if (embedConfig.isEmbedMode) {
      // Set embed mode in UI store
      setEmbedMode(embedConfig);
      
      // Set channels from embed config
      if (embedConfig.channels.length > 0) {
        setEmbedChannels(embedConfig.channels);
      }
    }
  }, [embedConfig, setEmbedMode, setEmbedChannels]);

  return (
    <ErrorBoundary
      onError={(error, errorInfo) => {
        console.error('Global error boundary caught:', error, errorInfo);
        // In production, log to error reporting service
      }}
    >
      <TooltipProvider delayDuration={300}>
        <AppLayout />
      </TooltipProvider>
    </ErrorBoundary>
  );
}

export default App;
