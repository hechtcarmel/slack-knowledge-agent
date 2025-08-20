import { useState } from 'react';
import { useChannelsQuery } from '@/hooks/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Loader2, Hash, Users, Search } from 'lucide-react';
import { Channel } from '@/types/api';

interface ChannelSelectorProps {
  selectedChannels: string[];
  onSelectionChange: (channels: string[]) => void;
}

export function ChannelSelector({ selectedChannels, onSelectionChange }: ChannelSelectorProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const { data: channels, isLoading, error } = useChannelsQuery();

  const filteredChannels = channels?.filter(channel =>
    channel.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    channel.description?.toLowerCase().includes(searchQuery.toLowerCase())
  ) || [];

  const handleChannelToggle = (channelId: string) => {
    if (selectedChannels.includes(channelId)) {
      onSelectionChange(selectedChannels.filter(id => id !== channelId));
    } else {
      onSelectionChange([...selectedChannels, channelId]);
    }
  };

  const handleSelectAll = () => {
    if (selectedChannels.length === filteredChannels.length) {
      onSelectionChange([]);
    } else {
      onSelectionChange(filteredChannels.map(channel => channel.id));
    }
  };

  if (error) {
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
          <div className="flex items-center gap-2 text-red-600">
            <span>Failed to load channels: {error.message}</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Hash className="h-5 w-5" />
          Select Channels
        </CardTitle>
        <CardDescription>
          Choose which channels to search for your query
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search channels..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-input rounded-md bg-background text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>

        {/* Select All Button */}
        {filteredChannels.length > 0 && (
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">
              {selectedChannels.length} of {filteredChannels.length} selected
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={handleSelectAll}
            >
              {selectedChannels.length === filteredChannels.length ? 'Deselect All' : 'Select All'}
            </Button>
          </div>
        )}

        {/* Loading State */}
        {isLoading && (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin" />
            <span className="ml-2">Loading channels...</span>
          </div>
        )}

        {/* Channel List */}
        {!isLoading && (
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {filteredChannels.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                {searchQuery ? 'No channels match your search' : 'No channels available'}
              </div>
            ) : (
              filteredChannels.map((channel) => (
                <ChannelCard
                  key={channel.id}
                  channel={channel}
                  isSelected={selectedChannels.includes(channel.id)}
                  onToggle={() => handleChannelToggle(channel.id)}
                />
              ))
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

interface ChannelCardProps {
  channel: Channel;
  isSelected: boolean;
  onToggle: () => void;
}

function ChannelCard({ channel, isSelected, onToggle }: ChannelCardProps) {
  return (
    <div 
      className={`
        flex items-start space-x-3 p-3 border rounded-lg cursor-pointer transition-colors
        ${isSelected ? 'border-primary bg-primary/5' : 'border-border hover:bg-accent'}
      `}
      onClick={onToggle}
    >
      <Checkbox 
        checked={isSelected} 
        onChange={onToggle}
        className="mt-1"
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <Hash className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          <span className="font-medium text-sm">{channel.name}</span>
          {channel.memberCount !== undefined && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Users className="h-3 w-3" />
              <span>{channel.memberCount}</span>
            </div>
          )}
        </div>
        {channel.description && (
          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
            {channel.description}
          </p>
        )}
        {channel.purpose && (
          <p className="text-xs text-muted-foreground mt-1 italic">
            Purpose: {channel.purpose}
          </p>
        )}
      </div>
    </div>
  );
}