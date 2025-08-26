/**
 * Session utilities for conversation management
 */

/**
 * Generate a unique session ID
 */
export function generateSessionId(): string {
  // Generate a UUID-like string
  return 'session_' + Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 9);
}

/**
 * Get or create session ID from localStorage
 * Returns existing session or creates new one
 */
export function getOrCreateSessionId(): string {
  const STORAGE_KEY = 'slack-knowledge-agent-session-id';
  
  try {
    const existingSessionId = localStorage.getItem(STORAGE_KEY);
    if (existingSessionId) {
      return existingSessionId;
    }
  } catch (error) {
    console.warn('Failed to read session ID from localStorage:', error);
  }
  
  // Generate new session ID
  const newSessionId = generateSessionId();
  
  try {
    localStorage.setItem(STORAGE_KEY, newSessionId);
  } catch (error) {
    console.warn('Failed to save session ID to localStorage:', error);
  }
  
  return newSessionId;
}

/**
 * Clear session ID and start fresh
 */
export function clearSessionId(): string {
  const STORAGE_KEY = 'slack-knowledge-agent-session-id';
  
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    console.warn('Failed to clear session ID from localStorage:', error);
  }
  
  // Generate and store new session ID
  return getOrCreateSessionId();
}

/**
 * Check if session ID exists
 */
export function hasSessionId(): boolean {
  const STORAGE_KEY = 'slack-knowledge-agent-session-id';
  
  try {
    return localStorage.getItem(STORAGE_KEY) !== null;
  } catch (error) {
    return false;
  }
}