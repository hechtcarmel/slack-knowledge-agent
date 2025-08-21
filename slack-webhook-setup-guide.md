# Slack Webhook Setup Guide

This comprehensive guide walks you through setting up a Slack app with webhooks to enable real-time responses from the Slack Knowledge Agent when mentioned in channels.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Creating a Slack App](#creating-a-slack-app)
3. [Configuring OAuth Scopes](#configuring-oauth-scopes)
4. [Setting Up Event Subscriptions](#setting-up-event-subscriptions)
5. [Installing the App in Your Workspace](#installing-the-app-in-your-workspace)
6. [Deployment Options](#deployment-options)
7. [Environment Configuration](#environment-configuration)
8. [Testing the Setup](#testing-the-setup)
9. [Troubleshooting](#troubleshooting)

## Prerequisites

Before you begin, ensure you have:

- [ ] A Slack workspace where you have admin permissions
- [ ] OpenAI or Anthropic API key for the LLM functionality
- [ ] Basic understanding of environment variables and deployment

## Creating a Slack App

### Step 1: Create a New Slack App

1. Go to [api.slack.com/apps](https://api.slack.com/apps)
2. Click **"Create New App"**
3. Select **"From scratch"**
4. Fill in the app details:
   - **App Name**: `Slack Knowledge Agent` (or your preferred name)
   - **Development Slack Workspace**: Select your target workspace
5. Click **"Create App"**

### Step 2: Basic Information Setup

After creating the app, you'll be taken to the app dashboard. Note down the following information (you'll need it later):

- **App ID**: Found in the "Basic Information" section
- **Signing Secret**: Found in "App Credentials" section (click "Show")
- **Verification Token**: Found in "App Credentials" section

⚠️ **Security Note**: Never share these credentials publicly or commit them to version control.

## Configuring OAuth Scopes

### Step 3: Bot Token Scopes

1. In your app dashboard, navigate to **"OAuth & Permissions"** in the left sidebar
2. Scroll down to **"Scopes"** section
3. Under **"Bot Token Scopes"**, click **"Add an OAuth Scope"**
4. Add the following required scopes:

#### Required Bot Scopes:
```
app_mentions:read     - Receive app mention events
channels:read         - View basic channel information  
chat:write           - Send messages as the bot
groups:read          - View basic private channel information
im:history           - View message history in direct messages
im:read              - View basic direct message information
im:write             - Start direct messages with users
users:read           - View people in the workspace
files:read           - View files shared in channels
```

#### Additional Recommended Scopes:
```
channels:history     - View messages in public channels (if needed)
groups:history       - View messages in private channels (if invited)
mpim:history         - View messages in group direct messages
reactions:read       - View emoji reactions (for enhanced context)
```

### Step 4: User Token Scopes (Optional but Recommended)

For enhanced search functionality, add user token scopes:

1. Under **"User Token Scopes"**, add:
```
search:read          - Search messages, files, and channels
```

⚠️ **Note**: User token scopes require the user to authorize the app personally and provide more powerful search capabilities.

## Setting Up Event Subscriptions

### Step 5: Enable Events

1. In your app dashboard, navigate to **"Event Subscriptions"**
2. Toggle **"Enable Events"** to **ON**
3. In **"Request URL"**, you'll need to enter your webhook endpoint URL:
   ```
   https://your-domain.com/slack/events
   ```
   
   ⚠️ **Important**: You must deploy your application first and get a public URL before you can complete this step. See the [Deployment Options](#deployment-options) section below.

4. Slack will verify your endpoint by sending a challenge. Your app must be running and properly configured to respond.

### Step 6: Subscribe to Bot Events

Under **"Subscribe to bot events"**, add the following events:

#### Required Events:
```
app_mention          - When someone mentions your bot (@botname)
```

#### Optional Events (for enhanced functionality):
```
message.im           - Direct messages to the bot
message.channels     - Messages in channels (if you want to monitor all messages)
message.groups       - Messages in private channels
```

⚠️ **Privacy Note**: Only subscribe to `message.channels` and `message.groups` if your use case requires monitoring all messages. This provides broad access to workspace conversations.

### Step 7: Subscribe to Events (User Token)

If you configured user token scopes, you can also subscribe to user events for enhanced functionality.

## Installing the App in Your Workspace

### Step 8: Install the App

1. Navigate to **"OAuth & Permissions"**
2. Click **"Install to Workspace"**
3. Review the permissions and click **"Allow"**
4. You'll receive:
   - **Bot User OAuth Token**: Starts with `xoxb-`
   - **User OAuth Token**: Starts with `xoxp-` (if configured)

⚠️ **Security**: Store these tokens securely as environment variables. Never expose them in your code.

### Step 9: Invite Bot to Channels

After installation:

1. Go to any channel where you want the bot to respond
2. Type: `/invite @your-bot-name`
3. The bot must be in a channel to respond to mentions there

## Deployment Options

Your Slack Knowledge Agent can be deployed on several free platforms. Here are the best options:

### Option 1: Railway (Recommended)

**Pros**: Easy setup, PostgreSQL support, great for Node.js apps
**Free Tier**: $5/month credit (enough for small usage)

#### Setup Steps:
1. Create account at [railway.app](https://railway.app)
2. Connect your GitHub repository
3. Railway will auto-detect it's a Node.js app
4. Set environment variables in Railway dashboard
5. Deploy automatically on git push

#### Railway Configuration:
```bash
# Add to railway.app environment variables
NODE_ENV=production
PORT=3000
SLACK_BOT_TOKEN=xoxb-your-token
SLACK_USER_TOKEN=xoxp-your-token  
SLACK_SIGNING_SECRET=your-signing-secret
OPENAI_API_KEY=sk-your-openai-key
DEFAULT_LLM_PROVIDER=openai
LLM_MODEL=gpt-4o-mini
```

### Option 2: Render

**Pros**: True free tier, easy deployment, automatic HTTPS
**Free Tier**: 750 hours/month (enough for continuous running)

#### Setup Steps:
1. Create account at [render.com](https://render.com)
2. Create new "Web Service"
3. Connect GitHub repository
4. Configure build and start commands:
   - **Build Command**: `pnpm install && pnpm run build`
   - **Start Command**: `pnpm start`
5. Add environment variables
6. Deploy

#### Render Limitations:
- Free tier spins down after 15 minutes of inactivity
- 30-second cold start delay
- 750 hours/month limit

### Option 3: Vercel (With Serverless Functions)

**Pros**: Excellent free tier, fast global CDN, automatic scaling
**Considerations**: Requires restructuring for serverless architecture

#### Setup Steps:
1. Install Vercel CLI: `npm i -g vercel`
2. Run `vercel` in your project directory
3. Configure `vercel.json` for API routes
4. Deploy with `vercel --prod`

#### Vercel Configuration:
Create `vercel.json`:
```json
{
  "version": 2,
  "builds": [
    {
      "src": "backend/src/server_new.ts",
      "use": "@vercel/node"
    }
  ],
  "routes": [
    {
      "src": "/(.*)",
      "dest": "backend/src/server_new.ts"
    }
  ],
  "env": {
    "NODE_ENV": "production"
  }
}
```

### Option 4: Heroku

**Pros**: Established platform, good documentation
**Cons**: No longer offers free tier (minimum $5/month)

#### Setup Steps:
1. Create Heroku account
2. Install Heroku CLI
3. Create app: `heroku create your-app-name`
4. Set config vars: `heroku config:set SLACK_BOT_TOKEN=xoxb-...`
5. Deploy: `git push heroku main`

### Recommended Choice

For beginners: **Render** (true free tier, simple setup)
For production: **Railway** (better performance, database support)
For enterprise: **Heroku** or **AWS/GCP** (more control, paid)

## Environment Configuration

### Step 10: Configure Environment Variables

Based on your deployment platform, set these environment variables:

#### Required Variables:
```env
# Server Configuration
NODE_ENV=production
PORT=3000

# Slack Configuration (from your app dashboard)
SLACK_BOT_TOKEN=xoxb-your-bot-token-here
SLACK_USER_TOKEN=xoxp-your-user-token-here
SLACK_SIGNING_SECRET=your-signing-secret-from-app-dashboard

# LLM Configuration (choose one provider)
OPENAI_API_KEY=sk-your-openai-api-key
# OR
ANTHROPIC_API_KEY=sk-ant-your-anthropic-api-key

# LLM Settings
DEFAULT_LLM_PROVIDER=openai
LLM_MODEL=gpt-4o-mini
MAX_CONTEXT_TOKENS=8000

# Webhook Configuration (new)
WEBHOOK_ENABLE_SIGNATURE_VALIDATION=true
WEBHOOK_DUPLICATE_EVENT_TTL_MS=300000
WEBHOOK_PROCESSING_TIMEOUT_MS=25000
WEBHOOK_ENABLE_THREADING=true
WEBHOOK_ENABLE_DMS=true
WEBHOOK_MAX_RESPONSE_LENGTH=4000

# Query Configuration
MAX_HISTORY_DAYS=90
DEFAULT_QUERY_LIMIT=50
MAX_QUERY_LIMIT=200

# Security (for production)
ENABLE_RATE_LIMIT=true
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
```

#### Optional Variables:
```env
# CORS Configuration (if using custom frontend domain)
CORS_ORIGINS=https://your-frontend-domain.com

# Logging Configuration
LOG_LEVEL=info

# App Token (for Socket Mode - alternative to webhooks)
SLACK_APP_TOKEN=xapp-your-app-token
```

### Step 11: Update Slack Event Subscription URL

After deploying your app:

1. Get your deployment URL (e.g., `https://your-app.railway.app`)
2. Go back to your Slack app dashboard
3. Navigate to **"Event Subscriptions"**
4. Update **"Request URL"** to: `https://your-app.railway.app/slack/events`
5. Click **"Save Changes"**

Slack will verify the endpoint by sending a test event. Your app must be running and respond correctly.

## Testing the Setup

### Step 12: Test the Integration

#### Basic Connectivity Test:
1. Visit your app's health endpoint: `https://your-app.railway.app/api/health`
2. Should return a healthy status with Slack and LLM connections

#### Webhook Test:
1. Go to a channel where your bot is invited
2. Type: `@your-bot-name What is this channel about?`
3. The bot should respond within a few seconds in the same thread

#### Expected Behavior:
- Bot responds to mentions with AI-generated answers
- Responses appear in the same thread as the mention
- Bot uses channel history and context to provide relevant answers
- Web interface continues to work normally

### Step 13: Verify Logs

Check your deployment platform's logs to ensure:
- Webhook events are being received
- No authentication errors
- LLM requests are successful
- Responses are posted back to Slack

## Troubleshooting

### Common Issues and Solutions

#### 1. "Challenge verification failed"
**Problem**: Slack can't verify your webhook endpoint
**Solutions**:
- Ensure your app is deployed and accessible
- Check that `/slack/events` endpoint exists
- Verify environment variables are set correctly
- Check application logs for startup errors

#### 2. "Bot doesn't respond to mentions"
**Problem**: No response when mentioning the bot
**Solutions**:
- Verify bot is invited to the channel (`/invite @botname`)
- Check webhook endpoint is receiving events (check logs)
- Ensure `SLACK_SIGNING_SECRET` is correct
- Verify LLM API key is valid and has quota

#### 3. "Authentication failed" errors
**Problem**: Slack API authentication issues
**Solutions**:
- Verify `SLACK_BOT_TOKEN` starts with `xoxb-`
- Ensure bot is installed in the workspace
- Check token hasn't been regenerated in Slack dashboard
- Verify required OAuth scopes are granted

#### 4. "Rate limit exceeded"
**Problem**: Too many requests to Slack or LLM APIs
**Solutions**:
- Enable rate limiting in app configuration
- Implement exponential backoff (already built-in)
- Consider upgrading API plans if usage is legitimate

#### 5. "Webhook timeout" errors
**Problem**: Processing takes too long, Slack times out
**Solutions**:
- Check LLM response times (should be <25 seconds)
- Verify database/memory performance
- Enable webhook processing timeout settings
- Consider async processing for complex queries

#### 6. "Invalid signature" errors
**Problem**: Webhook signature validation fails
**Solutions**:
- Verify `SLACK_SIGNING_SECRET` exactly matches app dashboard
- Check system clock is synchronized
- Ensure signature validation is enabled
- Verify webhook payload isn't modified in transit

### Debug Mode

Enable debug logging by setting:
```env
LOG_LEVEL=debug
NODE_ENV=development
```

This will provide detailed logs for:
- Webhook event processing
- LLM requests and responses
- Slack API calls
- Authentication attempts

### Health Checks

Monitor these endpoints:
- `/api/health` - Overall application health
- `/api/slack/health` - Slack connectivity
- `/api/query/health` - LLM service health

### Performance Monitoring

Track these metrics:
- Webhook response time (should be <3 seconds for acknowledgment)
- LLM processing time (should be <25 seconds total)
- Error rates by component
- Memory and CPU usage

## Security Best Practices

### Environment Variables
- Never commit API keys to version control
- Use deployment platform's secure environment variable storage
- Rotate keys regularly
- Use least privilege principle for OAuth scopes

### Webhook Security
- Always enable signature validation in production
- Validate event timestamps to prevent replay attacks
- Implement rate limiting to prevent abuse
- Log security events for monitoring

### Network Security
- Use HTTPS only (enforced by Slack)
- Configure CORS appropriately
- Enable security headers (Helmet.js)
- Consider IP allowlisting if possible

## Support and Resources

### Slack API Documentation
- [Slack API Documentation](https://api.slack.com/)
- [Event API Guide](https://api.slack.com/events-api)
- [OAuth Guide](https://api.slack.com/authentication/oauth-v2)

### Deployment Platform Docs
- [Railway Docs](https://docs.railway.app/)
- [Render Docs](https://render.com/docs)
- [Vercel Docs](https://vercel.com/docs)
- [Heroku Docs](https://devcenter.heroku.com/)

### LLM Provider Documentation
- [OpenAI API Reference](https://platform.openai.com/docs)
- [Anthropic API Reference](https://docs.anthropic.com/)

### Getting Help
- Check application logs first
- Verify all environment variables are set
- Test individual components (health endpoints)
- Review Slack app event logs
- Check deployment platform status pages

## Conclusion

Following this guide, you should have a fully functional Slack Knowledge Agent that responds to mentions in real-time. The bot will use AI to provide intelligent answers based on your Slack workspace history and context.

Remember to:
- Keep your API keys secure
- Monitor usage and costs
- Regularly update dependencies
- Test thoroughly before deploying to production workspaces

For additional features and advanced configuration, refer to the main project documentation and the `webhook-design.md` technical specification.
