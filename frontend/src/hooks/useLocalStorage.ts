import { useState, useEffect, useCallback } from 'react';
import { storageService } from '@/services/StorageService';

/**
 * Custom hook for managing localStorage with React state synchronization
 * Provides type safety, error handling, and automatic state updates
 */
export function useLocalStorage<T>(
  key: string,
  defaultValue: T,
  options: {
    serialize?: (value: T) => string;
    deserialize?: (value: string) => T;
    onError?: (error: Error) => void;
  } = {}
): [T, (value: T | ((prev: T) => T)) => void, () => void] {
  // Initialize state with value from localStorage or default
  const [storedValue, setStoredValue] = useState<T>(() => {
    try {
      return storageService.getItem(key, defaultValue);
    } catch (error) {
      options.onError?.(error as Error);
      return defaultValue;
    }
  });

  // Update localStorage when state changes
  const setValue = useCallback(
    (value: T | ((prev: T) => T)) => {
      try {
        // Allow functional updates like regular useState
        const valueToStore =
          value instanceof Function ? value(storedValue) : value;

        // Update state
        setStoredValue(valueToStore);

        // Update localStorage
        const success = storageService.setItem(key, valueToStore);
        if (!success) {
          options.onError?.(new Error(`Failed to save ${key} to localStorage`));
        }
      } catch (error) {
        options.onError?.(error as Error);
      }
    },
    [key, storedValue, options]
  );

  // Remove item from localStorage and reset to default
  const removeValue = useCallback(() => {
    try {
      storageService.removeItem(key);
      setStoredValue(defaultValue);
    } catch (error) {
      options.onError?.(error as Error);
    }
  }, [key, defaultValue, options]);

  // Listen for localStorage changes in other tabs/windows
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === key && e.newValue !== null) {
        try {
          const newValue = JSON.parse(e.newValue);
          setStoredValue(newValue);
        } catch (error) {
          options.onError?.(error as Error);
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [key, options]);

  return [storedValue, setValue, removeValue];
}
