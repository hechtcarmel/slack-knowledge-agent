import { extractPermalinksFromSteps, filterRelevantPermalinks } from './src/llm/schemas/structuredOutput.js';

// Test data simulating intermediate steps from agent execution
const testIntermediateSteps = [
  {
    action: {
      tool: 'search_messages',
      toolInput: { query: 'deployment process' },
    },
    observation: JSON.stringify({
      messages: [
        {
          user: 'john.doe',
          text: 'The deployment process is documented here',
          ts: '1234567890.123456',
          channel: 'C12345678',
          permalink: 'https://myworkspace.slack.com/archives/C12345678/p1234567890123456'
        },
        {
          user: 'jane.smith',
          text: 'We updated the deployment yesterday',
          ts: '1234567891.123456',
          channel: 'C12345678',
          permalink: 'https://myworkspace.slack.com/archives/C12345678/p1234567891123456'
        }
      ]
    })
  },
  {
    action: {
      tool: 'get_thread',
      toolInput: { channel: 'C12345678', thread_ts: '1234567890.123456' },
    },
    observation: JSON.stringify({
      messages: [
        {
          user: 'john.doe',
          text: 'Here are the detailed steps',
          ts: '1234567890.123457',
          channel: 'C12345678',
          thread_ts: '1234567890.123456',
          permalink: 'https://myworkspace.slack.com/archives/C12345678/p1234567890123457?thread_ts=1234567890.123456&cid=C12345678'
        }
      ]
    })
  }
];

console.log('Testing permalink extraction from intermediate steps...\n');

// Test extraction
const extractedPermalinks = extractPermalinksFromSteps(testIntermediateSteps);
console.log('Extracted permalinks:');
extractedPermalinks.forEach((permalink, index) => {
  console.log(`  ${index + 1}. ${permalink}`);
});

// Test filtering (should limit to 3 most relevant)
const filteredPermalinks = filterRelevantPermalinks(extractedPermalinks, 2);
console.log('\nFiltered permalinks (max 2):');
filteredPermalinks.forEach((permalink, index) => {
  console.log(`  ${index + 1}. ${permalink}`);
});

console.log('\n✅ Permalink extraction test completed successfully!');