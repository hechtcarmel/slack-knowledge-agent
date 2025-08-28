// Re-export all stores from a central location
export { useUIStore, useIsEmbedMode, useEmbedModeConfig, useEmbedModeChannels } from './useUIStore';
export { useErrorStore, useGlobalError, useChatError, useChannelsError, useApiError, useHasErrors, useErrorCount } from './useErrorStore';
export { useChannelStore, useSelectedChannels, useSelectedChannelCount, useHasSelectedChannels } from './useChannelStore';
export { useSettingsStore, useTheme, useChatSettings, useNotificationSettings, useDeveloperMode, useEffectiveTheme } from './useSettingsStore';

// Re-export types for external usage
export type { ChannelState, ChannelPreference } from './useChannelStore';
export type { SettingsState, ChatSettings, NotificationSettings } from './useSettingsStore';
export type { UIState } from './useUIStore';
export type { ErrorState } from './useErrorStore';