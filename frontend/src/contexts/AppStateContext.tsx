import React, { createContext, useContext, useReducer, ReactNode } from 'react';
import { ChatMessage } from '@/types/chat';

// State interfaces
export interface UIState {
  isMobileSidebarOpen: boolean;
  isLoading: boolean;
  currentView: 'chat' | 'settings';
}

export interface ErrorState {
  global: string | null;
  chat: string | null;
  channels: string | null;
}

export interface AppState {
  ui: UIState;
  error: ErrorState;
  chatMessages: ChatMessage[];
  selectedChannelIds: string[];
}

// Action types
export type AppAction =
  | { type: 'SET_MOBILE_SIDEBAR'; payload: boolean }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_CURRENT_VIEW'; payload: 'chat' | 'settings' }
  | { type: 'SET_GLOBAL_ERROR'; payload: string | null }
  | { type: 'SET_CHAT_ERROR'; payload: string | null }
  | { type: 'SET_CHANNELS_ERROR'; payload: string | null }
  | { type: 'CLEAR_ALL_ERRORS' }
  | { type: 'ADD_CHAT_MESSAGE'; payload: ChatMessage }
  | { type: 'SET_CHAT_MESSAGES'; payload: ChatMessage[] }
  | { type: 'CLEAR_CHAT_MESSAGES' }
  | { type: 'SET_SELECTED_CHANNELS'; payload: string[] }
  | { type: 'TOGGLE_CHANNEL'; payload: string }
  | { type: 'CLEAR_SELECTED_CHANNELS' };

// Initial state
const initialState: AppState = {
  ui: {
    isMobileSidebarOpen: false,
    isLoading: false,
    currentView: 'chat',
  },
  error: {
    global: null,
    chat: null,
    channels: null,
  },
  chatMessages: [],
  selectedChannelIds: [],
};

// Reducer
function appStateReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    // UI Actions
    case 'SET_MOBILE_SIDEBAR':
      return {
        ...state,
        ui: { ...state.ui, isMobileSidebarOpen: action.payload },
      };

    case 'SET_LOADING':
      return {
        ...state,
        ui: { ...state.ui, isLoading: action.payload },
      };

    case 'SET_CURRENT_VIEW':
      return {
        ...state,
        ui: { ...state.ui, currentView: action.payload },
      };

    // Error Actions
    case 'SET_GLOBAL_ERROR':
      return {
        ...state,
        error: { ...state.error, global: action.payload },
      };

    case 'SET_CHAT_ERROR':
      return {
        ...state,
        error: { ...state.error, chat: action.payload },
      };

    case 'SET_CHANNELS_ERROR':
      return {
        ...state,
        error: { ...state.error, channels: action.payload },
      };

    case 'CLEAR_ALL_ERRORS':
      return {
        ...state,
        error: { global: null, chat: null, channels: null },
      };

    // Chat Actions
    case 'ADD_CHAT_MESSAGE':
      return {
        ...state,
        chatMessages: [...state.chatMessages, action.payload],
      };

    case 'SET_CHAT_MESSAGES':
      return {
        ...state,
        chatMessages: action.payload,
      };

    case 'CLEAR_CHAT_MESSAGES':
      return {
        ...state,
        chatMessages: [],
      };

    // Channel Actions
    case 'SET_SELECTED_CHANNELS':
      return {
        ...state,
        selectedChannelIds: action.payload,
      };

    case 'TOGGLE_CHANNEL':
      const channelId = action.payload;
      const isSelected = state.selectedChannelIds.includes(channelId);
      
      return {
        ...state,
        selectedChannelIds: isSelected
          ? state.selectedChannelIds.filter(id => id !== channelId)
          : [...state.selectedChannelIds, channelId],
      };

    case 'CLEAR_SELECTED_CHANNELS':
      return {
        ...state,
        selectedChannelIds: [],
      };

    default:
      return state;
  }
}

// Context
const AppStateContext = createContext<{
  state: AppState;
  dispatch: React.Dispatch<AppAction>;
} | null>(null);

// Provider component
interface AppStateProviderProps {
  children: ReactNode;
  initialState?: Partial<AppState>;
}

export function AppStateProvider({ children, initialState: customInitialState }: AppStateProviderProps) {
  const mergedInitialState = customInitialState 
    ? { ...initialState, ...customInitialState }
    : initialState;
    
  const [state, dispatch] = useReducer(appStateReducer, mergedInitialState);

  return (
    <AppStateContext.Provider value={{ state, dispatch }}>
      {children}
    </AppStateContext.Provider>
  );
}

// Hook to use the context
export function useAppState() {
  const context = useContext(AppStateContext);
  if (!context) {
    throw new Error('useAppState must be used within an AppStateProvider');
  }
  return context;
}

// Selector hooks for specific parts of state
export function useUIState() {
  const { state } = useAppState();
  return state.ui;
}

export function useErrorState() {
  const { state } = useAppState();
  return state.error;
}

export function useChatMessages() {
  const { state } = useAppState();
  return state.chatMessages;
}

export function useSelectedChannels() {
  const { state } = useAppState();
  return state.selectedChannelIds;
}
