import { ChannelSelector } from '@/components/ChannelSelector';
import { useChannelSelection } from '@/hooks/useChannelSelection';
import { useUIStore } from '@/stores';
import { AlertCircle, Info, Copy, Check } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useState } from 'react';

interface ChannelSelectorContainerProps {
  isMobile?: boolean;
}

/**
 * Container component for channel selection
 * Bridges between the ChannelSelector presentation component and channel state
 */
export function ChannelSelectorContainer({ isMobile = false }: ChannelSelectorContainerProps) {
  const channels = useChannelSelection();
  const closeMobileSidebar = useUIStore((state) => state.closeMobileSidebar);
  const [copied, setCopied] = useState(false);

  const inviteCommand = "/invite @Slack Knowledge Agent Test";

  const handleSelectionChange = (selectedChannels: string[]) => {
    channels.selectChannels(selectedChannels);
    
    // Auto-close mobile sidebar when channels are selected
    if (isMobile) {
      closeMobileSidebar();
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(inviteCommand);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000); // Reset after 2 seconds
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
      // Fallback for browsers that don't support clipboard API
      const textArea = document.createElement('textarea');
      textArea.value = inviteCommand;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
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
        <div className="flex items-center gap-2 mb-2">
          <h3 className="text-sm font-medium">Select Channels</h3>
          <Tooltip>
            <TooltipTrigger asChild>
              <button 
                type="button"
                className="inline-flex items-center justify-center rounded-sm p-0.5 hover:bg-accent hover:text-accent-foreground"
              >
                <Info className="h-4 w-4 text-muted-foreground" />
                <span className="sr-only">Channel access information</span>
              </button>
            </TooltipTrigger>
            <TooltipContent side="right" className="max-w-xs">
              <div className="space-y-2">
                <p>The agent only has access to channels it was invited to.</p>
                <div className="text-xs text-muted-foreground">
                  <p className="mb-1">Invite with:</p>
                  <div className="flex items-center gap-2 p-2 bg-muted rounded">
                    <code className="flex-1 text-xs">{inviteCommand}</code>
                    <button
                      onClick={handleCopy}
                      className="inline-flex items-center justify-center w-6 h-6 rounded hover:bg-background transition-colors"
                      title={copied ? "Copied!" : "Copy command"}
                    >
                      {copied ? (
                        <Check className="h-3 w-3 text-green-600" />
                      ) : (
                        <Copy className="h-3 w-3" />
                      )}
                    </button>
                  </div>
                  {copied && (
                    <p className="text-xs text-green-600 mt-1">Copied to clipboard!</p>
                  )}
                </div>
              </div>
            </TooltipContent>
          </Tooltip>
        </div>
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
