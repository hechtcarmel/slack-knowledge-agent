import { memo } from 'react';
import { ChannelSelector } from '@/components/ChannelSelector';
import { AlertCircle } from 'lucide-react';
import slackLogo from '@/assets/slack-logo.png';
import { Channel } from '@/types/api';

interface SidebarChannelSelectionProps {
  selectedChannels: string[];
  channels: Channel[];
  isLoading: boolean;
  onChannelChange: (channels: string[]) => void;
}

export const SidebarChannelSelection = memo(function SidebarChannelSelection({ 
  selectedChannels, 
  channels, 
  isLoading, 
  onChannelChange 
}: SidebarChannelSelectionProps) {
  return (
    <div className="p-4 h-full flex flex-col">
      <div className="flex flex-col h-full space-y-4">
        <div className="flex-1 flex flex-col min-h-0">
          <h3 className="text-sm font-medium mb-2 flex-shrink-0">Select Channels</h3>
          <div className="flex-1 min-h-0">
            <ChannelSelector
              channels={channels}
              selectedChannels={selectedChannels}
              onSelectionChange={onChannelChange}
              isLoading={isLoading}
              hideHeader={true}
            />
          </div>
        </div>
        {selectedChannels.length === 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm flex-shrink-0">
            <div className="flex items-start gap-2">
              <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
              <p className="text-amber-800">
                Please select at least one channel to start chatting.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
});

interface SidebarContentProps {
  selectedChannels: string[];
  channels: Channel[];
  isLoading: boolean;
  onChannelChange: (channels: string[]) => void;
}

export const SidebarContent = memo(function SidebarContent({ 
  selectedChannels, 
  channels, 
  isLoading, 
  onChannelChange 
}: SidebarContentProps) {
  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-border flex-shrink-0">
        <div className="flex items-center gap-3 mb-4">
          <img src={slackLogo} alt="Slack" className="h-8 w-8" />
          <h2 className="text-lg font-semibold">Slack Knowledge Agent</h2>
        </div>
      </div>
      
      {/* Channel Selection - optimized for large lists */}
      <div className="flex-1 overflow-hidden">
        <SidebarChannelSelection
          selectedChannels={selectedChannels}
          channels={channels}
          isLoading={isLoading}
          onChannelChange={onChannelChange}
        />
      </div>
    </div>
  );
});