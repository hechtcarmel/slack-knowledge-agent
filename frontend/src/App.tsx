import { useState, useEffect } from 'react';
import { ChatContainer } from '@/components/chat/ChatContainer';
import { ChannelSelector } from '@/components/ChannelSelector';
import { useChannelsQuery } from '@/hooks/api';
import { useSendMessageMutation } from '@/hooks/chat';
import { ConversationOptions, ChatMessage } from '@/types/chat';
import { AlertCircle, Menu } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import ErrorBoundary from '@/components/ErrorBoundary';
import { ErrorTestButton } from '@/components/ErrorTestButton';
import slackLogo from '@/assets/slack-logo.png';


function App() {
  // State management with localStorage persistence
  const [selectedChannels, setSelectedChannels] = useState<string[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isAiTyping, setIsAiTyping] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [hasRestoredFromStorage, setHasRestoredFromStorage] = useState(false);

  // API hooks
  const channelsQuery = useChannelsQuery();
  const sendMessageMutation = useSendMessageMutation();

  // Extract data
  const channels = channelsQuery.data || [];

  // Save selected channels to localStorage whenever selection changes
  useEffect(() => {
    if (hasRestoredFromStorage) {
      localStorage.setItem('slack-agent-selected-channels', JSON.stringify(selectedChannels));
    }
  }, [selectedChannels, hasRestoredFromStorage]);

  // Load selected channels from localStorage after channels data is available
  useEffect(() => {
    const channelData = channelsQuery.data || [];
    if (!hasRestoredFromStorage && channelData.length > 0) {
      const savedChannels = localStorage.getItem('slack-agent-selected-channels');
      if (savedChannels) {
        try {
          const parsed = JSON.parse(savedChannels);
          if (Array.isArray(parsed)) {
            // Only restore channels that still exist in the current channel list
            const validChannels = parsed.filter(channelId => 
              channelData.some(channel => channel.id === channelId)
            );
            setSelectedChannels(validChannels);
          }
        } catch (error) {
          console.error('Failed to parse saved channels from localStorage:', error);
        }
      }
      setHasRestoredFromStorage(true);
    }
  }, [channelsQuery.data, hasRestoredFromStorage]);

  // Default conversation options
  const defaultOptions: ConversationOptions = {
    includeFiles: false,
    includeThreads: true,
  };

  // Handle sending a message
  const handleSendMessage = async (message: string) => {
    if (selectedChannels.length === 0) {
      setError('Please select at least one channel');
      return;
    }

    setError(null);

    // Add user message immediately to UI
    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: message,
      timestamp: new Date().toISOString(),
    };

    setMessages(prev => [...prev, userMessage]);

    try {
      // Show typing indicator while AI responds
      setIsAiTyping(true);

      // Send message to backend (no conversation tracking)
      const response = await sendMessageMutation.mutateAsync({
        message,
        channels: selectedChannels, // These should be channel IDs
        options: defaultOptions,
        stream: false,
      });

      // Hide typing indicator
      setIsAiTyping(false);

      // Add AI response to messages
      if (response.message) {
        const aiMessage: ChatMessage = {
          id: `ai-${Date.now()}`,
          role: 'assistant',
          content: response.message.content,
          timestamp: new Date().toISOString(),
          metadata: response.message.metadata,
        };
        setMessages(prev => [...prev, aiMessage]);
      }
    } catch (error) {
      console.error('Failed to send message:', error);
      setError(error instanceof Error ? error.message : 'Failed to send message');
      setIsAiTyping(false);
    }
  };

  // Handle creating a new conversation (just clear messages)
  const handleNewConversation = () => {
    setMessages([]);
    setError(null);
  };

  // Create a simple conversation object for the ChatContainer
  const currentConversation = messages.length > 0 ? {
    id: 'current',
    title: 'Chat',
    messages,
    channels: selectedChannels,
    options: defaultOptions,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  } : null;

  // Loading state
  const isLoading = channelsQuery.isLoading || sendMessageMutation.isPending;

  // Combined error state
  const combinedError = error || 
    (channelsQuery.error ? 'Failed to load channels' : null) ||
    (sendMessageMutation.error ? 'Failed to send message' : null);

  // Sidebar content component (shared between mobile and desktop)
  const SidebarContent = () => (
    <div className="p-4 border-b border-border">
      <div className="flex items-center gap-3 mb-4">
        <img src={slackLogo} alt="Slack" className="h-8 w-8" />
        <h2 className="text-lg font-semibold">Slack Knowledge Agent</h2>
      </div>
      
      {/* Channel Selection */}
      <div className="space-y-4">
        <div>
          <h3 className="text-sm font-medium mb-2">Select Channels</h3>
          <ChannelSelector
            channels={channels}
            selectedChannels={selectedChannels}
            onSelectionChange={(channels) => {
              setSelectedChannels(channels);
              // Close mobile sidebar when channels are selected for better UX
              if (window.innerWidth < 1024) {
                setIsMobileSidebarOpen(false);
              }
            }}
            isLoading={isLoading}
            hideHeader={true}
          />
        </div>

        {selectedChannels.length === 0 && (
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
    </div>
  );

  return (
    <div className="h-screen bg-background">
      <div className="h-full flex">
        {/* Mobile: Hamburger Menu */}
        <Sheet open={isMobileSidebarOpen} onOpenChange={setIsMobileSidebarOpen}>
          <SheetTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="fixed top-4 left-4 z-40 lg:hidden"
            >
              <Menu className="h-5 w-5" />
              <span className="sr-only">Open sidebar</span>
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-80 p-0 flex flex-col">
            <SheetHeader className="p-4 border-b border-border">
              <SheetTitle className="text-left">Channel Selection</SheetTitle>
            </SheetHeader>
            <div className="flex-1 overflow-hidden">
              <ErrorBoundary
                fallback={
                  <div className="flex items-center justify-center h-32 text-sm text-muted-foreground">
                    <div className="text-center space-y-2">
                      <AlertCircle className="h-8 w-8 mx-auto text-destructive" />
                      <p>Failed to load channels</p>
                      <Button variant="outline" size="sm" onClick={() => window.location.reload()}>
                        Reload
                      </Button>
                    </div>
                  </div>
                }
              >
                <SidebarContent />
              </ErrorBoundary>
            </div>
          </SheetContent>
        </Sheet>

        {/* Desktop: Fixed Sidebar */}
        <div className="hidden lg:flex lg:w-80 border-r border-border bg-card flex-col h-full">
          <ErrorBoundary
            fallback={
              <div className="flex items-center justify-center h-32 text-sm text-muted-foreground">
                <div className="text-center space-y-2">
                  <AlertCircle className="h-8 w-8 mx-auto text-destructive" />
                  <p>Failed to load sidebar</p>
                  <Button variant="outline" size="sm" onClick={() => window.location.reload()}>
                    Reload
                  </Button>
                </div>
              </div>
            }
          >
            <SidebarContent />
          </ErrorBoundary>
        </div>

        {/* Main Chat Area */}
        <div className="flex-1 flex flex-col min-w-0">
          <ErrorBoundary
            fallback={
              <div className="flex items-center justify-center h-full text-center space-y-4">
                <div>
                  <AlertCircle className="h-12 w-12 mx-auto text-destructive mb-4" />
                  <h2 className="text-lg font-semibold mb-2">Chat Error</h2>
                  <p className="text-muted-foreground mb-4">
                    Something went wrong with the chat interface
                  </p>
                  <Button onClick={() => window.location.reload()}>
                    Reload Application
                  </Button>
                </div>
              </div>
            }
          >
            <ChatContainer
              conversation={currentConversation}
              onSendMessage={handleSendMessage}
              onNewConversation={handleNewConversation}
              isLoading={isLoading}
              isAiTyping={isAiTyping}
              error={combinedError}
              selectedChannels={selectedChannels}
            />
          </ErrorBoundary>
        </div>
      </div>

      {/* Development error testing */}
      <ErrorTestButton />
    </div>
  );
}

export default App;