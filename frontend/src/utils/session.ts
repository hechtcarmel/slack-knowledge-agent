/**
 * Simple session management utilities for chat sessions
 */

const SESSION_KEY = 'slack-agent-session-id';

export function getOrCreateSessionId(): string {
  const existing = localStorage.getItem(SESSION_KEY);
  if (existing) {
    return existing;
  }
  
  const newId = `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  localStorage.setItem(SESSION_KEY, newId);
  return newId;
}

export function clearSessionId(): string {
  localStorage.removeItem(SESSION_KEY);
  return getOrCreateSessionId();
}