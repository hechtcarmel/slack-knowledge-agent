import { createToolCallingAgent } from 'langchain/agents';
import { AgentExecutor } from 'langchain/agents';

import {
  ChatPromptTemplate,
  MessagesPlaceholder,
} from '@langchain/core/prompts';

import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { Logger } from '@/utils/logger.js';
import { SlackConversationMemory } from '../memory/SlackMemory.js';

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
    private model: BaseChatModel,
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

      // Create Tool Calling prompt template - channel info will be formatted dynamically
      const systemMessage = `You are a Slack Knowledge Agent that helps users find information from their Slack workspace.

Available channels to search:
{channels}

You have access to the following tools. The tool schemas will be automatically provided - use the exact parameter names and formats they specify:

- get_channel_info: Get information about a Slack channel (requires: channel_id)
- get_channel_history: Get recent messages from a specific Slack channel (requires: channel_id)  
- search_messages: Search for messages across Slack channels (requires: query, channels array)
- get_thread: Get all messages in a specific thread (requires: channel_id, thread_ts)
- list_files: List files shared in Slack channels (requires: channels array)
- get_file_content: Get the content of a text file from Slack (requires: file_id)

IMPORTANT: 
- Always use the exact parameter names and formats specified in the tool schemas
- For channel parameters: use channel IDs (not channel names)
- For search_messages: pass channels as an array, e.g., ["C09B8CNEQNR"] 
- For single channel tools: use channel_id as a string

Always use tools to gather information before responding. If you find relevant information, quote it with context (user and timestamp).`;

      const messagesList: any[] = [['system', systemMessage]];

      // Only add chat_history placeholder if memory is enabled
      if (this.memory) {
        messagesList.push(new MessagesPlaceholder('chat_history'));
      }

      messagesList.push(['human', '{input}']);
      messagesList.push(new MessagesPlaceholder('agent_scratchpad'));

      const prompt = ChatPromptTemplate.fromMessages(messagesList);

      // Create Tool Calling agent (newer and more compatible)
      const agent = await createToolCallingAgent({
        llm: this.model,
        tools: this.tools,
        prompt,
      });

      // Create agent executor with configuration
      this.agent = new AgentExecutor({
        agent,
        tools: this.tools,
        verbose: this.config.verbose ?? process.env.NODE_ENV === 'development',
        maxIterations: this.config.maxIterations ?? 15,
        returnIntermediateSteps: this.config.returnIntermediateSteps ?? true,
        handleParsingErrors: this.config.handleParsingErrors ?? true,
        memory: this.memory,
      });

      this.logger.info(
        'SlackKnowledgeAgent (Tool Calling) initialized successfully',
        {
          toolCount: this.tools.length,
          maxIterations: this.config.maxIterations ?? 15,
          hasMemory: !!this.memory,
          agentType: 'tool-calling',
        }
      );
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
      this.logger.info('Processing query with Tool Calling agent', {
        query: input.substring(0, 100) + (input.length > 100 ? '...' : ''),
        context: Object.keys(context),
        hasMemory: !!this.memory,
        agentType: 'tool-calling',
      });

      const startTime = Date.now();

      // Format structured context for the agent
      const formattedContext = this.formatContext(context);

      // Execute the agent with input and formatted context
      const result = await this.agent.invoke({
        input,
        ...formattedContext,
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

  /**
   * Format structured context data for prompt templates
   */
  private formatContext(context: Record<string, any>): Record<string, any> {
    const formatted = { ...context };

    // Format channels array into readable string
    if (context.channels && Array.isArray(context.channels)) {
      formatted.channels = context.channels
        .map((ch: any) => {
          let channelInfo = `- ${ch.name} (${ch.id})`;
          if (ch.purpose) {
            channelInfo += ` - Purpose: ${ch.purpose}`;
          }
          if (ch.topic) {
            channelInfo += ` - Topic: ${ch.topic}`;
          }
          return channelInfo;
        })
        .join('\n');
    }

    return formatted;
  }

  async *streamQuery(
    input: string,
    context: Record<string, any> = {}
  ): AsyncIterable<any> {
    if (!this.agent) {
      throw new Error('Agent not initialized. Call initialize() first.');
    }

    try {
      this.logger.info('Starting streaming query with Tool Calling agent', {
        query: input.substring(0, 100) + (input.length > 100 ? '...' : ''),
        context: Object.keys(context),
      });

      // Format structured context for the agent
      const formattedContext = this.formatContext(context);

      const stream = await this.agent.streamEvents(
        {
          input,
          ...formattedContext,
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
      maxIterations: this.config.maxIterations ?? 15,
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
