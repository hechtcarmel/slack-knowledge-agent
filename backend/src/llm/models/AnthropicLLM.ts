import { ChatAnthropic } from '@langchain/anthropic';
import { Logger } from '@/utils/logger.js';

export class SlackAnthropicLLM extends ChatAnthropic {
  private logger = Logger.create('AnthropicLLM');

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
      model: options.model || 'claude-3-5-haiku-20241022',
      temperature: options.temperature || 0.1,
      maxTokens: options.maxTokens || 1000,
      streaming: true,
    });

    this.logger = this.logger.child({
      provider: 'anthropic',
      model: options.model || 'claude-3-5-haiku-20241022',
    });
  }

  calculateCost(
    usage: { promptTokens: number; completionTokens: number },
    model: string
  ): number {
    // Anthropic pricing (per 1M tokens) as of 2024
    const pricing: Record<string, { input: number; output: number }> = {
      'claude-3-5-sonnet-20241022': { input: 3.0, output: 15.0 },
      'claude-3-5-haiku-20241022': { input: 1.0, output: 5.0 },
      'claude-3-opus-20240229': { input: 15.0, output: 75.0 },
      'claude-3-sonnet-20240229': { input: 3.0, output: 15.0 },
      'claude-3-haiku-20240307': { input: 0.25, output: 1.25 },
    };

    const modelPricing = pricing[model] || pricing['claude-3-5-haiku-20241022'];
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
      this.logger.info('Anthropic configuration validated successfully');
      return true;
    } catch (error: any) {
      // If it's an auth error, config is invalid
      if (error.status === 401) {
        this.logger.error(
          'Anthropic configuration validation failed - invalid API key',
          error
        );
        return false;
      }

      // Other errors might be fine (rate limits, etc.)
      this.logger.info('Anthropic configuration appears valid');
      return true;
    }
  }

  getAvailableModels(): string[] {
    return [
      'claude-3-5-sonnet-20241022',
      'claude-3-5-haiku-20241022',
      'claude-3-opus-20240229',
      'claude-3-sonnet-20240229',
      'claude-3-haiku-20240307',
    ];
  }
}
