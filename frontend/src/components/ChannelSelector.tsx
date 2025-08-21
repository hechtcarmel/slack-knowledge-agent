import { useState } from 'react';
import { useChannelsQuery } from '@/hooks/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Hash, Users, Search } from 'lucide-react';
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
    channel.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    channel.purpose?.value.toLowerCase().includes(searchQuery.toLowerCase()) ||
    channel.topic?.value.toLowerCase().includes(searchQuery.toLowerCase())
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
          <div className="flex items-center gap-2 text-destructive">
            <span>Failed to load channels: {error.message}</span>
          </div>
        </CardContent>
      </Card>
    );
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
      <CardContent className="space-y-4">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search channels..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Select All Button */}
        {filteredChannels.length > 0 && (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Badge variant="secondary">
                {selectedChannels.length} of {filteredChannels.length} selected
              </Badge>
            </div>
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
          <div className="space-y-3">
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
        ${isSelected ? 'border-primary bg-primary-light/20 shadow-md' : 'border-border hover:bg-accent-light/30'}
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
          {(channel.memberCount !== undefined || channel.num_members !== undefined) && (
            <Badge variant="outline" className="text-xs">
              <Users className="h-3 w-3 mr-1" />
              {channel.memberCount ?? channel.num_members}
            </Badge>
          )}
        </div>
        {channel.description && (
          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
            {channel.description}
          </p>
        )}
        {channel.purpose?.value && (
          <p className="text-xs text-muted-foreground mt-1 italic">
            Purpose: {channel.purpose.value}
          </p>
        )}
      </div>
    </div>
  );
}