import { ChatOpenAI } from '@langchain/openai';
import { Logger } from '@/utils/logger.js';

export class SlackOpenAILLM extends ChatOpenAI {
  private logger = Logger.create('OpenAILLM');

  constructor(
    apiKey: string,
    options: {
      model?: string;
      temperature?: number;
      maxTokens?: number;
    } = {}
  ) {
    super({
      apiKey,
      model: options.model || 'gpt-4o-mini',
      temperature: options.temperature || 0.1,
      maxTokens: options.maxTokens || 1000,
      streaming: true, // Enable streaming by default
    });

    this.logger = this.logger.child({
      provider: 'openai',
      model: options.model || 'gpt-4o-mini',
    });
  }

  // Add custom cost calculation
  calculateCost(
    usage: { promptTokens: number; completionTokens: number },
    model: string
  ): number {
    const pricing: Record<string, { input: number; output: number }> = {
      'gpt-4o': { input: 5.0, output: 15.0 },
      'gpt-4o-mini': { input: 0.15, output: 0.6 },
      'gpt-4-turbo': { input: 10.0, output: 30.0 },
      'gpt-4': { input: 30.0, output: 60.0 },
      'gpt-3.5-turbo': { input: 0.5, output: 1.5 },
    };

    const modelPricing = pricing[model] || pricing['gpt-4o-mini'];
    const inputCost = (usage.promptTokens / 1_000_000) * modelPricing.input;
    const outputCost =
      (usage.completionTokens / 1_000_000) * modelPricing.output;

    this.logger.debug('Cost calculated', {
      model,
      promptTokens: usage.promptTokens,
      completionTokens: usage.completionTokens,
      inputCost,
      outputCost,
      totalCost: inputCost + outputCost,
    });

    return inputCost + outputCost;
  }

  async validateConfig(): Promise<boolean> {
    try {
      // Test with a minimal request
      await this.invoke('test');
      this.logger.info('OpenAI configuration validated successfully');
      return true;
    } catch (error) {
      this.logger.error(
        'OpenAI configuration validation failed',
        error as Error
      );
      return false;
    }
  }

  getAvailableModels(): string[] {
    return ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-4', 'gpt-3.5-turbo'];
  }
}
