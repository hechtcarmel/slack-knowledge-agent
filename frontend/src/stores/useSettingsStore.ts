import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';

export interface ChatSettings {
  showTimestamps: boolean;
  showTokenUsage: boolean;
  showMetadata: boolean;
  autoScroll: boolean;
  markdownRendering: boolean;
}

export interface NotificationSettings {
  enabled: boolean;
  sound: boolean;
  desktop: boolean;
}

export interface SettingsState {
  // Theme and appearance
  theme: 'light' | 'dark' | 'system';
  fontSize: 'small' | 'medium' | 'large';
  compactMode: boolean;
  
  // Chat preferences
  chatSettings: ChatSettings;
  
  // Notification preferences
  notifications: NotificationSettings;
  
  // Developer settings
  developerMode: boolean;
  debugMode: boolean;
  showPerformanceMetrics: boolean;
  
  // Actions
  updateTheme: (theme: SettingsState['theme']) => void;
  updateFontSize: (size: SettingsState['fontSize']) => void;
  toggleCompactMode: () => void;
  updateChatSetting: <K extends keyof ChatSettings>(
    key: K,
    value: ChatSettings[K]
  ) => void;
  updateNotificationSetting: <K extends keyof NotificationSettings>(
    key: K,
    value: NotificationSettings[K]
  ) => void;
  toggleDeveloperMode: () => void;
  toggleDebugMode: () => void;
  resetToDefaults: () => void;
}

const defaultSettings: Omit<SettingsState, keyof Pick<SettingsState, 'updateTheme' | 'updateFontSize' | 'toggleCompactMode' | 'updateChatSetting' | 'updateNotificationSetting' | 'toggleDeveloperMode' | 'toggleDebugMode' | 'resetToDefaults'>> = {
  theme: 'system',
  fontSize: 'medium',
  compactMode: false,
  chatSettings: {
    showTimestamps: true,
    showTokenUsage: false,
    showMetadata: false,
    autoScroll: true,
    markdownRendering: true,
  },
  notifications: {
    enabled: true,
    sound: false,
    desktop: true,
  },
  developerMode: false,
  debugMode: false,
  showPerformanceMetrics: false,
};

export const useSettingsStore = create<SettingsState>()(
  devtools(
    persist(
      (set) => ({
        ...defaultSettings,
        
        updateTheme: (theme) =>
          set({ theme }),
        
        updateFontSize: (fontSize) =>
          set({ fontSize }),
        
        toggleCompactMode: () =>
          set((state) => ({ compactMode: !state.compactMode })),
        
        updateChatSetting: (key, value) =>
          set((state) => ({
            chatSettings: { ...state.chatSettings, [key]: value },
          })),
        
        updateNotificationSetting: (key, value) =>
          set((state) => ({
            notifications: { ...state.notifications, [key]: value },
          })),
        
        toggleDeveloperMode: () =>
          set((state) => ({ 
            developerMode: !state.developerMode,
            debugMode: !state.developerMode ? state.debugMode : false,
          })),
        
        toggleDebugMode: () =>
          set((state) => ({ 
            debugMode: state.developerMode ? !state.debugMode : false,
          })),
        
        resetToDefaults: () =>
          set(defaultSettings),
      }),
      {
        name: 'settings-store',
      }
    ),
    { name: 'Settings Store' }
  )
);

// Selector hooks for convenient access
export const useTheme = () => useSettingsStore((state) => state.theme);
export const useChatSettings = () => useSettingsStore((state) => state.chatSettings);
export const useNotificationSettings = () => useSettingsStore((state) => state.notifications);
export const useDeveloperMode = () => useSettingsStore((state) => state.developerMode);

// Computed selector for effective theme
export const useEffectiveTheme = (): 'light' | 'dark' => {
  const theme = useSettingsStore((state) => state.theme);
  if (theme === 'system') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return theme;
};