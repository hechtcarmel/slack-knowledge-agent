# Running Guide

This guide provides step-by-step instructions for setting up, building, and running the Slack Knowledge Agent application.

## Prerequisites

- **Node.js 18+** (tested with v18.20.7)
- **pnpm 8+** (project uses pnpm v8.15.0)
- **Slack App** with Bot and User tokens
- **OpenAI or Anthropic API Key**

## Quick Start

### 1. Clone and Install

```bash
git clone <repository-url>
cd slack-knowledge-agent
pnpm install
```

### 2. Configure Environment

Create a `.env` file in the root directory (copy from `.env.example`):

```bash
cp .env.example .env
```

Edit `.env` with your credentials:

```env
# Slack Configuration (Required)
SLACK_BOT_TOKEN=xoxb-your-bot-token
SLACK_SIGNING_SECRET=your-signing-secret
SLACK_USER_TOKEN=xoxp-your-user-token

# LLM Configuration (At least one required)
OPENAI_API_KEY=sk-your-openai-key
# ANTHROPIC_API_KEY=sk-ant-your-anthropic-key

# Server Configuration
PORT=3000
```

### 3. Development Mode

Run both frontend (port 5173) and backend (port 3000) with hot reload:

```bash
pnpm run dev
```

Access the application:
- Frontend: http://localhost:5173
- Backend API: http://localhost:3000

### 4. Production Build

Build both frontend and backend for production:

```bash
pnpm run build
```

This command:
1. Cleans previous builds
2. Builds frontend to `backend/public/`
3. Bundles backend with esbuild to `backend/dist/`

### 5. Production Run

Start the production server:

```bash
pnpm run start:prod
```

Or with environment variables:

```bash
NODE_ENV=production PORT=8000 pnpm run start:prod
```

The production server:
- Serves the React frontend from `/`
- Provides API endpoints at `/api/*`
- Handles Slack webhooks at `/slack/*`

## Available Scripts

### Root Directory Commands

| Command | Description |
|---------|-------------|
| `pnpm run dev` | Start both frontend and backend in development mode |
| `pnpm run build` | Build both frontend and backend for production |
| `pnpm run start` | Start backend server (development mode) |
| `pnpm run start:prod` | Start backend server (production mode) |
| `pnpm run test` | Run backend tests |
| `pnpm run lint` | Run linting for both frontend and backend |
| `pnpm run typecheck` | Type check both frontend and backend |
| `pnpm run clean` | Clean all build artifacts |

### Backend-Specific Commands

```bash
cd backend
pnpm run dev              # Start with hot reload
pnpm run build            # Build for production
pnpm run test             # Run tests
pnpm run test:integration # Run integration tests (requires API keys)
pnpm run lint             # Run ESLint
pnpm run typecheck        # Type checking
```

### Frontend-Specific Commands

```bash
cd frontend
pnpm run dev       # Start Vite dev server
pnpm run build     # Build for production
pnpm run preview   # Preview production build
pnpm run lint      # Run ESLint
pnpm run typecheck # Type checking
```

## Docker Deployment

### Using Docker Compose (Recommended)

1. Ensure `.env` file exists with required variables
2. Build and start:

```bash
docker-compose up -d
```

The application will be available at http://localhost:8000

### Using Dockerfile

```bash
# Build image
docker build -t slack-knowledge-agent .

# Run container
docker run -p 8000:8000 --env-file .env slack-knowledge-agent
```

### Docker Management

```bash
# View logs
docker-compose logs -f

# Stop services
docker-compose down

# Rebuild after code changes
docker-compose up -d --build
```

## Health Checks

Verify the application is running correctly:

```bash
# Overall health
curl http://localhost:3000/api/health

# Slack connectivity
curl http://localhost:3000/api/slack/health

# LLM provider status
curl http://localhost:3000/api/query/health
```

## Troubleshooting

### Build Issues

If you encounter build errors:

1. **Clean everything and rebuild:**
```bash
pnpm run clean
rm -rf node_modules
pnpm install
pnpm run build
```

2. **Memory issues during build:**
```bash
# Increase Node.js memory limit
NODE_OPTIONS="--max-old-space-size=4096" pnpm run build
```

### Runtime Issues

1. **Port already in use:**
```bash
# Find process using port 3000
lsof -i :3000
# Kill the process
kill -9 <PID>
```

2. **Slack bot not responding:**
- Ensure bot is invited to channels: `/invite @bot-name`
- Verify SLACK_BOT_TOKEN starts with `xoxb-`
- Check SLACK_USER_TOKEN starts with `xoxp-`

3. **LLM provider errors:**
- Verify API keys are correct
- Check API quotas and rate limits
- Ensure at least one provider (OpenAI or Anthropic) is configured

### Environment Variables

Required variables:
- `SLACK_BOT_TOKEN` - Bot User OAuth Token
- `SLACK_USER_TOKEN` - User OAuth Token (for search)
- `SLACK_SIGNING_SECRET` - For webhook verification
- `OPENAI_API_KEY` or `ANTHROPIC_API_KEY` - At least one

Optional variables:
- `PORT` - Server port (default: 3000)
- `NODE_ENV` - Environment (development/production)
- `LLM_MODEL` - Model to use (default: gpt-4o)
- `DEFAULT_LLM_PROVIDER` - Provider choice (openai/anthropic)

## Production Deployment Checklist

- [ ] Environment variables configured
- [ ] `.env` file not committed to repository
- [ ] `NODE_ENV=production` set
- [ ] Proper logging configured
- [ ] Health checks verified
- [ ] HTTPS configured (if public-facing)
- [ ] Rate limiting configured (if needed)
- [ ] Monitoring/alerting set up
- [ ] Backup strategy for configuration

## Support

For issues or questions:
1. Check the [Architecture Guide](./ARCHITECTURE.md)
2. Review backend service documentation in `backend/docs/`
3. Check frontend component documentation in `frontend/docs/`
4. View logs: `docker-compose logs` or check `backend/logs/`

## Additional Resources

- [Slack App Setup Guide](./slack-app-setup.md)
- [API Documentation](./api-documentation.md)
- [Architecture Overview](./ARCHITECTURE.md)
- [Development Guide](./development-guide.md)