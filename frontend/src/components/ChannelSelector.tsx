import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { useChannelsQuery } from '@/hooks/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Hash, Search, X } from 'lucide-react';
import { Channel } from '@/types/api';
import { ChannelItem } from './ChannelItem';

interface ChannelSelectorProps {
  selectedChannels: string[];
  onSelectionChange: (channels: string[]) => void;
  hideHeader?: boolean;
  channels?: Channel[];
  isLoading?: boolean;
}

export function ChannelSelector({ 
  selectedChannels, 
  onSelectionChange, 
  hideHeader = false,
  channels: providedChannels,
  isLoading: providedLoading
}: ChannelSelectorProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const { data: fetchedChannels, isLoading: fetchLoading, error } = useChannelsQuery();
  
  // Use provided channels/loading or fallback to fetched data
  const channels = providedChannels || fetchedChannels;
  const isLoading = providedLoading ?? fetchLoading;

  // Memoized filtered channels - only recalculates when channels or searchQuery change
  const filteredChannels = useMemo(() => 
    channels?.filter(channel =>
      channel.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      channel.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      channel.purpose?.value.toLowerCase().includes(searchQuery.toLowerCase()) ||
      channel.topic?.value.toLowerCase().includes(searchQuery.toLowerCase())
    ) || [], [channels, searchQuery]
  );

  // Use ref to maintain latest selectedChannels without causing re-renders
  const selectedChannelsRef = useRef(selectedChannels);
  
  // Keep ref in sync with prop
  useEffect(() => {
    selectedChannelsRef.current = selectedChannels;
  }, [selectedChannels]);

  // Stable callback that never changes reference
  const handleChannelToggle = useCallback((channelId: string) => {
    const current = selectedChannelsRef.current;
    const isCurrentlySelected = current.includes(channelId);
    if (isCurrentlySelected) {
      onSelectionChange(current.filter(id => id !== channelId));
    } else {
      onSelectionChange([...current, channelId]);
    }
  }, [onSelectionChange]);

  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
  }, []);

  const handleClearAll = useCallback(() => {
    onSelectionChange([]);
  }, [onSelectionChange]);

  // Main content JSX - no inner component definition to prevent re-creation
  const selectorContentJSX = (
    <div className="space-y-4 flex flex-col h-full">
      {/* Search */}
      <div className="relative flex-shrink-0">
        <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
        <Input
          type="text"
          placeholder="Search channels..."
          value={searchQuery}
          onChange={handleSearchChange}
          className="pl-10"
        />
      </div>

      {/* Selection Status */}
      {filteredChannels.length > 0 && selectedChannels.length > 0 && (
        <div className="flex items-center justify-between gap-2 flex-shrink-0">
          <Badge variant="secondary">
            {selectedChannels.length} selected
          </Badge>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClearAll}
            className="h-6 px-2 text-xs text-muted-foreground hover:text-destructive"
          >
            <X className="h-3 w-3 mr-1" />
            Clear all
          </Button>
        </div>
      )}

      {/* Loading State */}
      {isLoading && (
        <div className="space-y-3 flex-1">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="flex items-center space-x-3 p-3 border rounded-lg">
              <Skeleton className="h-4 w-4 rounded" />
              <div className="flex-1 space-y-2">
                <div className="flex items-center space-x-2">
                  <Skeleton className="h-4 w-4" />
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-5 w-12 rounded-full" />
                </div>
                <Skeleton className="h-3 w-full" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Channel List - Simple scrollable list */}
      {!isLoading && (
        <div className="flex-1 min-h-0">
          {filteredChannels.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {searchQuery ? 'No channels match your search' : 'No channels available'}
            </div>
          ) : (
            <div className="space-y-2 overflow-y-auto h-full pr-2">
              {filteredChannels.map((channel) => (
                <ChannelItem
                  key={channel.id}
                  channel={channel}
                  isSelected={selectedChannels.includes(channel.id)}
                  onToggle={handleChannelToggle}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );

  if (error) {
    const errorContent = (
      <div className="flex items-center gap-2 text-destructive">
        <span>Failed to load channels: {error.message}</span>
      </div>
    );

    if (hideHeader) {
      return errorContent;
    }

    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Hash className="h-5 w-5" />
            Select Channels
          </CardTitle>
          <CardDescription>Choose which channels to search</CardDescription>
        </CardHeader>
        <CardContent>
          {errorContent}
        </CardContent>
      </Card>
    );
  }

  // Return content with or without Card wrapper
  if (hideHeader) {
    return selectorContentJSX;
  }

  return (
    <Card className="border-accent/20 bg-gradient-to-br from-card to-accent-light/10 shadow-lg">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-primary">
          <Hash className="h-5 w-5 text-primary" />
          Select Channels
        </CardTitle>
        <CardDescription>
          Choose which channels to search for your query
        </CardDescription>
      </CardHeader>
      <CardContent>
        {selectorContentJSX}
      </CardContent>
    </Card>
  );
}