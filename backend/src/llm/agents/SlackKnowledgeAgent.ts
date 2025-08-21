import { createReactAgent } from 'langchain/agents';
import { AgentExecutor } from 'langchain/agents';

import { ChatPromptTemplate } from '@langchain/core/prompts';

import { BaseLanguageModel } from '@langchain/core/language_models/base';
import { Logger } from '@/utils/logger.js';
import { SlackConversationMemory } from '../memory/SlackMemory.js';
import { REACT_PROMPT_TEMPLATE } from '../prompts/systemPrompts.js';

export interface AgentConfig {
  maxIterations?: number;
  verbose?: boolean;
  returnIntermediateSteps?: boolean;
  handleParsingErrors?: boolean;
  memory?: SlackConversationMemory;
}

export interface QueryResult {
  output: string;
  intermediateSteps?: any[];
  usage?: any;
}

export class SlackKnowledgeAgent {
  private logger = Logger.create('SlackKnowledgeAgent');
  private agent?: AgentExecutor;
  private memory?: SlackConversationMemory;

  constructor(
    private model: BaseLanguageModel,
    private tools: any[],
    private config: AgentConfig = {}
  ) {
    this.memory = config.memory;
  }

  async initialize(): Promise<void> {
    try {
      this.logger.info('Initializing SlackKnowledgeAgent...', {
        modelName: this.model.constructor.name,
        toolCount: this.tools.length,
        hasMemory: !!this.memory,
      });

      // Create the ReAct prompt template
      const prompt = ChatPromptTemplate.fromTemplate(REACT_PROMPT_TEMPLATE);

      // Create ReAct agent
      const agent = await createReactAgent({
        llm: this.model,
        tools: this.tools,
        prompt,
      });

      // Create agent executor with configuration
      this.agent = new AgentExecutor({
        agent,
        tools: this.tools,
        verbose: this.config.verbose ?? process.env.NODE_ENV === 'development',
        maxIterations: this.config.maxIterations ?? 10,
        returnIntermediateSteps: this.config.returnIntermediateSteps ?? true,
        handleParsingErrors: this.config.handleParsingErrors ?? true,
        memory: this.memory,
      });

      this.logger.info('SlackKnowledgeAgent initialized successfully', {
        toolCount: this.tools.length,
        maxIterations: this.config.maxIterations ?? 10,
        hasMemory: !!this.memory,
      });
    } catch (error) {
      this.logger.error(
        'Failed to initialize SlackKnowledgeAgent',
        error as Error
      );
      throw error;
    }
  }

  async query(
    input: string,
    context: Record<string, any> = {}
  ): Promise<QueryResult> {
    if (!this.agent) {
      throw new Error('Agent not initialized. Call initialize() first.');
    }

    try {
      this.logger.info('Processing query with ReAct agent', {
        query: input.substring(0, 100) + (input.length > 100 ? '...' : ''),
        context: Object.keys(context),
        hasMemory: !!this.memory,
      });

      const startTime = Date.now();

      // Execute the agent with input and context
      const result = await this.agent.invoke({
        input,
        ...context,
      });

      const executionTime = Date.now() - startTime;

      this.logger.info('Query processed successfully', {
        outputLength: result.output?.length || 0,
        intermediateStepsCount: result.intermediateSteps?.length || 0,
        executionTime,
        hasMemory: !!this.memory,
      });

      return {
        output: result.output || '',
        intermediateSteps: result.intermediateSteps,
        usage: result.usage, // May be undefined
      };
    } catch (error) {
      this.logger.error('Agent query failed', error as Error, {
        input: input.substring(0, 100) + '...',
      });
      throw error;
    }
  }

  async *streamQuery(
    input: string,
    context: Record<string, any> = {}
  ): AsyncIterable<any> {
    if (!this.agent) {
      throw new Error('Agent not initialized. Call initialize() first.');
    }

    try {
      this.logger.info('Starting streaming query with ReAct agent', {
        query: input.substring(0, 100) + (input.length > 100 ? '...' : ''),
        context: Object.keys(context),
      });

      const stream = await this.agent.streamEvents(
        {
          input,
          ...context,
        },
        { version: 'v1' }
      );

      for await (const chunk of stream) {
        yield chunk;
      }
    } catch (error) {
      this.logger.error('Agent stream query failed', error as Error, {
        input: input.substring(0, 100) + '...',
      });
      throw error;
    }
  }

  /**
   * Clear the agent's memory if it exists
   */
  async clearMemory(): Promise<void> {
    if (this.memory) {
      await this.memory.clear();
      this.logger.info('Agent memory cleared');
    }
  }

  /**
   * Get the current memory message count
   */
  async getMemoryMessageCount(): Promise<number> {
    if (this.memory) {
      return await this.memory.getMessageCount();
    }
    return 0;
  }

  /**
   * Get agent statistics
   */
  getStats(): {
    toolCount: number;
    maxIterations: number;
    hasMemory: boolean;
    isInitialized: boolean;
  } {
    return {
      toolCount: this.tools.length,
      maxIterations: this.config.maxIterations ?? 10,
      hasMemory: !!this.memory,
      isInitialized: !!this.agent,
    };
  }

  /**
   * Update agent configuration
   */
  updateConfig(newConfig: Partial<AgentConfig>): void {
    this.config = { ...this.config, ...newConfig };

    if (newConfig.memory !== undefined) {
      this.memory = newConfig.memory;
    }

    this.logger.info('Agent configuration updated', {
      newConfig: Object.keys(newConfig),
      hasMemory: !!this.memory,
    });
  }
}
