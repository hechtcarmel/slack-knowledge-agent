import { useState, useEffect } from 'react';
import { ChatContainer } from '@/components/chat/ChatContainer';
import { ChannelSelector } from '@/components/ChannelSelector';
import { useChannelsQuery } from '@/hooks/api';
import { useSendMessageMutation } from '@/hooks/chat';
import { ConversationOptions, ChatMessage } from '@/types/chat';
import { AlertCircle } from 'lucide-react';
import slackLogo from '@/assets/slack-logo.png';


function App() {
  // State management with localStorage persistence
  const [selectedChannels, setSelectedChannels] = useState<string[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isAiTyping, setIsAiTyping] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load selected channels from localStorage on mount
  useEffect(() => {
    const savedChannels = localStorage.getItem('slack-agent-selected-channels');
    if (savedChannels) {
      try {
        const parsed = JSON.parse(savedChannels);
        if (Array.isArray(parsed)) {
          setSelectedChannels(parsed);
        }
      } catch (error) {
        console.error('Failed to parse saved channels from localStorage:', error);
      }
    }
  }, []);

  // Save selected channels to localStorage whenever selection changes
  useEffect(() => {
    localStorage.setItem('slack-agent-selected-channels', JSON.stringify(selectedChannels));
  }, [selectedChannels]);

  // API hooks
  const channelsQuery = useChannelsQuery();
  const sendMessageMutation = useSendMessageMutation();

  // Extract data
  const channels = channelsQuery.data || [];

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

  return (
    <div className="h-screen bg-background">
      <div className="h-full flex">
        {/* Channel Selection Sidebar */}
        <div className="w-80 border-r border-border bg-card flex flex-col h-full">
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
                  onSelectionChange={setSelectedChannels}
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
        </div>

        {/* Main Chat Area */}
        <ChatContainer
          conversation={currentConversation}
          onSendMessage={handleSendMessage}
          onNewConversation={handleNewConversation}
          isLoading={isLoading}
          isAiTyping={isAiTyping}
          error={combinedError}
          selectedChannels={selectedChannels}
        />
      </div>
    </div>
  );
}

export default App;