import { Logger } from '@/utils/logger.js';
import { IInitializableService, IDisposableService } from '@/core/container/interfaces.js';
import { SlackConversationMemory } from '@/llm/memory/SlackMemory.js';

/**
 * Configuration for session management
 */
export interface SessionManagerConfig {
  sessionTTLMinutes: number;
  cleanupIntervalMinutes: number;
  maxSessions: number;
  maxSessionsPerUser: number;
  memoryMaxTokens: number;
  memoryMaxMessages: number;
}

/**
 * Conversation session with isolated memory
 */
export interface ConversationSession {
  sessionId: string;
  userId?: string;
  memory: SlackConversationMemory;
  createdAt: Date;
  lastAccessed: Date;
  metadata: {
    channels: string[];
    provider?: string;
    model?: string;
    messageCount: number;
  };
}

/**
 * Session Manager Service
 * 
 * Manages isolated conversation sessions with their own memory instances.
 * Handles automatic cleanup of expired sessions to prevent memory leaks.
 */
export class SessionManager implements IInitializableService, IDisposableService {
  private logger = Logger.create('SessionManager');
  private sessions = new Map<string, ConversationSession>();
  private cleanupInterval?: NodeJS.Timeout;
  private sessionTTL: number;

  constructor(private config: SessionManagerConfig) {
    this.sessionTTL = config.sessionTTLMinutes * 60 * 1000; // Convert to milliseconds
  }

  /**
   * Initialize the session manager
   */
  public async initialize(): Promise<void> {
    this.logger.info('Initializing SessionManager...', {
      sessionTTLMinutes: this.config.sessionTTLMinutes,
      cleanupIntervalMinutes: this.config.cleanupIntervalMinutes,
      maxSessions: this.config.maxSessions,
    });

    // Start cleanup interval
    this.cleanupInterval = setInterval(
      () => {
        this.cleanupExpiredSessions();
      },
      this.config.cleanupIntervalMinutes * 60 * 1000
    );

    this.logger.info('SessionManager initialized successfully');
  }

  /**
   * Get existing session or create new one
   */
  public getOrCreateSession(
    sessionId: string,
    userId?: string,
    channels: string[] = []
  ): ConversationSession {
    // Check if session exists and update last accessed
    const existingSession = this.sessions.get(sessionId);
    if (existingSession) {
      existingSession.lastAccessed = new Date();
      this.logger.debug('Retrieved existing session', {
        sessionId,
        messageCount: existingSession.metadata.messageCount,
      });
      return existingSession;
    }

    // Check session limits before creating new session
    this.enforceSessionLimits(userId);

    // Create new session with isolated memory
    const session: ConversationSession = {
      sessionId,
      userId,
      memory: new SlackConversationMemory({
        maxTokens: this.config.memoryMaxTokens,
        maxMessages: this.config.memoryMaxMessages,
        sessionId,
      }),
      createdAt: new Date(),
      lastAccessed: new Date(),
      metadata: {
        channels,
        messageCount: 0,
      },
    };

    this.sessions.set(sessionId, session);

    this.logger.info('Created new session', {
      sessionId,
      userId,
      channels,
      totalSessions: this.sessions.size,
    });

    return session;
  }

  /**
   * Clear specific session
   */
  public async clearSession(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (session) {
      await session.memory.clear();
      this.sessions.delete(sessionId);
      
      this.logger.info('Session cleared', {
        sessionId,
        remainingSessions: this.sessions.size,
      });
    }
  }

