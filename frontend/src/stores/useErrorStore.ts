import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

export interface ErrorState {
  errors: {
    global: string | null;
    chat: string | null;
    channels: string | null;
    api: string | null;
  };
  
  // Actions
  setError: (type: keyof ErrorState['errors'], error: string | null) => void;
  clearError: (type: keyof ErrorState['errors']) => void;
  clearAllErrors: () => void;
}

export const useErrorStore = create<ErrorState>()(
  devtools(
    (set) => ({
      errors: {
        global: null,
        chat: null,
        channels: null,
        api: null,
      },
      
      setError: (type, error) =>
        set((state) => ({
          errors: { ...state.errors, [type]: error },
        })),
      
      clearError: (type) =>
        set((state) => ({
          errors: { ...state.errors, [type]: null },
        })),
      
      clearAllErrors: () =>
        set({
          errors: {
            global: null,
            chat: null,
            channels: null,
            api: null,
          },
        }),
    }),
    { name: 'Error Store' }
  )
);

// Selector hooks for convenient access
export const useGlobalError = () => useErrorStore((state) => state.errors.global);
export const useChatError = () => useErrorStore((state) => state.errors.chat);
export const useChannelsError = () => useErrorStore((state) => state.errors.channels);
export const useApiError = () => useErrorStore((state) => state.errors.api);

// Computed selectors
export const useHasErrors = () => useErrorStore((state) => 
  Object.values(state.errors).some((error) => error !== null)
);

export const useErrorCount = () => useErrorStore((state) => 
  Object.values(state.errors).filter((error) => error !== null).length
);