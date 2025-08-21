import { useState } from 'react';
import { useChannelsQuery } from '@/hooks/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Hash, Users, Search, Info } from 'lucide-react';
import { Channel } from '@/types/api';

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



  // Content component
  const SelectorContent = () => (
    <div className="space-y-4 flex flex-col h-full">
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

      {/* Selection Status */}
      {filteredChannels.length > 0 && selectedChannels.length > 0 && (
        <div className="flex items-center gap-2">
          <Badge variant="secondary">
            {selectedChannels.length} selected
          </Badge>
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
        <div className="space-y-2 flex-1 overflow-y-auto">
          {filteredChannels.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {searchQuery ? 'No channels match your search' : 'No channels available'}
            </div>
          ) : (
            filteredChannels.map((channel) => (
              <div
                key={channel.id}
                className="flex items-start gap-3 p-3 border border-border rounded-lg hover:border-accent-foreground/20 transition-colors"
              >
                <Checkbox
                  checked={selectedChannels.includes(channel.id)}
                  onCheckedChange={() => handleChannelToggle(channel.id)}
                  className="mt-0.5"
                />
                <div 
                  className="flex-1 min-w-0 cursor-pointer"
                  onClick={() => handleChannelToggle(channel.id)}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <Hash className="h-4 w-4 text-primary flex-shrink-0" />
                    <span className="font-medium text-sm">{channel.name}</span>
                  </div>
                  {(channel.purpose?.value || channel.topic?.value) && (
                    <p className="text-xs text-muted-foreground line-clamp-2">
                      Purpose: {channel.purpose?.value || channel.topic?.value}
                    </p>
                  )}
                </div>
                <Dialog>
                  <DialogTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0 flex-shrink-0"
                      onClick={(e) => {
                        e.stopPropagation();
                      }}
                    >
                      <Info className="h-3 w-3" />
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-md">
                    <DialogHeader>
                      <DialogTitle className="flex items-center gap-2">
                        <Hash className="h-4 w-4 text-primary" />
                        {channel.name}
                      </DialogTitle>
                      <DialogDescription>
                        Channel information and details
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <Users className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm font-medium">Members</span>
                          <Badge variant="outline">{channel.num_members || 0}</Badge>
                        </div>
                      </div>
                      
                      {channel.purpose?.value && (
                        <div className="space-y-2">
                          <h4 className="text-sm font-medium">Purpose</h4>
                          <p className="text-sm text-muted-foreground">{channel.purpose.value}</p>
                          <p className="text-xs text-muted-foreground">
                            Set by {channel.purpose.creator} on {new Date(channel.purpose.last_set * 1000).toLocaleDateString()}
                          </p>
                        </div>
                      )}
                      
                      {channel.topic?.value && (
                        <div className="space-y-2">
                          <h4 className="text-sm font-medium">Topic</h4>
                          <p className="text-sm text-muted-foreground">{channel.topic.value}</p>
                          <p className="text-xs text-muted-foreground">
                            Set by {channel.topic.creator} on {new Date(channel.topic.last_set * 1000).toLocaleDateString()}
                          </p>
                        </div>
                      )}
                      
                      {channel.description && (
                        <div className="space-y-2">
                          <h4 className="text-sm font-medium">Description</h4>
                          <p className="text-sm text-muted-foreground">{channel.description}</p>
                        </div>
                      )}
                      
                      <div className="space-y-2">
                        <h4 className="text-sm font-medium">Channel ID</h4>
                        <code className="text-xs bg-muted px-2 py-1 rounded">{channel.id}</code>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            ))
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
    return <SelectorContent />;
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
        <SelectorContent />
      </CardContent>
    </Card>
  );
}