import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

const EnvSchema = z.object({
  // Server
  NODE_ENV: z
    .enum(['development', 'production', 'test'])
    .default('development'),
  PORT: z.string().transform(Number).default('3000'),

  // Slack
  SLACK_BOT_TOKEN: z.string().startsWith('xoxb-'),
  SLACK_SIGNING_SECRET: z.string().min(1),
  SLACK_APP_TOKEN: z.string().startsWith('xapp-').optional(),

  // LLM
  OPENAI_API_KEY: z.string().startsWith('sk-'),
  ANTHROPIC_API_KEY: z.string().startsWith('sk-ant-').optional(),
  DEFAULT_LLM_PROVIDER: z.enum(['openai', 'anthropic']).default('openai'),
  LLM_MODEL: z.string().default('gpt-5'),
  MAX_CONTEXT_TOKENS: z.string().transform(Number).default('8000'),

  // Query limits
  MAX_HISTORY_DAYS: z.string().transform(Number).default('90'),
  DEFAULT_QUERY_LIMIT: z.string().transform(Number).default('50'),
  MAX_QUERY_LIMIT: z.string().transform(Number).default('200'),
});

export type Config = z.infer<typeof EnvSchema>;

let cachedConfig: Config | null = null;

export function getConfig(): Config {
  if (!cachedConfig) {
    try {
      cachedConfig = EnvSchema.parse(process.env);
      // Log token info for debugging (masked)
      const token = cachedConfig.SLACK_BOT_TOKEN;
      const maskedToken = token ? `${token.substring(0, 10)}...${token.substring(token.length - 4)}` : 'NO_TOKEN';
      console.log('Config loaded - Slack token:', maskedToken, 'Length:', token?.length);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const missingVars = error.errors.map(
          e => `${e.path.join('.')}: ${e.message}`
        );
        throw new Error(
          `Environment validation failed:\n${missingVars.join('\n')}`
        );
      }
      throw error;
    }
  }
  return cachedConfig;
}

export function validateConfig(): void {
  getConfig();
}

// Validate on import
validateConfig();
