import { Hash } from 'lucide-react';
import { useChannelsQuery } from '@/hooks/api';

interface EmbedChannelIndicatorProps {
  channels: string[];
  title?: string;
}

/**
 * Channel indicator component for iframe embed mode
 * 
 * Shows which channels are being searched in place of the sidebar.
 * Provides a subtle, informative header for the embedded chat interface.
 */
export function EmbedChannelIndicator({ 
  channels, 
  title 
}: EmbedChannelIndicatorProps) {
  const { data: channelsData } = useChannelsQuery();
  
  // Get channel names from IDs, fallback to ID if name not found
  const getChannelDisplayName = (channelId: string): string => {
    // Remove # if present in the channelId
    const cleanId = channelId.startsWith('#') ? channelId.slice(1) : channelId;
    
    // Find the channel by ID or name in the fetched channels
    const channel = channelsData?.find((ch) => 
      ch.id === cleanId || ch.name === cleanId
    );
    
    // Return name if found, otherwise return the ID with # prefix
    return channel ? `#${channel.name}` : `#${cleanId}`;
  };

  const displayChannels = channels.map(getChannelDisplayName);

  return (
    <div className="flex-shrink-0 border-b border-border bg-muted/30 px-4 py-3">
      <div className="flex items-center gap-3 min-w-0">
        {/* Channel indicator */}
        <div className="flex items-center gap-2 min-w-0">
          <Hash className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          <div className="flex items-center gap-1 min-w-0">
            <span className="text-sm text-muted-foreground">
              Searching in:
            </span>
            <span className="text-sm font-medium truncate">
              {displayChannels.length <= 3 
                ? displayChannels.join(', ')
                : `${displayChannels.slice(0, 2).join(', ')}, +${displayChannels.length - 2} more`
              }
            </span>
          </div>
        </div>

        {/* Optional custom title */}
        {title && (
          <>
            <div className="w-px h-4 bg-border" />
            <span className="text-sm font-medium text-foreground truncate">
              {title}
            </span>
          </>
        )}
      </div>
    </div>
  );
}