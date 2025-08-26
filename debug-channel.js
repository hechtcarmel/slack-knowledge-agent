import { WebClient } from '@slack/web-api';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const client = new WebClient(process.env.SLACK_BOT_TOKEN);

async function debugChannelAccess() {
  console.log('=== Channel Access Debug ===\n');
  
  try {
    // Test 1: List all public channels
    console.log('1. Listing all public channels:');
    const publicChannels = await client.conversations.list({
      types: 'public_channel',
      exclude_archived: true,
      limit: 1000
    });
    
    const channelNames = publicChannels.channels?.map(ch => ch.name) || [];
    console.log(`Found ${channelNames.length} public channels:`, channelNames);
    
    const targetChannel = publicChannels.channels?.find(ch => ch.name === 'blindspot-slack-test');
    if (targetChannel) {
      console.log('\n✅ Found blindspot-slack-test in public channels:', targetChannel);
    } else {
      console.log('\n❌ blindspot-slack-test NOT found in public channels');
    }
    
    // Test 2: List all channel types (including private)
    console.log('\n2. Listing all channels (including private):');
    const allChannels = await client.conversations.list({
      types: 'public_channel,private_channel',
      exclude_archived: false,
      limit: 1000
    });
    
    const allChannelNames = allChannels.channels?.map(ch => `${ch.name} (${ch.is_private ? 'private' : 'public'}${ch.is_archived ? ', archived' : ''})`) || [];
    console.log(`Found ${allChannelNames.length} total channels:`, allChannelNames);
    
    const targetChannelAll = allChannels.channels?.find(ch => ch.name === 'blindspot-slack-test');
    if (targetChannelAll) {
      console.log('\n✅ Found blindspot-slack-test in all channels:', {
        name: targetChannelAll.name,
        id: targetChannelAll.id,
        is_private: targetChannelAll.is_private,
        is_archived: targetChannelAll.is_archived,
        is_member: targetChannelAll.is_member
      });
    } else {
      console.log('\n❌ blindspot-slack-test NOT found in any channels');
    }
    
    // Test 3: Try to access the channel directly by name
    console.log('\n3. Trying to access channel directly:');
    try {
      const channelInfo = await client.conversations.info({
        channel: '#blindspot-slack-test'
      });
      console.log('✅ Direct access successful:', channelInfo.channel);
    } catch (directError) {
      console.log('❌ Direct access failed:', directError.data?.error || directError.message);
    }
    
    // Test 4: Search for channels with similar names
    console.log('\n4. Searching for channels containing "blindspot":');
    const blindspotChannels = allChannels.channels?.filter(ch => 
      ch.name?.toLowerCase().includes('blindspot')
    ) || [];
    
    if (blindspotChannels.length > 0) {
      console.log('Found channels with "blindspot":', blindspotChannels.map(ch => ({
        name: ch.name,
        is_private: ch.is_private,
        is_archived: ch.is_archived,
        is_member: ch.is_member
      })));
    } else {
      console.log('No channels found containing "blindspot"');
    }
    
    // Test 5: Check bot's own membership
    console.log('\n5. Bot membership info:');
    const authTest = await client.auth.test();
    console.log('Bot info:', {
      user_id: authTest.user_id,
      team: authTest.team,
      user: authTest.user
    });
    
  } catch (error) {
    console.error('Error during debug:', error.data || error.message);
  }
}

debugChannelAccess();