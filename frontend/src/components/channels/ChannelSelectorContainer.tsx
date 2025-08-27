import { ChannelSelector } from '@/components/ChannelSelector';
import { useApp } from '@/hooks/useApp';
import { AlertCircle } from 'lucide-react';

interface ChannelSelectorContainerProps {
  isMobile?: boolean;
}

/**
 * Container component for channel selection
 * Bridges between the ChannelSelector presentation component and app state
 */
export function ChannelSelectorContainer({ isMobile = false }: ChannelSelectorContainerProps) {
  const { channels, handleMobileAction } = useApp();

  const handleSelectionChange = (selectedChannels: string[]) => {
    channels.selectChannels(selectedChannels);
    
    // Auto-close mobile sidebar when channels are selected
    if (isMobile) {
      handleMobileAction();
    }
  };


  if (channels.error) {
    return (
      <div className="flex items-center gap-2 text-destructive p-4">
        <AlertCircle className="h-5 w-5 flex-shrink-0" />
        <span>Failed to load channels: {channels.error.message}</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-medium mb-2">Select Channels</h3>
        <ChannelSelector
          channels={channels.allChannels}
          selectedChannels={channels.selectedChannelIds}
          onSelectionChange={handleSelectionChange}
          isLoading={channels.isLoading}
          hideHeader={true}
        />
      </div>

      {channels.selectedChannelIds.length === 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm">
          <div className="flex items-start gap-2">
            <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
            <p className="text-amber-800">
              Please select at least one channel to start chatting.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
