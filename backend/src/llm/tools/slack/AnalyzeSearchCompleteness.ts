import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { Logger } from '@/utils/logger.js';

const analyzeSearchCompletenessSchema = z.object({
  original_query: z
    .string()
    .min(1)
    .describe('The original user query that was being answered'),
  current_results_summary: z
    .string()
    .min(20)
    .describe('Brief summary of what was found in current search results'),
  result_count: z
    .number()
    .int()
    .min(0)
    .describe('Number of messages found in current search'),
  search_method_used: z
    .string()
    .describe(
      'What search approach was used (e.g., "broad keyword search", "channel-specific search")'
    ),
  gaps_identified: z
    .string()
    .optional()
    .describe(
      'What information seems missing or incomplete based on the query'
    ),
});

export function createAnalyzeSearchCompletenessTool(): DynamicStructuredTool {
  const logger = Logger.create('AnalyzeSearchCompletenessTool');

  return new DynamicStructuredTool({
    name: 'analyze_search_completeness',
    description:
      "Analyze whether search results fully address the user's query or if additional searches should be performed. Use this to systematically evaluate search coverage before responding to the user.",
    schema: analyzeSearchCompletenessSchema,
    func: async (args: any) => {
      try {
        logger.info('Analyzing search completeness', {
          query: args.original_query.substring(0, 50) + '...',
          resultCount: args.result_count,
          method: args.search_method_used,
        });

        // Analyze completeness based on multiple factors
        const analysis = analyzeSearchResults({
          query: args.original_query,
          summary: args.current_results_summary,
          count: args.result_count,
          method: args.search_method_used,
          gaps: args.gaps_identified,
        });

        logger.info('Search completeness analysis completed', {
          isComplete: analysis.is_complete,
          shouldPaginate: analysis.should_paginate,
          confidence: analysis.confidence_score,
        });

        // Return structured analysis
        return `Search Completeness Analysis:

Query: "${args.original_query}"
Results Found: ${args.result_count} messages
Search Method: ${args.search_method_used}

ANALYSIS:
- Completeness: ${analysis.is_complete ? 'COMPLETE' : 'INCOMPLETE'}
- Confidence: ${analysis.confidence_score}/10
- Should Continue Searching: ${analysis.should_paginate ? 'YES' : 'NO'}

REASONING:
${analysis.detailed_reasoning}

RECOMMENDATION:
${analysis.recommended_action}

${
  analysis.should_paginate
    ? `
SUGGESTED NEXT STEPS:
${analysis.suggested_next_steps}
`
    : ''
}`;
      } catch (error) {
        const errorMessage = `Error analyzing search completeness: ${(error as Error).message}`;
        logger.error('Search completeness analysis failed', error as Error, {
          query: args.original_query,
        });

        return errorMessage;
      }
    },
  });
}

interface SearchAnalysisInput {
  query: string;
  summary: string;
  count: number;
  method: string;
  gaps?: string;
}

interface SearchAnalysisResult {
  is_complete: boolean;
  should_paginate: boolean;
  confidence_score: number;
  detailed_reasoning: string;
  recommended_action: string;
  suggested_next_steps?: string;
}

function analyzeSearchResults(
  input: SearchAnalysisInput
): SearchAnalysisResult {
  let score = 5; // Start with neutral score
  const reasons: string[] = [];
  let shouldPaginate = false;

  // Analyze query complexity
  const queryWords = input.query.toLowerCase().split(/\s+/);
  const isComplexQuery =
    queryWords.length > 5 ||
    queryWords.some(word =>
      [
        'process',
        'policy',
        'procedure',
        'history',
        'all',
        'comprehensive',
      ].includes(word)
    );

  if (isComplexQuery) {
    reasons.push(
      'Query appears complex and may require comprehensive coverage'
    );
    score -= 1;
  }

  // Analyze result count
  if (input.count === 0) {
    score = 3;
    reasons.push(
      'No results found - may need broader search terms or different channels'
    );
  } else if (input.count < 5 && isComplexQuery) {
    score -= 2;
    reasons.push(
      'Low result count for complex query suggests incomplete coverage'
    );
    shouldPaginate = true;
  } else if (input.count >= 20 && input.method.includes('broad')) {
    score += 1;
    reasons.push(
      'Good result count from broad search indicates comprehensive coverage'
    );
  }

  // Analyze for specific completeness indicators
  const summary = input.summary.toLowerCase();

  // Check for temporal completeness
  if (
    summary.includes('recent') ||
    summary.includes('last month') ||
    summary.includes('latest')
  ) {
    if (
      queryWords.some(word =>
        ['history', 'evolution', 'change', 'over time'].includes(word)
      )
    ) {
      score -= 2;
      reasons.push(
        'Results appear temporally limited but query suggests need for historical context'
      );
      shouldPaginate = true;
    }
  }

  // Check for participant completeness
  if (summary.includes('from') && summary.includes('user')) {
    const participantCount = (summary.match(/from \w+/g) || []).length;
    if (participantCount < 3 && isComplexQuery) {
      score -= 1;
      reasons.push(
        'Limited participant diversity in results for complex topic'
      );
    }
  }

  // Check for gaps
  if (input.gaps) {
    score -= 2;
    reasons.push(`Identified gaps: ${input.gaps}`);
    shouldPaginate = true;
  }

  // Analyze search method effectiveness
  if (input.method.includes('single') || input.method.includes('first page')) {
    if (input.count >= 15) {
      score -= 1;
      reasons.push(
        'Many results found on first page suggests more content available'
      );
      shouldPaginate = true;
    }
  }

  // Final scoring
  score = Math.max(1, Math.min(10, score));
  const isComplete = score >= 7 && !shouldPaginate;

  let recommendedAction: string;
  let suggestedNextSteps: string | undefined;

  if (isComplete) {
    recommendedAction =
      "Search appears comprehensive. Proceed with answering the user's query based on current results.";
  } else if (shouldPaginate) {
    recommendedAction =
      'Additional search recommended to ensure comprehensive coverage.';
    suggestedNextSteps = generateNextSteps(input, reasons);
  } else {
    recommendedAction =
      'Consider alternative search approaches or acknowledge limitations in response.';
  }

  return {
    is_complete: isComplete,
    should_paginate: shouldPaginate,
    confidence_score: score,
    detailed_reasoning: reasons.join('; '),
    recommended_action: recommendedAction,
    suggested_next_steps: suggestedNextSteps,
  };
}

function generateNextSteps(
  input: SearchAnalysisInput,
  reasons: string[]
): string {
  const steps: string[] = [];

  if (input.count < 10) {
    steps.push('• Try broader search terms or synonyms');
    steps.push('• Search in additional relevant channels');
  }

  if (reasons.some(r => r.includes('temporal'))) {
    steps.push('• Extend time range for historical context');
    steps.push('• Search for policy/process documentation');
  }

  if (reasons.some(r => r.includes('participant'))) {
    steps.push('• Look for discussions involving key stakeholders');
    steps.push('• Check related channels for cross-team discussions');
  }

  if (input.method.includes('single')) {
    steps.push('• Use auto_paginate=true for comprehensive search');
    steps.push('• Continue with search_more_messages tool');
  }

  return steps.join('\n');
}
