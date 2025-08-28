import { Logger } from '@/utils/logger.js';
import { LLMError } from '@/utils/errors.js';
import {
  IInitializableService,
  IDisposableService,
} from '@/core/container/interfaces.js';
import { LLMProviderManager } from './LLMProviderManager.js';
import { SlackKnowledgeAgent } from '@/llm/agents/SlackKnowledgeAgent.js';
import { SlackConversationMemory } from '@/llm/memory/SlackMemory.js';
import { createSlackTools } from '@/llm/tools/index.js';
import { ISlackService } from '@/interfaces/services/ISlackService.js';
import { LLMProvider } from '@/interfaces/services/ILLMService.js';

/**
 * Agent configuration
 */
export interface AgentConfig {
  maxIterations: number;
  verbose: boolean;
  returnIntermediateSteps: boolean;
  handleParsingErrors: boolean;
  memoryEnabled: boolean;
  memoryMaxTokens: number;
  memoryMaxMessages: number;
}

/**
 * Agent cache entry
 */
interface AgentCacheEntry {
  agent: SlackKnowledgeAgent;
  lastUsed: number;
  provider: LLMProvider;
  model: string;
}

/**
 * Agent Manager Service
 *
 * Manages the lifecycle and caching of LangChain agents.
 * Creates and configures agents for different providers and models.
 */
export class AgentManager implements IInitializableService, IDisposableService {
  private logger = Logger.create('AgentManager');
  private agentCache = new Map<string, AgentCacheEntry>();
  private tools: any[] = [];
  private memory?: SlackConversationMemory;
  private cacheCleanupInterval?: NodeJS.Timeout;

  constructor(
    private providerManager: LLMProviderManager,
    private slackService: ISlackService,
    private config: AgentConfig
  ) {}

  /**
   * Initialize the agent manager
   */
  public async initialize(): Promise<void> {
    this.logger.info('Initializing AgentManager...');

    try {
      // Create Slack tools
      this.tools = createSlackTools(this.slackService);

      // Initialize memory if enabled
      if (this.config.memoryEnabled) {
        this.memory = new SlackConversationMemory({
          maxTokens: this.config.memoryMaxTokens,
          maxMessages: this.config.memoryMaxMessages,
          sessionId: 'slack-knowledge-session',
        });
      }

      // Start cache cleanup interval (cleanup every 5 minutes)
      this.cacheCleanupInterval = setInterval(
        () => {
          this.cleanupExpiredAgents();
        },
        5 * 60 * 1000
      );

      this.logger.info('AgentManager initialized successfully', {
        toolsCount: this.tools.length,
        memoryEnabled: this.config.memoryEnabled,
        maxIterations: this.config.maxIterations,
      });
    } catch (error) {
      this.logger.error('Failed to initialize AgentManager', error as Error);
      throw error;
    }
  }

  /**
   * Get an agent for the specified provider and model
   * If sessionMemory is provided, creates a new agent with that memory instead of using cache
   */
  public async getAgent(
    provider?: LLMProvider,
    model?: string,
    sessionMemory?: SlackConversationMemory
  ): Promise<SlackKnowledgeAgent> {
    const currentProvider = this.providerManager.getCurrentProvider();
    if (!currentProvider && !provider) {
      throw new LLMError(
        'No LLM providers available - check API keys configuration',
        'NO_PROVIDERS_AVAILABLE'
      );
    }
    const targetProvider = provider || currentProvider!;
    const targetModel =
      model || this.providerManager.getDefaultModelForProvider(targetProvider);

    // If session memory is provided, create a new agent with that memory
    if (sessionMemory) {
      this.logger.debug('Creating agent with session memory', {
        provider: targetProvider,
        model: targetModel,
        sessionId: sessionMemory.sessionId,
      });

      return await this.createAgent(targetProvider, targetModel, sessionMemory);
    }

    // Otherwise, use cached agents as before
    const cacheKey = `${targetProvider}:${targetModel}`;

    // Check if we have a cached agent
    const cachedEntry = this.agentCache.get(cacheKey);
    if (cachedEntry) {
      cachedEntry.lastUsed = Date.now();
      this.logger.debug('Using cached agent', {
        provider: targetProvider,
        model: targetModel,
      });
      return cachedEntry.agent;
    }

    // Create new agent
    this.logger.info('Creating new agent', {
      provider: targetProvider,
      model: targetModel,
    });

    const agent = await this.createAgent(targetProvider, targetModel);

    // Cache the agent
    this.agentCache.set(cacheKey, {
      agent,
      lastUsed: Date.now(),
      provider: targetProvider,
      model: targetModel,
    });

    this.logger.debug('Agent created and cached', {
      provider: targetProvider,
      model: targetModel,
      cacheSize: this.agentCache.size,
    });

    return agent;
  }

