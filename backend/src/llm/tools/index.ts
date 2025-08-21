import { SlackService } from '@/services/SlackService.js';

import { createSearchMessagesTool } from './slack/SearchMessages.js';
import { createGetThreadTool } from './slack/GetThread.js';
import { createGetChannelHistoryTool } from './slack/GetChannelHistory.js';
import { createGetChannelInfoTool } from './slack/GetChannelInfo.js';
import { createListFilesTool } from './slack/ListFiles.js';
import { createGetFileContentTool } from './slack/GetFileContent.js';
import { createSearchMoreMessagesTool } from './slack/SearchMoreMessages.js';
import { createAnalyzeSearchCompletenessTool } from './slack/AnalyzeSearchCompleteness.js';

/**
 * Creates all Slack-related tools for LangChain agents
 * @param slackService The SlackService instance to use for API calls
 * @returns Array of LangChain Tool instances
 */
export function createSlackTools(slackService: SlackService): any[] {
  return [
    createSearchMessagesTool(slackService),
    createGetThreadTool(slackService),
    createGetChannelHistoryTool(slackService),
    createGetChannelInfoTool(slackService),
    createListFilesTool(slackService),
    createGetFileContentTool(slackService),
    createSearchMoreMessagesTool(slackService),
    createAnalyzeSearchCompletenessTool(), // This tool doesn't need slackService
  ];
}

/**
 * Get tool names for agent prompt template
 */
export function getSlackToolNames(): string[] {
  return [
    'search_messages',
    'get_thread',
    'get_channel_history',
    'get_channel_info',
    'list_files',
    'get_file_content',
    'search_more_messages',
    'analyze_search_completeness',
  ];
}

// Export individual tool factory functions
export {
  createSearchMessagesTool,
  createGetThreadTool,
  createGetChannelHistoryTool,
  createGetChannelInfoTool,
  createListFilesTool,
  createGetFileContentTool,
  createSearchMoreMessagesTool,
  createAnalyzeSearchCompletenessTool,
};