  /**
   * Update session metadata
   */
  public updateSessionMetadata(
    sessionId: string, 
    updates: Partial<ConversationSession['metadata']>
  ): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.metadata = { ...session.metadata, ...updates };
      session.lastAccessed = new Date();
    }
  }

  /**
   * Get session statistics
   */
  public getStats(): {
    totalSessions: number;
    averageSessionAge: number;
    averageMessageCount: number;
    oldestSessionAge: number;
    memoryUsageEstimateMB: number;
  } {
    if (this.sessions.size === 0) {
      return {
        totalSessions: 0,
        averageSessionAge: 0,
        averageMessageCount: 0,
        oldestSessionAge: 0,
        memoryUsageEstimateMB: 0,
      };
    }

    const now = Date.now();
    let totalAge = 0;
    let totalMessages = 0;
    let oldestAge = 0;

    for (const session of this.sessions.values()) {
      const sessionAge = now - session.createdAt.getTime();
      totalAge += sessionAge;
      totalMessages += session.metadata.messageCount;
      oldestAge = Math.max(oldestAge, sessionAge);
    }

    // Estimate memory usage: ~30KB per session average
    const memoryUsageEstimateMB = (this.sessions.size * 30) / 1024;

    return {
      totalSessions: this.sessions.size,
      averageSessionAge: totalAge / this.sessions.size,
      averageMessageCount: totalMessages / this.sessions.size,
      oldestSessionAge: oldestAge,
      memoryUsageEstimateMB,
    };
  }

  /**
   * Dispose of the session manager
   */
  public async dispose(): Promise<void> {
    this.logger.info('Disposing SessionManager...');

    // Clear cleanup interval
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }

    // Clear all sessions
    const clearPromises: Promise<void>[] = [];
    for (const session of this.sessions.values()) {
      clearPromises.push(session.memory.clear());
    }

    await Promise.all(clearPromises);
    this.sessions.clear();

    this.logger.info('SessionManager disposed successfully');
  }

  /**
   * Cleanup expired sessions
   */
  private cleanupExpiredSessions(): void {
    const now = Date.now();
    const expiredSessionIds: string[] = [];

    for (const [sessionId, session] of this.sessions.entries()) {
      const sessionAge = now - session.lastAccessed.getTime();
      if (sessionAge > this.sessionTTL) {
        expiredSessionIds.push(sessionId);
      }
    }

    if (expiredSessionIds.length > 0) {
      // Clear expired sessions
      for (const sessionId of expiredSessionIds) {
        const session = this.sessions.get(sessionId);
        if (session) {
          session.memory.clear().catch(error => {
            this.logger.warn('Error clearing session memory', {
              sessionId,
              error: (error as Error).message,
            });
          });
          this.sessions.delete(sessionId);
        }
      }

      this.logger.info('Cleaned up expired sessions', {
        expiredCount: expiredSessionIds.length,
        remainingCount: this.sessions.size,
        sessionTTLMinutes: this.config.sessionTTLMinutes,
      });
    }
  }

  /**
   * Enforce session limits to prevent memory issues
   */
  private enforceSessionLimits(userId?: string): void {
    // Check global session limit
    if (this.sessions.size >= this.config.maxSessions) {
      this.evictLRUSessions(Math.floor(this.config.maxSessions * 0.1)); // Remove 10%
    }

    // Check per-user session limit
    if (userId && this.config.maxSessionsPerUser > 0) {
      const userSessions = Array.from(this.sessions.values()).filter(
        s => s.userId === userId
      );

      if (userSessions.length >= this.config.maxSessionsPerUser) {
        // Remove oldest session for this user
        const oldestSession = userSessions.reduce((oldest, current) =>
          current.lastAccessed < oldest.lastAccessed ? current : oldest
        );

        this.clearSession(oldestSession.sessionId).catch(error => {
          this.logger.warn('Error clearing user session', {
            userId,
            sessionId: oldestSession.sessionId,
            error: (error as Error).message,
          });
        });
      }
    }
  }

  /**
   * Remove least recently used sessions
   */
  private evictLRUSessions(count: number): void {
    const sessionsArray = Array.from(this.sessions.entries());
    
    // Sort by lastAccessed (oldest first)
    sessionsArray.sort(([, a], [, b]) => 
      a.lastAccessed.getTime() - b.lastAccessed.getTime()
    );

    const toEvict = sessionsArray.slice(0, count);
    
    for (const [sessionId, session] of toEvict) {
      session.memory.clear().catch(error => {
        this.logger.warn('Error clearing evicted session memory', {
          sessionId,
          error: (error as Error).message,
        });
      });
      this.sessions.delete(sessionId);
    }

    if (toEvict.length > 0) {
      this.logger.info('Evicted LRU sessions', {
        evictedCount: toEvict.length,
        remainingCount: this.sessions.size,
        reason: 'session_limit_exceeded',
      });
    }
  }
}