import { useMemo } from 'react';

export interface EmbedConfig {
  isEmbedMode: boolean;
  channels: string[];
  theme?: 'light' | 'dark' | 'system';
  readonly?: boolean;
  title?: string;
  initialMessage?: string;
}

/**
 * Custom hook for parsing and managing iframe embed configuration from URL parameters
 * 
 * Supported URL parameters:
 * - embed=true (required to enable embed mode)
 * - channels=channel1,channel2,channel3 (required in embed mode)
 * - theme=light|dark|system (optional theme override)
 * - readonly=true|false (optional readonly mode)
 * - title=Custom Title (optional custom title)
 * - initialMessage=Welcome message (optional initial AI greeting)
 * 
 * @example
 * // URL: ?embed=true&channels=general,dev-team&theme=dark&title=Support%20Chat
 * const config = useEmbedConfig();
 * // Returns: { isEmbedMode: true, channels: ['general', 'dev-team'], theme: 'dark', title: 'Support Chat' }
 */
export function useEmbedConfig(): EmbedConfig {
  return useMemo(() => {
    // Check if we're in a browser environment
    if (typeof window === 'undefined') {
      return { isEmbedMode: false, channels: [] };
    }

    const urlParams = new URLSearchParams(window.location.search);
    const embed = urlParams.get('embed') === 'true';
    
    // If embed mode is not explicitly enabled, return default config
    if (!embed) {
      return { isEmbedMode: false, channels: [] };
    }
    
    // Parse channels parameter (required in embed mode)
    const channelsParam = urlParams.get('channels');
    const channels = channelsParam 
      ? channelsParam
          .split(',')
          .map(channel => channel.trim())
          .filter(channel => channel.length > 0)
      : [];
    
    // Parse optional theme parameter
    const themeParam = urlParams.get('theme');
    const theme = (['light', 'dark', 'system'] as const).includes(themeParam as any) 
      ? (themeParam as EmbedConfig['theme'])
      : undefined;
    
    // Parse optional readonly parameter (defaults to false)
    const readonly = urlParams.get('readonly') === 'true';
    
    // Parse optional title parameter (URL decoded)
    const title = urlParams.get('title') || undefined;
    
    // Parse optional initial message parameter (URL decoded)
    const initialMessage = urlParams.get('initialMessage') || undefined;
    
    return {
      isEmbedMode: true,
      channels,
      theme,
      readonly,
      title,
      initialMessage,
    };
  }, []); // Empty dependency array since URL params don't change during component lifecycle
}

/**
 * Utility function to validate embed configuration
 * @param config EmbedConfig to validate
 * @returns Validation result with error message if invalid
 */
export function validateEmbedConfig(config: EmbedConfig): { 
  isValid: boolean; 
  error?: string; 
} {
  if (!config.isEmbedMode) {
    return { isValid: true };
  }
  
  // In embed mode, channels are required
  if (!config.channels || config.channels.length === 0) {
    return { 
      isValid: false, 
      error: 'At least one channel must be specified in embed mode' 
    };
  }
  
  // Validate channel names (basic validation)
  const invalidChannels = config.channels.filter(channel => 
    !channel || channel.length === 0 || channel.includes(' ')
  );
  
  if (invalidChannels.length > 0) {
    return {
      isValid: false,
      error: `Invalid channel names: ${invalidChannels.join(', ')}`
    };
  }
  
  return { isValid: true };
}

/**
 * Hook that combines embed config with validation
 * @returns Embed configuration with validation status
 */
export function useValidatedEmbedConfig(): EmbedConfig & {
  isValid: boolean;
  error?: string;
} {
  const config = useEmbedConfig();
  const validation = useMemo(() => validateEmbedConfig(config), [config]);
  
  return {
    ...config,
    ...validation,
  };
}