import { memo } from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Hash, Users, Info } from 'lucide-react';
import { Channel } from '@/types/api';

interface ChannelItemProps {
  channel: Channel;
  isSelected: boolean;
  onToggle: (channelId: string) => void;
}

export const ChannelItem = memo(function ChannelItem({ 
  channel, 
  isSelected, 
  onToggle 
}: ChannelItemProps) {
  return (
    <div className="flex items-start gap-3 p-3 border border-border rounded-lg hover:border-accent-foreground/20 transition-colors">
      <Checkbox
        checked={isSelected}
        onCheckedChange={() => onToggle(channel.id)}
        className="mt-0.5"
      />
      <div 
        className="flex-1 min-w-0 cursor-pointer"
        onClick={() => onToggle(channel.id)}
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
            className="h-8 w-8 p-0 flex-shrink-0"
            onClick={(e) => {
              e.stopPropagation();
            }}
          >
            <Info className="h-4 w-4" />
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
  );
});