  /**
   * Clear conversation memory for all agents
   */
  public async clearMemory(): Promise<void> {
    if (this.memory) {
      await this.memory.clear();
      this.logger.info('Memory cleared for all agents');
    }

    // Clear memory for all cached agents
    for (const entry of this.agentCache.values()) {
      try {
        await entry.agent.clearMemory();
      } catch (error) {
        this.logger.warn('Failed to clear memory for cached agent', {
          error: (error as Error).message,
        });
      }
    }
  }

  /**
   * Get agent manager statistics
   */
  public getStats(): {
    cachedAgents: number;
    toolsCount: number;
    memoryEnabled: boolean;
    memoryMessageCount: number;
  } {
    return {
      cachedAgents: this.agentCache.size,
      toolsCount: this.tools.length,
      memoryEnabled: this.config.memoryEnabled,
      memoryMessageCount: 0, // Would need to be async to get actual count
    };
  }

  /**
   * Force refresh an agent (removes from cache)
   */
  public refreshAgent(provider?: LLMProvider, model?: string): void {
    const currentProvider = this.providerManager.getCurrentProvider();
    if (!currentProvider && !provider) {
      throw new LLMError(
        'No LLM providers available - check API keys configuration',
        'NO_PROVIDERS_AVAILABLE'
      );
    }
    const targetProvider = provider || currentProvider!;
    const targetModel =
      model || this.providerManager.getDefaultModelForProvider(targetProvider);
    const cacheKey = `${targetProvider}:${targetModel}`;

    if (this.agentCache.has(cacheKey)) {
      this.agentCache.delete(cacheKey);
      this.logger.info('Agent removed from cache', {
        provider: targetProvider,
        model: targetModel,
      });
    }
  }

  /**
   * Dispose of all agents and cleanup
   */
  public async dispose(): Promise<void> {
    this.logger.info('Disposing AgentManager...');

    // Clear cleanup interval
    if (this.cacheCleanupInterval) {
      clearInterval(this.cacheCleanupInterval);
    }

    // Clear memory
    if (this.memory) {
      await this.memory.clear();
    }

    // Dispose of all cached agents
    const disposePromises: Promise<void>[] = [];
    for (const entry of this.agentCache.values()) {
      disposePromises.push(
        entry.agent.clearMemory().catch(error => {
          this.logger.warn('Error disposing agent', {
            error: (error as Error).message,
          });
        })
      );
    }

    await Promise.all(disposePromises);

    // Clear cache
    this.agentCache.clear();

    this.logger.info('AgentManager disposed successfully');
  }

  /**
   * Create a new agent instance
   */
  private async createAgent(
    provider: LLMProvider,
    model: string,
    sessionMemory?: SlackConversationMemory
  ): Promise<SlackKnowledgeAgent> {
    try {
      // Get the LLM provider instance
      const llmProvider = this.providerManager.getProvider(provider);

      // Use session memory if provided, otherwise use global memory
      const memoryToUse = sessionMemory || this.memory;

      // Create agent with configuration
      const agent = new SlackKnowledgeAgent(llmProvider as any, this.tools, {
        maxIterations: this.config.maxIterations,
        verbose: this.config.verbose,
        returnIntermediateSteps: this.config.returnIntermediateSteps,
        handleParsingErrors: this.config.handleParsingErrors,
        memory: memoryToUse,
      });

      // Initialize the agent
      await agent.initialize();

      this.logger.info('Agent created successfully', {
        provider,
        model,
        maxIterations: this.config.maxIterations,
        hasMemory: !!memoryToUse,
        isSessionMemory: !!sessionMemory,
      });

      return agent;
    } catch (error) {
      this.logger.error('Failed to create agent', error as Error, {
        provider,
        model,
      });
      throw new LLMError(
        `Failed to create agent for ${provider}:${model}`,
        'AGENT_CREATION_FAILED',
        error
      );
    }
  }

  /**
   * Cleanup expired agents from cache
   */
  private cleanupExpiredAgents(): void {
    const now = Date.now();
    const maxAge = 30 * 60 * 1000; // 30 minutes
    const expiredKeys: string[] = [];

    for (const [key, entry] of this.agentCache.entries()) {
      if (now - entry.lastUsed > maxAge) {
        expiredKeys.push(key);
      }
    }

    if (expiredKeys.length > 0) {
      for (const key of expiredKeys) {
        this.agentCache.delete(key);
      }

      this.logger.info('Cleaned up expired agents from cache', {
        expiredCount: expiredKeys.length,
        remainingCount: this.agentCache.size,
      });
    }
  }
}
