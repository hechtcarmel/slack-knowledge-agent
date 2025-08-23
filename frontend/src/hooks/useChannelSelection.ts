import { useCallback, useMemo } from 'react';
import { useLocalStorage } from './useLocalStorage';
import { useChannelsQuery } from './api';
import { useErrorHandler } from './useErrorHandler';
import { Channel } from '@/types/api';

const STORAGE_KEY = 'slack-agent-selected-channels';

/**
 * Custom hook for managing channel selection with localStorage persistence
 * Handles validation, filtering, and synchronization with available channels
 */
export function useChannelSelection() {
  const { handleError } = useErrorHandler({ component: 'useChannelSelection' });

  // Get available channels from API
  const {
    data: allChannels = [],
    isLoading: channelsLoading,
    error: channelsError,
  } = useChannelsQuery();

  // Manage selected channel IDs with localStorage persistence
  const [selectedChannelIds, setSelectedChannelIds] = useLocalStorage<string[]>(
    STORAGE_KEY,
    [],
    {
      onError: error => handleError(error, { action: 'localStorage_access' }),
    }
  );

  // Validate and filter selected channels to ensure they still exist
  const validatedSelectedIds = useMemo(() => {
    if (!allChannels.length) return selectedChannelIds;

    return selectedChannelIds.filter(channelId =>
      allChannels.some(channel => channel.id === channelId)
    );
  }, [selectedChannelIds, allChannels]);

  // Update selectedChannelIds if validation removed invalid channels
  const updateValidatedSelection = useCallback(() => {
    if (validatedSelectedIds.length !== selectedChannelIds.length) {
      setSelectedChannelIds(validatedSelectedIds);
    }
  }, [validatedSelectedIds, selectedChannelIds, setSelectedChannelIds]);

  // Get selected channel objects with full details
  const selectedChannels: Channel[] = useMemo(() => {
    return allChannels.filter(channel =>
      validatedSelectedIds.includes(channel.id)
    );
  }, [allChannels, validatedSelectedIds]);

  // Toggle channel selection
  const toggleChannel = useCallback(
    (channelId: string) => {
      setSelectedChannelIds(prev => {
        if (prev.includes(channelId)) {
          return prev.filter(id => id !== channelId);
        } else {
          return [...prev, channelId];
        }
      });
    },
    [setSelectedChannelIds]
  );

  // Select multiple channels
  const selectChannels = useCallback(
    (channelIds: string[]) => {
      // Validate that all channel IDs exist
      const validIds = channelIds.filter(id =>
        allChannels.some(channel => channel.id === id)
      );

      if (validIds.length !== channelIds.length) {
        handleError(
          new Error(
            `Some channel IDs are invalid: ${channelIds.length - validIds.length} out of ${channelIds.length}`
          ),
          { action: 'bulk_select' }
        );
      }

      setSelectedChannelIds(validIds);
    },
    [allChannels, setSelectedChannelIds, handleError]
  );

  // Clear all selections
  const clearSelection = useCallback(() => {
    setSelectedChannelIds([]);
  }, [setSelectedChannelIds]);

  // Add channel to selection
  const addChannel = useCallback(
    (channelId: string) => {
      if (!allChannels.some(channel => channel.id === channelId)) {
        handleError(
          new Error(`Channel ${channelId} not found in available channels`),
          { action: 'add_channel' }
        );
        return;
      }

      setSelectedChannelIds(prev => {
        if (!prev.includes(channelId)) {
          return [...prev, channelId];
        }
        return prev;
      });
    },
    [allChannels, setSelectedChannelIds, handleError]
  );

  // Remove channel from selection
  const removeChannel = useCallback(
    (channelId: string) => {
      setSelectedChannelIds(prev => prev.filter(id => id !== channelId));
    },
    [setSelectedChannelIds]
  );

  // Check if channel is selected
  const isChannelSelected = useCallback(
    (channelId: string) => {
      return validatedSelectedIds.includes(channelId);
    },
    [validatedSelectedIds]
  );

  // Get selection statistics
  const selectionStats = useMemo(
    () => ({
      totalAvailable: allChannels.length,
      totalSelected: validatedSelectedIds.length,
      hasSelection: validatedSelectedIds.length > 0,
      selectionPercentage:
        allChannels.length > 0
          ? Math.round((validatedSelectedIds.length / allChannels.length) * 100)
          : 0,
    }),
    [allChannels.length, validatedSelectedIds.length]
  );

  // Auto-update validated selection when channels change
  updateValidatedSelection();

  return {
    // Channel data
    allChannels,
    selectedChannels,
    selectedChannelIds: validatedSelectedIds,

    // Loading and error states
    isLoading: channelsLoading,
    error: channelsError,

    // Selection actions
    toggleChannel,
    selectChannels,
    addChannel,
    removeChannel,
    clearSelection,
    isChannelSelected,

    // Statistics
    selectionStats,
  };
}
