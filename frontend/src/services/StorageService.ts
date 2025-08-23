/**
 * StorageService - Centralized localStorage management with error handling
 */

export class StorageService {
  private static instance: StorageService;

  static getInstance(): StorageService {
    if (!StorageService.instance) {
      StorageService.instance = new StorageService();
    }
    return StorageService.instance;
  }

  /**
   * Get item from localStorage with type safety and error handling
   */
  getItem<T>(key: string, defaultValue: T): T {
    try {
      const item = localStorage.getItem(key);
      if (item === null) return defaultValue;

      return JSON.parse(item) as T;
    } catch (error) {
      console.warn(`Failed to parse localStorage item "${key}":`, error);
      return defaultValue;
    }
  }

  /**
   * Set item in localStorage with error handling
   */
  setItem<T>(key: string, value: T): boolean {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (error) {
      console.error(`Failed to set localStorage item "${key}":`, error);
      return false;
    }
  }

  /**
   * Remove item from localStorage
   */
  removeItem(key: string): boolean {
    try {
      localStorage.removeItem(key);
      return true;
    } catch (error) {
      console.error(`Failed to remove localStorage item "${key}":`, error);
      return false;
    }
  }

  /**
   * Check if localStorage is available
   */
  isAvailable(): boolean {
    try {
      const testKey = '__localStorage_test__';
      localStorage.setItem(testKey, 'test');
      localStorage.removeItem(testKey);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Clear all localStorage data
   */
  clear(): boolean {
    try {
      localStorage.clear();
      return true;
    } catch (error) {
      console.error('Failed to clear localStorage:', error);
      return false;
    }
  }
}

export const storageService = StorageService.getInstance();
