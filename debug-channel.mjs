import { WebClient } from '@slack/web-api';
import dotenv from 'dotenv';

dotenv.config({ path: '.env' });

const client = new WebClient(process.env.SLACK_BOT_TOKEN);

async function debugPublicChannel() {
  console.log('=== Debugging Public Channel Access ===\n');
  
  try {
    // Test 1: Check if it's really public and get all details
    console.log('1. All public channels (including archived):');
    const allPublic = await client.conversations.list({
      types: 'public_channel',
      exclude_archived: false,
      limit: 1000
    });
    
    console.log('All public channels:', allPublic.channels?.map(ch => ({
      name: ch.name,
      id: ch.id,
      is_archived: ch.is_archived,
      is_member: ch.is_member
    })));
    
    // Test 2: Check bot's membership across all channel types
    console.log('\n2. Bot membership (all types):');
    const memberChannels = await client.users.conversations({
      types: 'public_channel,private_channel',
      exclude_archived: false,
      limit: 1000
    });
    
    console.log('Bot is member of:', memberChannels.channels?.map(ch => ({
      name: ch.name,
      id: ch.id,
      is_private: ch.is_private,
      is_archived: ch.is_archived
    })));
    
    // Test 3: Search for the specific ID in all results
    const targetId = 'C098MR9GZU5';
    const foundInPublic = allPublic.channels?.find(ch => ch.id === targetId);
    const foundInMember = memberChannels.channels?.find(ch => ch.id === targetId);
    
    if (foundInPublic) {
      console.log('\n✅ Found in public channels:', foundInPublic);
    }
    if (foundInMember) {
      console.log('\n✅ Found in member channels:', foundInMember);
    }
    if (!foundInPublic && !foundInMember) {
      console.log('\n❌ Channel not found in either list');
    }
    
    // Test 4: Try different approaches to access
    console.log('\n3. Alternative access methods:');
    
    // Try with # prefix
    try {
      const withHash = await client.conversations.info({ channel: '#blindspot-slack-test' });
      console.log('✅ Found with # prefix:', withHash.channel?.name);
    } catch (e) {
      console.log('❌ Not found with # prefix:', e.data?.error);
    }
    
    // Try with name only
    try {
      const withName = await client.conversations.info({ channel: 'blindspot-slack-test' });
      console.log('✅ Found with name only:', withName.channel?.name);
    } catch (e) {
      console.log('❌ Not found with name only:', e.data?.error);
    }
    
  } catch (error) {
    console.error('Error during debug:', error.data || error.message);
  }
}

await debugPublicChannel();