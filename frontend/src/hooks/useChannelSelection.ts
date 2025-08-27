import { useCallback, useMemo, useEffect } from 'react';
import { useChannelsQuery } from './api';
import { useChannelStore, useErrorStore } from '@/stores';
import { Channel } from '@/types/api';

/**
 * Custom hook for managing channel selection with Zustand store persistence
 * Handles validation, filtering, and synchronization with available channels
 */
export function useChannelSelection() {
  const setError = useErrorStore((state) => state.setError);

  // Get available channels from API
  const {
    data: allChannels = [],
    isLoading: channelsLoading,
    error: channelsError,
  } = useChannelsQuery();

  // Get channel selection state and actions from Zustand store
  const selectedChannelIds = useChannelStore((state) => state.selectedChannelIds);
  const toggleChannel = useChannelStore((state) => state.toggleChannel);
  const setSelectedChannels = useChannelStore((state) => state.setSelectedChannels);
  const clearSelectedChannels = useChannelStore((state) => state.clearSelectedChannels);
  const selectChannel = useChannelStore((state) => state.selectChannel);
  const deselectChannel = useChannelStore((state) => state.deselectChannel);
  const isChannelSelected = useChannelStore((state) => state.isChannelSelected);

  // Validate and filter selected channels to ensure they still exist
  const validatedSelectedIds = useMemo(() => {
    if (!allChannels.length) return selectedChannelIds;

    return selectedChannelIds.filter(channelId =>
      allChannels.some(channel => channel.id === channelId)
    );
  }, [selectedChannelIds, allChannels]);

  // Auto-update selection to remove invalid channels
  useEffect(() => {
    if (allChannels.length > 0 && validatedSelectedIds.length !== selectedChannelIds.length) {
      setSelectedChannels(validatedSelectedIds);
    }
  }, [validatedSelectedIds, selectedChannelIds, allChannels.length, setSelectedChannels]);

  // Get selected channel objects with full details
  const selectedChannels: Channel[] = useMemo(() => {
    return allChannels.filter(channel =>
      validatedSelectedIds.includes(channel.id)
    );
  }, [allChannels, validatedSelectedIds]);

  // Select multiple channels
  const selectChannels = useCallback(
    (channelIds: string[]) => {
      // Validate that all channel IDs exist
      const validIds = channelIds.filter(id =>
        allChannels.some(channel => channel.id === id)
      );

      if (validIds.length !== channelIds.length) {
        setError('channels', `Some channel IDs are invalid: ${channelIds.length - validIds.length} out of ${channelIds.length}`);
      }

      setSelectedChannels(validIds);
    },
    [allChannels, setSelectedChannels, setError]
  );

  // Add channel to selection
  const addChannel = useCallback(
    (channelId: string) => {
      if (!allChannels.some(channel => channel.id === channelId)) {
        setError('channels', `Channel ${channelId} not found in available channels`);
        return;
      }

      selectChannel(channelId);
    },
    [allChannels, selectChannel, setError]
  );

  // Remove channel from selection
  const removeChannel = useCallback(
    (channelId: string) => {
      deselectChannel(channelId);
    },
    [deselectChannel]
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
    clearSelection: clearSelectedChannels,
    isChannelSelected,

    // Statistics
    selectionStats,
  };
}
