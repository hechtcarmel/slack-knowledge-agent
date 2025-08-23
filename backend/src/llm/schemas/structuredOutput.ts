import { z } from 'zod';

/**
 * Schema for structured LLM output that includes the answer and relevant permalinks
 */
export const StructuredLLMOutputSchema = z.object({
  answer: z.string().describe('The comprehensive answer to the user query'),
  relevantPermalinks: z
    .array(
      z.object({
        url: z.string().url().describe('The permalink URL to the Slack message'),
        relevance: z
          .enum(['high', 'medium', 'low'])
          .describe('How relevant this message is to answering the query'),
        description: z
          .string()
          .optional()
          .describe('Brief description of why this message is relevant'),
      })
    )
    .max(3)
    .describe(
      'List of 0-3 most relevant message permalinks that directly support the answer. Only include high-value messages.'
    ),
  confidence: z
    .enum(['high', 'medium', 'low'])
    .optional()
    .describe('Confidence level in the answer'),
});

export type StructuredLLMOutput = z.infer<typeof StructuredLLMOutputSchema>;

export interface PermalinkWithContext {
  url: string;
  text: string;
  user: string;
  channel?: string;
  timestamp?: string;
}

/**
 * Parse intermediate steps to extract permalinks from tool calls
 */
export function extractPermalinksFromSteps(
  intermediateSteps: any[]
): string[] {
  const permalinks: string[] = [];
  const seenUrls = new Set<string>();

  if (!intermediateSteps || !Array.isArray(intermediateSteps)) {
    return permalinks;
  }

  for (const step of intermediateSteps) {
    // Check if step has tool output with messages
    if (step?.observation) {
      try {
        // Try to parse if it's a JSON string
        const parsed =
          typeof step.observation === 'string'
            ? JSON.parse(step.observation)
            : step.observation;

        // Extract permalinks from messages array in the new structure
        if (parsed?.messages && Array.isArray(parsed.messages)) {
          for (const msg of parsed.messages) {
            if (msg.permalink && !seenUrls.has(msg.permalink)) {
              permalinks.push(msg.permalink);
              seenUrls.add(msg.permalink);
            }
          }
        }

        // Also check for single message results
        if (parsed?.permalink && !seenUrls.has(parsed.permalink)) {
          permalinks.push(parsed.permalink);
          seenUrls.add(parsed.permalink);
        }
      } catch (e) {
        // Not JSON or parsing failed
        // Try to extract from plain text if it contains slack.com URLs
        if (typeof step.observation === 'string') {
          const urlMatches = step.observation.match(/https:\/\/[^\s]+slack\.com\/archives\/[^\s]+/g);
          if (urlMatches) {
            for (const url of urlMatches) {
              if (!seenUrls.has(url)) {
                permalinks.push(url);
                seenUrls.add(url);
              }
            }
          }
        }
      }
    }
  }

  return permalinks;
}

/**
 * Extract permalinks with context (message text, user, etc.)
 */
export function extractPermalinksWithContext(
  intermediateSteps: any[]
): PermalinkWithContext[] {
  const permalinks: PermalinkWithContext[] = [];
  const seenUrls = new Set<string>();

  if (!intermediateSteps || !Array.isArray(intermediateSteps)) {
    return permalinks;
  }

  for (const step of intermediateSteps) {
    if (step?.observation) {
      try {
        const parsed =
          typeof step.observation === 'string'
            ? JSON.parse(step.observation)
            : step.observation;

        if (parsed?.messages && Array.isArray(parsed.messages)) {
          for (const msg of parsed.messages) {
            if (msg.permalink && !seenUrls.has(msg.permalink)) {
              // Extract first 50 chars of message for context
              const textPreview = msg.text ? 
                msg.text.substring(0, 50) + (msg.text.length > 50 ? '...' : '') : 
                'Message';
              
              permalinks.push({
                url: msg.permalink,
                text: textPreview,
                user: msg.user || 'Unknown',
                channel: msg.channel,
                timestamp: msg.ts
              });
              seenUrls.add(msg.permalink);
            }
          }
        }
      } catch (e) {
        // Silent fail for non-JSON
      }
    }
  }

  return permalinks;
}

/**
 * Create permalink references with descriptions
 */
export function createPermalinkReferences(
  permalinksWithContext: PermalinkWithContext[]
): Array<{ url: string; description: string }> {
  return permalinksWithContext.slice(0, 3).map((p) => {
    // Create a concise description from the context
    const description = p.text.length > 30 
      ? `${p.user}: "${p.text.substring(0, 30)}..."`
      : `${p.user}: "${p.text}"`;
    
    return {
      url: p.url,
      description
    };
  });
}

/**
 * Filter and rank permalinks by relevance
 */
export function filterRelevantPermalinks(
  permalinks: string[],
  maxCount: number = 3
): string[] {
  // For now, just take the first N unique permalinks
  // In a more sophisticated implementation, we could rank by:
  // - Recency
  // - Mention frequency
  // - User authority
  // - Semantic similarity to query
  return permalinks.slice(0, maxCount);
}