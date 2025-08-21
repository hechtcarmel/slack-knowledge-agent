# Getting Started Guide

This guide will help you set up and run the Slack Knowledge Agent quickly. Follow these steps to have the system running in your environment.

## Prerequisites

Before you begin, ensure you have the following installed on your system:

### Required Software
- **Node.js 20+**: [Download from nodejs.org](https://nodejs.org/)
- **pnpm 8+**: Install with `npm install -g pnpm`
- **Git**: For version control
- **Docker** (optional): For containerized deployment

### Check Versions
```bash
node --version    # Should be 20.x or higher
pnpm --version    # Should be 8.x or higher  
docker --version  # Optional, for Docker deployment
```

## Quick Setup (5 Minutes)

### 1. Clone the Repository
```bash
git clone <repository-url>
cd slack-knowledge-agent
```

### 2. Install Dependencies
```bash
# Install all dependencies (backend + frontend)
pnpm install
```

### 3. Set Up Environment Configuration
```bash
# Copy the environment template
cp .env.example .env
```

### 4. Configure Essential Environment Variables

Edit the `.env` file and add the minimum required configuration:

```env
# Slack Configuration (Required)
SLACK_BOT_TOKEN=xoxb-your-bot-token-here
SLACK_USER_TOKEN=xoxp-your-user-token-here  
SLACK_SIGNING_SECRET=your-signing-secret

# LLM Configuration (Required - Choose one)
OPENAI_API_KEY=our-openai-api-key-here
# OR
ANTHROPIC_API_KEY=ant-your-anthropic-api-key-here

# LLM Settings
DEFAULT_LLM_PROVIDER=openai
LLM_MODEL=gpt-4o-mini
```

> ⚠️ **Don't have these tokens yet?** See the [Slack Setup Guide](./SLACK_SETUP.md) and [LLM Setup Guide](./LLM_SETUP.md) for detailed instructions.

### 5. Start the Application
```bash
# Start both backend and frontend in development mode
pnpm run dev
```

The application will start:
- **Frontend**: http://localhost:5173
- **Backend**: http://localhost:3000
- **API Health Check**: http://localhost:3000/api/health

## Detailed Setup

### Project Structure Overview
```
slack-knowledge-agent/
├── backend/          # Node.js/TypeScript API server
├── frontend/         # React/TypeScript web application  
├── docs/            # Documentation
├── docker-compose.yml # Docker deployment configuration
└── package.json     # Root package configuration
```

### Backend Setup
```bash
# Navigate to backend directory
cd backend

# Install dependencies
pnpm install

# Start development server
pnpm run dev

# Available backend commands
pnpm run build      # Build for production
pnpm run start      # Start production server
pnpm run test       # Run tests
pnpm run lint       # Lint code
pnpm run typecheck  # TypeScript type checking
```

### Frontend Setup
```bash  
# Navigate to frontend directory
cd frontend

# Install dependencies
pnpm install

# Start development server
pnpm run dev

# Available frontend commands
pnpm run build     # Build for production
pnpm run preview   # Preview production build
pnpm run lint      # Lint code
pnpm run typecheck # TypeScript type checking
```

## Verification Steps

### 1. Check Backend Health
```bash
curl http://localhost:3000/api/health
```

Expected response:
```json
{
  "status": "healthy",
  "timestamp": "2024-01-20T10:30:00.000Z",
  "services": {
    "slack": {"status": "connected"},
    "llm": {"status": "connected", "provider": "openai"}
  }
}
```

### 2. Check Frontend Access
Open http://localhost:5173 in your browser. You should see:
- Slack Knowledge Agent interface
- Channel selector sidebar  
- Chat interface in the main area
- Status indicators showing connected services

### 3. Test Basic Functionality
1. **Select Channels**: Choose one or more channels from the sidebar
2. **Send Test Query**: Try asking "What is this workspace about?"
3. **Verify Response**: The AI should respond with information from your selected channels

## Configuration Options

### Environment Variables Overview

| Category | Variable | Description | Required |
|----------|----------|-------------|----------|
| **Slack** | `SLACK_BOT_TOKEN` | Bot user OAuth token | ✅ |
| | `SLACK_USER_TOKEN` | User OAuth token (for search) | ✅ |
| | `SLACK_SIGNING_SECRET` | Signing secret for webhooks | ✅ |
| **LLM** | `OPENAI_API_KEY` | OpenAI API key | ⚠️ |
| | `ANTHROPIC_API_KEY` | Anthropic API key | ⚠️ |
| | `DEFAULT_LLM_PROVIDER` | Default provider (openai/anthropic) | ✅ |
| **Server** | `PORT` | Server port | ❌ (default: 3000) |
| | `NODE_ENV` | Environment mode | ❌ (default: development) |

> ⚠️ At least one LLM provider key is required

### Development vs Production

#### Development Mode (Default)
- Hot reloading for both frontend and backend
- Detailed error messages and stack traces
- Development logging enabled
- CORS enabled for localhost

#### Production Mode
```bash
# Build both applications
pnpm run build

# Start production server
pnpm run start
```

## Docker Deployment (Optional)

### Quick Docker Start
```bash
# Build and start with Docker Compose
docker-compose up -d

# Check status
docker-compose ps

# View logs
docker-compose logs -f
```

### Docker Configuration
The application includes:
- **Multi-stage Dockerfile**: Optimized production builds
- **Docker Compose**: Complete application orchestration
- **Health Checks**: Container health monitoring
- **Volume Mounts**: Configuration file mounting

## Next Steps

### 1. Configure Your Slack App
- Follow the [Slack Setup Guide](./SLACK_SETUP.md) to create and configure your Slack app
- Set up proper bot permissions and install the app in your workspace

### 2. Channel Configuration
- Invite your bot to channels you want to search
- Configure channel metadata in `backend/config/channels.json` (optional)

### 3. Production Deployment
- Review the [Deployment Guide](./DEPLOYMENT.md) for production setup
- Configure proper environment variables for your environment
- Set up monitoring and logging

### 4. Customization
- Review the [Configuration Guide](./CONFIGURATION.md) for advanced settings
- Explore the [API Reference](./API_REFERENCE.md) for integration options

## Troubleshooting

### Common Issues

#### "Cannot connect to Slack API"
- Verify your `SLACK_BOT_TOKEN` is correct and starts with `xoxb-`
- Ensure your bot is installed in the workspace
- Check that your bot has necessary permissions

#### "LLM provider not available"
- Verify your API key is correct and has sufficient quota
- Check that `DEFAULT_LLM_PROVIDER` matches your configured provider
- Try switching to a different model if the current one is unavailable

#### "No channels available"
- Ensure your bot is invited to at least one channel
- Check that your `SLACK_USER_TOKEN` has proper permissions
- Try refreshing the channel list

#### "Permission denied" errors
- Review your Slack app's OAuth scopes
- Ensure your tokens have the necessary permissions
- Check that your app is properly installed in the workspace

### Getting Help

1. **Check Logs**: Review console output for detailed error messages
2. **API Health**: Check `/api/health` endpoint for service status
3. **Documentation**: Review component-specific documentation in `/docs/`
4. **Issues**: Report bugs via GitHub Issues

### Health Check Endpoints

Monitor your application with these endpoints:

```bash
# Overall application health
curl http://localhost:3000/api/health

# Detailed health information  
curl http://localhost:3000/api/health?detailed=true

# Individual service health
curl http://localhost:3000/api/slack/health
curl http://localhost:3000/api/query/health
```

---

*Next: [Configuration Guide](./CONFIGURATION.md) for detailed configuration options*
