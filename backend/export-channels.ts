import { WebClient } from '@slack/web-api';
import { writeFileSync } from 'fs';
import dotenv from 'dotenv';

dotenv.config();

async function exportChannels() {
  console.log('=== Exporting All Channels ===\n');

  const client = new WebClient(process.env.SLACK_BOT_TOKEN);

  try {
    let output = `Slack Channels Export - ${new Date().toISOString()}\n`;
    output += `=========================================\n\n`;

    // Test 1: Public channels (exclude archived)
    console.log('Fetching public channels (active)...');
    try {
      const publicActive = await client.conversations.list({
        types: 'public_channel',
        exclude_archived: true,
        limit: 1000,
      });

      if (publicActive.ok && publicActive.channels) {
        output += `PUBLIC CHANNELS (ACTIVE) - Count: ${publicActive.channels.length}\n`;
        output += `------------------------------------------------------------\n`;
        publicActive.channels.forEach((ch, index) => {
          output += `${index + 1}. ${ch.name} (${ch.id})\n`;
          output += `   - Member: ${ch.is_member ? 'Yes' : 'No'}\n`;
          output += `   - Created: ${ch.created ? new Date(ch.created * 1000).toISOString() : 'Unknown'}\n`;
          output += `   - Purpose: ${ch.purpose?.value || 'None'}\n`;
          output += `   - Topic: ${ch.topic?.value || 'None'}\n\n`;
        });
      } else {
        output += `PUBLIC CHANNELS (ACTIVE) - ERROR: ${publicActive.error}\n\n`;
      }
    } catch (error: any) {
      output += `PUBLIC CHANNELS (ACTIVE) - EXCEPTION: ${error.message}\n\n`;
    }

    // Test 2: Public channels (include archived)
    console.log('Fetching public channels (including archived)...');
    try {
      const publicAll = await client.conversations.list({
        types: 'public_channel',
        exclude_archived: false,
        limit: 1000,
      });

      if (publicAll.ok && publicAll.channels) {
        output += `PUBLIC CHANNELS (INCLUDING ARCHIVED) - Count: ${publicAll.channels.length}\n`;
        output += `--------------------------------------------------------------------\n`;
        publicAll.channels.forEach((ch, index) => {
          output += `${index + 1}. ${ch.name} (${ch.id}) ${ch.is_archived ? '[ARCHIVED]' : '[ACTIVE]'}\n`;
          output += `   - Member: ${ch.is_member ? 'Yes' : 'No'}\n`;
          output += `   - Created: ${ch.created ? new Date(ch.created * 1000).toISOString() : 'Unknown'}\n`;
          output += `   - Purpose: ${ch.purpose?.value || 'None'}\n`;
          output += `   - Topic: ${ch.topic?.value || 'None'}\n\n`;
        });
      } else {
        output += `PUBLIC CHANNELS (INCLUDING ARCHIVED) - ERROR: ${publicAll.error}\n\n`;
      }
    } catch (error: any) {
      output += `PUBLIC CHANNELS (INCLUDING ARCHIVED) - EXCEPTION: ${error.message}\n\n`;
    }

    // Test 3: Bot membership with pagination
    console.log('Fetching bot membership with pagination...');
    try {
      let allMemberChannels: any[] = [];
      let cursor: string | undefined;
      let pageCount = 0;

      do {
        pageCount++;
        const memberChannels = await client.users.conversations({
          types: 'public_channel,private_channel',
          exclude_archived: false,
          limit: 200,
          cursor,
        });

        if (memberChannels.ok && memberChannels.channels) {
          allMemberChannels.push(...memberChannels.channels);
          cursor = memberChannels.response_metadata?.next_cursor;
          output += `BOT MEMBERSHIP PAGE ${pageCount} - Count: ${memberChannels.channels.length}\n`;
        } else {
          output += `BOT MEMBERSHIP PAGE ${pageCount} - ERROR: ${memberChannels.error}\n`;
          break;
        }
      } while (cursor);

      if (allMemberChannels.length > 0) {
        output += `\nBOT MEMBERSHIP TOTAL - Count: ${allMemberChannels.length} (${pageCount} pages)\n`;
        output += `----------------------------------------------------------------\n`;
        allMemberChannels.forEach((ch, index) => {
          output += `${index + 1}. ${ch.name} (${ch.id}) ${ch.is_private ? '[PRIVATE]' : '[PUBLIC]'} ${ch.is_archived ? '[ARCHIVED]' : '[ACTIVE]'}\n`;
          output += `   - Created: ${ch.created ? new Date(ch.created * 1000).toISOString() : 'Unknown'}\n`;
          output += `   - Purpose: ${ch.purpose?.value || 'None'}\n`;
          output += `   - Topic: ${ch.topic?.value || 'None'}\n\n`;
        });
      } else {
        output += `BOT MEMBERSHIP - NO CHANNELS FOUND\n\n`;
      }
    } catch (error: any) {
      output += `BOT MEMBERSHIP - EXCEPTION: ${error.message}\n\n`;
    }

    // Test 4: Direct access to specific channel
    console.log('Testing direct access to C098MR9GZU5...');
    try {
      const directAccess = await client.conversations.info({
        channel: 'C098MR9GZU5',
      });

      if (directAccess.ok && directAccess.channel) {
        const ch = directAccess.channel;
        output += `DIRECT ACCESS TO C098MR9GZU5 - SUCCESS\n`;
        output += `------------------------------------\n`;
        output += `Name: ${ch.name}\n`;
        output += `ID: ${ch.id}\n`;
        output += `Private: ${ch.is_private ? 'Yes' : 'No'}\n`;
        output += `Archived: ${ch.is_archived ? 'Yes' : 'No'}\n`;
        output += `Member: ${ch.is_member ? 'Yes' : 'No'}\n`;
        output += `Channel: ${ch.is_channel ? 'Yes' : 'No'}\n`;
        output += `Created: ${ch.created ? new Date(ch.created * 1000).toISOString() : 'Unknown'}\n`;
        output += `Purpose: ${ch.purpose?.value || 'None'}\n`;
        output += `Topic: ${ch.topic?.value || 'None'}\n\n`;
      } else {
        output += `DIRECT ACCESS TO C098MR9GZU5 - ERROR: ${directAccess.error}\n\n`;
      }
    } catch (error: any) {
      output += `DIRECT ACCESS TO C098MR9GZU5 - EXCEPTION: ${error.message}\n\n`;
    }

    // Write to channels.txt
    writeFileSync('channels.txt', output);

    console.log(`✅ Channels exported to: channels.txt`);
  } catch (error) {
    console.error('Error during export:', error);
  }
}

exportChannels();
