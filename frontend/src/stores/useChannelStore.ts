import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import type { Channel } from '@/types/api';

export interface ChannelPreference {
  lastSelected: string;
  searchHistory: string[];
  customSettings?: Record<string, any>;
}

export interface ChannelState {
  selectedChannelIds: string[];
  channelPreferences: Record<string, ChannelPreference>;
  
  // Actions
  selectChannel: (channelId: string) => void;
  deselectChannel: (channelId: string) => void;
  toggleChannel: (channelId: string) => void;
  setSelectedChannels: (channelIds: string[]) => void;
  clearSelectedChannels: () => void;
  
  // Bulk operations
  selectAllChannels: (channelIds: string[]) => void;
  selectChannelsByPattern: (pattern: string, allChannels: Channel[]) => void;
  
  // Preferences
  updateChannelPreference: (channelId: string, updates: Partial<ChannelPreference>) => void;
  addToSearchHistory: (channelId: string, query: string) => void;
  
  // Utilities
  getChannelSearchHistory: (channelId: string) => string[];
  isChannelSelected: (channelId: string) => boolean;
}

export const useChannelStore = create<ChannelState>()(
  devtools(
    persist(
      (set, get) => ({
        selectedChannelIds: [],
        channelPreferences: {},
        
        selectChannel: (channelId) =>
          set((state) => {
            if (state.selectedChannelIds.includes(channelId)) return state;
            return {
              selectedChannelIds: [...state.selectedChannelIds, channelId],
              channelPreferences: {
                ...state.channelPreferences,
                [channelId]: {
                  ...state.channelPreferences[channelId],
                  lastSelected: new Date().toISOString(),
                  searchHistory: state.channelPreferences[channelId]?.searchHistory || [],
                },
              },
            };
          }),
        
        deselectChannel: (channelId) =>
          set((state) => ({
            selectedChannelIds: state.selectedChannelIds.filter((id) => id !== channelId),
          })),
        
        toggleChannel: (channelId) => {
          const { selectedChannelIds } = get();
          if (selectedChannelIds.includes(channelId)) {
            get().deselectChannel(channelId);
          } else {
            get().selectChannel(channelId);
          }
        },
        
        setSelectedChannels: (channelIds) =>
          set(() => {
            const now = new Date().toISOString();
            const channelPreferences: Record<string, ChannelPreference> = {};
            channelIds.forEach((id) => {
              channelPreferences[id] = {
                lastSelected: now,
                searchHistory: [],
              };
            });
            return {
              selectedChannelIds: channelIds,
              channelPreferences: {
                ...get().channelPreferences,
                ...channelPreferences,
              },
            };
          }),
        
        clearSelectedChannels: () =>
          set({ selectedChannelIds: [] }),
        
        selectAllChannels: (channelIds) => {
          get().setSelectedChannels(channelIds);
        },
        
        selectChannelsByPattern: (pattern, allChannels) => {
          const matchingChannels = allChannels
            .filter((channel) => 
              channel.name.toLowerCase().includes(pattern.toLowerCase()) ||
              channel.description?.toLowerCase().includes(pattern.toLowerCase())
            )
            .map((channel) => channel.id);
          get().setSelectedChannels(matchingChannels);
        },
        
        updateChannelPreference: (channelId, updates) =>
          set((state) => ({
            channelPreferences: {
              ...state.channelPreferences,
              [channelId]: {
                ...state.channelPreferences[channelId],
                lastSelected: state.channelPreferences[channelId]?.lastSelected || new Date().toISOString(),
                searchHistory: state.channelPreferences[channelId]?.searchHistory || [],
                ...updates,
              },
            },
          })),
        
        addToSearchHistory: (channelId, query) =>
          set((state) => {
            const current = state.channelPreferences[channelId]?.searchHistory || [];
            const updated = [query, ...current.filter((q) => q !== query)].slice(0, 10);
            return {
              channelPreferences: {
                ...state.channelPreferences,
                [channelId]: {
                  ...state.channelPreferences[channelId],
                  lastSelected: state.channelPreferences[channelId]?.lastSelected || new Date().toISOString(),
                  searchHistory: updated,
                },
              },
            };
          }),
        
        getChannelSearchHistory: (channelId) =>
          get().channelPreferences[channelId]?.searchHistory || [],
        
        isChannelSelected: (channelId) =>
          get().selectedChannelIds.includes(channelId),
      }),
      {
        name: 'channel-store',
        partialize: (state) => ({
          selectedChannelIds: state.selectedChannelIds,
          channelPreferences: state.channelPreferences,
        }),
      }
    ),
    { name: 'Channel Store' }
  )
);

// Selector hooks for convenient access
export const useSelectedChannels = () => useChannelStore((state) => state.selectedChannelIds);
export const useSelectedChannelCount = () => useChannelStore((state) => state.selectedChannelIds.length);
export const useHasSelectedChannels = () => useChannelStore((state) => state.selectedChannelIds.length > 0);