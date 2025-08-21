import { useState } from 'react';
import { ConversationSummary, Conversation } from '@/types/chat';
import { Channel } from '@/types/api';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Plus,
  MessageSquare,
  Hash,
  Trash2,
  Settings,
  Users,
  Calendar,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import { cn, formatTimestamp } from '@/lib/utils';

interface ConversationSidebarProps {
  conversations: ConversationSummary[];
  currentConversation: Conversation | null;
  channels: Channel[];
  selectedChannels: string[];
  onConversationSelect: (conversationId: string) => void;
  onNewConversation: () => void;
  onDeleteConversation: (conversationId: string) => void;
  onChannelSelectionChange: (channels: string[]) => void;
  onShowSettings?: () => void;
  isLoading?: boolean;
}

export function ConversationSidebar({
  conversations,
  currentConversation,
  channels,
  selectedChannels,
  onConversationSelect,
  onNewConversation,
  onDeleteConversation,
  onChannelSelectionChange,
  onShowSettings,
  isLoading = false,
}: ConversationSidebarProps) {
  const [showChannelSelector, setShowChannelSelector] = useState(true);

  const handleChannelToggle = (channelId: string) => {
    if (selectedChannels.includes(channelId)) {
      onChannelSelectionChange(selectedChannels.filter(id => id !== channelId));
    } else {
      onChannelSelectionChange([...selectedChannels, channelId]);
    }
  };

  const getChannelName = (channelId: string) => {
    const channel = channels.find(ch => ch.id === channelId);
    return channel?.name || channelId;
  };

  return (
    <div className="w-80 bg-card border-r border-border flex flex-col h-screen">
      {/* Header */}
      <div className="flex-shrink-0 p-4 border-b border-border">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-foreground">Conversations</h2>
          {onShowSettings && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onShowSettings}
              className="h-8 w-8 p-0"
            >
              <Settings className="h-4 w-4" />
            </Button>
          )}
        </div>
        
        <Button
          onClick={onNewConversation}
          className="w-full bg-primary hover:bg-primary/90 text-primary-foreground"
          disabled={isLoading || selectedChannels.length === 0}
        >
          <Plus className="h-4 w-4 mr-2" />
          New Conversation
        </Button>
      </div>

      {/* Channel Selection */}
      <div className="flex-shrink-0 p-4 border-b border-border">
        <button
          onClick={() => setShowChannelSelector(!showChannelSelector)}
          className="flex items-center justify-between w-full text-sm font-medium text-foreground hover:opacity-80 mb-3"
        >
          <div className="flex items-center gap-2">
            <Hash className="h-4 w-4" />
            Channels ({selectedChannels.length})
          </div>
          {showChannelSelector ? (
            <ChevronDown className="h-3 w-3" />
          ) : (
            <ChevronRight className="h-3 w-3" />
          )}
        </button>

        {showChannelSelector && (
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {channels.map(channel => (
              <label
                key={channel.id}
                className="flex items-center space-x-2 cursor-pointer hover:bg-accent/50 rounded p-2"
              >
                <Checkbox
                  checked={selectedChannels.includes(channel.id)}
                  onCheckedChange={() => handleChannelToggle(channel.id)}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <Hash className="h-3 w-3 text-muted-foreground" />
                    <span className="text-sm font-medium truncate">{channel.name}</span>
                  </div>
                  {channel.description && (
                    <p className="text-xs text-muted-foreground truncate mt-0.5">
                      {channel.description}
                    </p>
                  )}
                </div>
                {channel.memberCount && (
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Users className="h-3 w-3" />
                    {channel.memberCount}
                  </div>
                )}
              </label>
            ))}
          </div>
        )}

        {selectedChannels.length === 0 && (
          <div className="text-xs text-muted-foreground mt-2 p-2 bg-amber-50 border border-amber-200 rounded">
            Select channels to start a conversation
          </div>
        )}
      </div>

      {/* Conversation List */}
      <div className="flex-1 overflow-hidden">
        <div className="p-4">
          <h3 className="text-sm font-medium text-muted-foreground mb-3">Recent Chats</h3>
        </div>
        
        <ScrollArea className="flex-1 px-4">
          {conversations.length > 0 ? (
            <div className="space-y-2 pb-4">
              {conversations.map(conv => (
                <div
                  key={conv.id}
                  className={cn(
                    'p-3 rounded-lg border cursor-pointer transition-all hover:bg-accent/50',
                    currentConversation?.id === conv.id 
                      ? 'bg-primary/10 border-primary/30' 
                      : 'bg-card border-border hover:border-primary/30'
                  )}
                  onClick={() => onConversationSelect(conv.id)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <MessageSquare className="h-3 w-3 text-muted-foreground" />
                        <h4 className="text-sm font-medium truncate">
                          {conv.title || 'Untitled Conversation'}
                        </h4>
                      </div>
                      
                      {conv.lastMessage && (
                        <p className="text-xs text-muted-foreground truncate mb-2">
                          {conv.lastMessage}
                        </p>
                      )}
                      
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span>{conv.messageCount} messages</span>
                        <span>•</span>
                        <Calendar className="h-3 w-3" />
                        <span>{formatTimestamp(conv.updatedAt)}</span>
                      </div>
                      
                      {conv.channels.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {conv.channels.slice(0, 2).map(channelId => (
                            <Badge key={channelId} variant="outline" className="text-xs">
                              {getChannelName(channelId)}
                            </Badge>
                          ))}
                          {conv.channels.length > 2 && (
                            <Badge variant="outline" className="text-xs">
                              +{conv.channels.length - 2}
                            </Badge>
                          )}
                        </div>
                      )}
                    </div>
                    
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteConversation(conv.id);
                      }}
                      className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Trash2 className="h-3 w-3 text-muted-foreground hover:text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No conversations yet</p>
              <p className="text-xs">Start a new conversation to get going!</p>
            </div>
          )}
        </ScrollArea>
      </div>
    </div>
  );
}
