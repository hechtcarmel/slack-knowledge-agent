import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import type { EmbedConfig } from '@/hooks/useEmbedConfig';

export interface UIState {
  // Sidebar state
  isMobileSidebarOpen: boolean;
  toggleMobileSidebar: () => void;
  closeMobileSidebar: () => void;
  
  // View state
  currentView: 'chat' | 'settings';
  setCurrentView: (view: 'chat' | 'settings') => void;
  
  // Loading states
  isGlobalLoading: boolean;
  setGlobalLoading: (loading: boolean) => void;
  
  // Modal states
  modals: {
    settings: boolean;
    channelInfo: boolean;
    messageDetails: boolean;
  };
  openModal: (modal: keyof UIState['modals']) => void;
  closeModal: (modal: keyof UIState['modals']) => void;
  closeAllModals: () => void;
  
  // Embed mode state
  embedMode: {
    isEnabled: boolean;
    config: EmbedConfig | null;
  };
  setEmbedMode: (config: EmbedConfig) => void;
  clearEmbedMode: () => void;
}

export const useUIStore = create<UIState>()(
  devtools(
    persist(
      (set) => ({
        // Initial state
        isMobileSidebarOpen: false,
        currentView: 'chat',
        isGlobalLoading: false,
        modals: {
          settings: false,
          channelInfo: false,
          messageDetails: false,
        },
        embedMode: {
          isEnabled: false,
          config: null,
        },
        
        // Actions
        toggleMobileSidebar: () =>
          set((state) => ({ isMobileSidebarOpen: !state.isMobileSidebarOpen })),
        
        closeMobileSidebar: () =>
          set({ isMobileSidebarOpen: false }),
        
        setCurrentView: (view) =>
          set({ currentView: view }),
        
        setGlobalLoading: (loading) =>
          set({ isGlobalLoading: loading }),
        
        openModal: (modal) =>
          set((state) => ({
            modals: { ...state.modals, [modal]: true },
          })),
        
        closeModal: (modal) =>
          set((state) => ({
            modals: { ...state.modals, [modal]: false },
          })),
        
        closeAllModals: () =>
          set({
            modals: {
              settings: false,
              channelInfo: false,
              messageDetails: false,
            },
          }),
        
        setEmbedMode: (config) =>
          set({
            embedMode: {
              isEnabled: config.isEmbedMode,
              config,
            },
          }),
        
        clearEmbedMode: () =>
          set({
            embedMode: {
              isEnabled: false,
              config: null,
            },
          }),
      }),
      {
        name: 'ui-store',
        partialize: (state) => ({
          currentView: state.currentView,
          // Don't persist modal states, mobile sidebar, or embed mode (URL-based)
        }),
      }
    ),
    { name: 'UI Store' }
  )
);

// Selector hooks for convenient access to embed mode state
export const useIsEmbedMode = () => useUIStore((state) => state.embedMode.isEnabled);
export const useEmbedModeConfig = () => useUIStore((state) => state.embedMode.config);
export const useEmbedModeChannels = () => useUIStore((state) => state.embedMode.config?.channels || []);