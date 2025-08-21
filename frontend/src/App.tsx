import { useState, useEffect } from 'react';
import { ChatContainer } from '@/components/chat/ChatContainer';
import { ConversationSidebar } from '@/components/chat/ConversationSidebar';
import { 
  useConversationsQuery, 
  useConversationQuery,
  useSendMessageMutation,
  useCreateConversationMutation,
  useDeleteConversationMutation,
  useStreamMessage 
} from '@/hooks/chat';
import { useChannelsQuery } from '@/hooks/api';
import { ConversationOptions, ChatMessage } from '@/types/chat';
import { ConversationStorage } from '@/lib/conversation-storage';
import { AlertCircle } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';

function App() {
  // State management
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const [selectedChannels, setSelectedChannels] = useState<string[]>([]);
  const [streamingMessage, setStreamingMessage] = useState('');
  const [error, setError] = useState<string | null>(null);

  // API hooks
  const queryClient = useQueryClient();
  const conversationsQuery = useConversationsQuery();
  const currentConversationQuery = useConversationQuery(currentConversationId);
  const channelsQuery = useChannelsQuery();
  const sendMessageMutation = useSendMessageMutation();
  const createConversationMutation = useCreateConversationMutation();
  const deleteConversationMutation = useDeleteConversationMutation();
  const { streamMessage } = useStreamMessage();

  // Extract data
  const conversations = conversationsQuery.data?.conversations || [];
  const currentConversation = currentConversationQuery.data;
  const channels = channelsQuery.data || [];

  // Default conversation options
  const defaultOptions: ConversationOptions = {
    includeFiles: false,
    includeThreads: true,
  };

  // Restore state from localStorage on mount
  useEffect(() => {
    const savedConversationId = ConversationStorage.getCurrentConversationId();
    const savedChannels = ConversationStorage.getSelectedChannels();
    
    if (savedConversationId) {
      setCurrentConversationId(savedConversationId);
    }
    
    if (savedChannels.length > 0) {
      setSelectedChannels(savedChannels);
    }
  }, []);

  // Save current conversation ID to localStorage
  useEffect(() => {
    ConversationStorage.setCurrentConversationId(currentConversationId);
  }, [currentConversationId]);

  // Save selected channels to localStorage
  useEffect(() => {
    ConversationStorage.setSelectedChannels(selectedChannels);
  }, [selectedChannels]);

  // Update selected channels when conversation changes
  useEffect(() => {
    if (currentConversation && currentConversation.channels.length > 0) {
      setSelectedChannels(currentConversation.channels);
    }
  }, [currentConversation]);

  // Save conversation to localStorage when it updates
  useEffect(() => {
    if (currentConversation) {
      ConversationStorage.saveConversation(currentConversation);
    }
  }, [currentConversation]);

  // Handle sending a message
  const handleSendMessage = async (message: string) => {
    if (selectedChannels.length === 0) {
      setError('Please select at least one channel');
      return;
    }

    setError(null);

    try {
      // Use the regular sendMessage mutation instead of streaming for now
      const response = await sendMessageMutation.mutateAsync({
        conversationId: currentConversationId,
        message,
        channels: selectedChannels,
        options: currentConversationId ? currentConversation?.options || defaultOptions : defaultOptions,
        stream: false,
      });

      // If no current conversation, set the new one
      if (!currentConversationId) {
        setCurrentConversationId(response.conversationId);
      }

      // The mutation's onSuccess handler will update the cache and localStorage
      // Force a refetch to ensure UI is updated
      await currentConversationQuery.refetch();
      await conversationsQuery.refetch();
    } catch (error) {
      console.error('Failed to send message:', error);
      setError(error instanceof Error ? error.message : 'Failed to send message');
    }
  };

  // Handle creating a new conversation
  const handleNewConversation = () => {
    setCurrentConversationId(null);
    setStreamingMessage('');
    setError(null);
  };

  // Handle selecting a conversation
  const handleConversationSelect = (conversationId: string) => {
    setCurrentConversationId(conversationId);
    setStreamingMessage('');
    setError(null);
  };

  // Handle deleting a conversation
  const handleDeleteConversation = async (conversationId: string) => {
    try {
      await deleteConversationMutation.mutateAsync(conversationId);
      
      // If we deleted the current conversation, reset to no conversation
      if (conversationId === currentConversationId) {
        setCurrentConversationId(null);
      }
    } catch (error) {
      console.error('Failed to delete conversation:', error);
      setError('Failed to delete conversation');
    }
  };

  // Handle channel selection changes
  const handleChannelSelectionChange = (channels: string[]) => {
    setSelectedChannels(channels);
  };

  // Loading states
  const isLoading = sendMessageMutation.isPending || 
                   createConversationMutation.isPending ||
                   deleteConversationMutation.isPending;

  // Combined error handling
  const combinedError = error || 
                       sendMessageMutation.error?.message ||
                       createConversationMutation.error?.message ||
                       deleteConversationMutation.error?.message ||
                       conversationsQuery.error?.message ||
                       currentConversationQuery.error?.message ||
                       channelsQuery.error?.message;

  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar */}
      <ConversationSidebar
        conversations={conversations}
        currentConversation={currentConversation || null}
        channels={channels}
        selectedChannels={selectedChannels}
        onConversationSelect={handleConversationSelect}
        onNewConversation={handleNewConversation}
        onDeleteConversation={handleDeleteConversation}
        onChannelSelectionChange={handleChannelSelectionChange}
        isLoading={isLoading}
      />

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        {/* Global Error Display */}
        {combinedError && (
          <div className="flex-shrink-0 bg-red-50 border-b border-red-200 px-4 py-3">
            <div className="flex items-center gap-3 max-w-4xl mx-auto">
              <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0" />
              <div>
                <h3 className="font-medium text-red-800 text-sm">Error</h3>
                <p className="text-red-700 text-sm">{combinedError}</p>
              </div>
            </div>
          </div>
        )}

        <ChatContainer
          conversation={currentConversation || null}
          onSendMessage={handleSendMessage}
          onNewConversation={handleNewConversation}
          isLoading={isLoading}
          streamingMessage={streamingMessage}
          error={combinedError}
          selectedChannels={selectedChannels}
        />
      </div>
    </div>
  );
}

export default App;