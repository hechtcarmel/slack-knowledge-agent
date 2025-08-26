import { WebClient } from '@slack/web-api';
import dotenv from 'dotenv';

dotenv.config({ path: '.env' });

async function debugMissingChannel() {
  console.log('=== Debugging Missing Public Channel ===\n');
  
  const client = new WebClient(process.env.SLACK_BOT_TOKEN);
  
  try {
    // Test 1: Get ALL channels including archived
    console.log('1. ALL public channels (including archived):');
    const allPublicWithArchived = await client.conversations.list({
      types: 'public_channel',
      exclude_archived: false, // Include archived!
      limit: 1000,
    });
    
    if (allPublicWithArchived.ok && allPublicWithArchived.channels) {
      console.log('All public channels (including archived):');
      allPublicWithArchived.channels.forEach(ch => {
        console.log(`   - ${ch.name} (${ch.id}) ${ch.is_archived ? '[ARCHIVED]' : '[ACTIVE]'} ${ch.is_member ? '[MEMBER]' : '[NOT_MEMBER]'}`);
      });
      
      const blindspotFound = allPublicWithArchived.channels.find(ch => ch.name?.includes('blindspot'));
      if (blindspotFound) {
        console.log('\n✅ FOUND blindspot in all public channels:', {
          name: blindspotFound.name,
          id: blindspotFound.id,
          is_archived: blindspotFound.is_archived,
          is_member: blindspotFound.is_member,
          is_private: blindspotFound.is_private,
          is_channel: blindspotFound.is_channel,
          created: blindspotFound.created,
          creator: blindspotFound.creator
        });
      } else {
        console.log('\n❌ Still no blindspot found in ALL public channels');
      }
    }
    
    // Test 2: Try direct access with the specific ID
    console.log('\n2. Direct access test with known ID C098MR9GZU5:');
    try {
      const directAccess = await client.conversations.info({
        channel: 'C098MR9GZU5'
      });
      
      if (directAccess.ok && directAccess.channel) {
        console.log('✅ Direct access successful:', {
          name: directAccess.channel.name,
          id: directAccess.channel.id,
          is_private: directAccess.channel.is_private,
          is_archived: directAccess.channel.is_archived,
          is_member: directAccess.channel.is_member,
          is_channel: directAccess.channel.is_channel
        });
      }
    } catch (directError: any) {
      console.log('❌ Direct access failed:', directError.data?.error || directError.message);
    }
    
    // Test 3: Check bot membership specifically
    console.log('\n3. Bot membership check:');
    try {
      const userConversations = await client.users.conversations({
        types: 'public_channel,private_channel',
        exclude_archived: false,
        limit: 1000
      });
      
      if (userConversations.ok && userConversations.channels) {
        console.log('Bot is member of these channels:');
        userConversations.channels.forEach(ch => {
          console.log(`   - ${ch.name} (${ch.id}) ${ch.is_private ? '[PRIVATE]' : '[PUBLIC]'} ${ch.is_archived ? '[ARCHIVED]' : '[ACTIVE]'}`);
        });
        
        const blindspotInMember = userConversations.channels.find(ch => ch.id === 'C098MR9GZU5' || ch.name?.includes('blindspot'));
        if (blindspotInMember) {
          console.log('\n✅ Found blindspot in bot membership:', blindspotInMember);
        }
      }
    } catch (memberError: any) {
      console.log('❌ Membership check failed:', memberError.data?.error || memberError.message);
    }
    
    // Test 4: Alternative API approach - try searching
    console.log('\n4. Alternative approaches:');
    
    // Try with user token if available
    if (process.env.SLACK_USER_TOKEN) {
      console.log('   Testing with user token...');
      const userClient = new WebClient(process.env.SLACK_USER_TOKEN);
      
      try {
        const userChannels = await userClient.conversations.list({
          types: 'public_channel,private_channel',
          exclude_archived: false,
          limit: 1000
        });
        
        if (userChannels.ok && userChannels.channels) {
          const blindspotUser = userChannels.channels.find(ch => ch.name?.includes('blindspot'));
          if (blindspotUser) {
            console.log('   ✅ Found with user token:', blindspotUser);
          } else {
            console.log('   ❌ Not found with user token either');
          }
        }
      } catch (userError: any) {
        console.log('   ❌ User token failed:', userError.data?.error || userError.message);
      }
    } else {
      console.log('   No user token available to test');
    }
    
  } catch (error) {
    console.error('Error during debug:', error);
  }
}

debugMissingChannel();