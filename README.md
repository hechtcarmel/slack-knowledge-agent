# Slack Knowledge Agent

An AI-powered service that leverages Slack APIs to provide intelligent answers based on data from various Slack channels. It combines a modern web interface with LLM capabilities to query and analyze Slack workspace content.

## Features

- 🤖 AI-powered knowledge extraction from Slack workspaces
- 🔍 Search messages, threads, files, and channel information
- 🌐 Modern React web interface with Shadcn/ui components
- 🔌 Support for OpenAI and Anthropic LLM providers
- 📱 Slack bot integration with @mention responses
- 🐳 Docker containerized deployment
- 🛡️ Secure request validation and authentication

## Quick Start

### Prerequisites

- Node.js 20+
- pnpm 8+
- Docker (optional)

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd slack-knowledge-agent
```

2. Install dependencies:
```bash
pnpm install
```

3. Copy environment file:
```bash
cp .env.example .env
```

4. Configure your environment variables (see [Configuration](#configuration))

5. Start development server:
```bash
pnpm run dev
```

## Configuration

Create a `.env` file with the following variables:

```env
# Slack Configuration
SLACK_BOT_TOKEN=xoxb-your-bot-token
SLACK_SIGNING_SECRET=your-signing-secret
SLACK_APP_TOKEN=xapp-your-app-token

# LLM Configuration
OPENAI_API_KEY=sk-your-openai-key
ANTHROPIC_API_KEY=sk-ant-your-anthropic-key
DEFAULT_LLM_PROVIDER=openai
LLM_MODEL=gpt-4-turbo-preview
MAX_CONTEXT_TOKENS=8000

# Query Configuration
MAX_HISTORY_DAYS=90
DEFAULT_QUERY_LIMIT=50
MAX_QUERY_LIMIT=200

# Server Configuration
PORT=3000
NODE_ENV=development
```

## Architecture

The project follows a modular architecture:

```
src/
├── api/                # REST API routes and middleware
├── core/               # Core business logic
├── integrations/       # External service integrations
├── types/             # TypeScript type definitions
├── utils/             # Shared utilities
└── server.ts          # Application entry point
```

## Development

### Scripts

- `pnpm run dev` - Start development server with hot reload
- `pnpm run build` - Build for production
- `pnpm run start` - Start production server
- `pnpm run test` - Run tests
- `pnpm run lint` - Lint code
- `pnpm run typecheck` - Type check

### Testing

```bash
# Run all tests
pnpm run test

# Run tests in watch mode
pnpm run test:watch

# Generate coverage report
pnpm run test:coverage
```

## Deployment

### Docker

1. Build the image:
```bash
docker build -t slack-knowledge-agent .
```

2. Run the container:
```bash
docker run -p 3000:3000 --env-file .env slack-knowledge-agent
```

### Docker Compose

```bash
docker-compose up -d
```

## API Documentation

The API provides the following endpoints:

- `POST /api/query` - Submit queries to the knowledge agent
- `GET /api/channels` - Get available channels
- `GET /api/health` - Health check
- `POST /slack/events` - Slack events webhook

See the [API Documentation](docs/api.md) for detailed information.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Run linting and tests
6. Submit a pull request

## License

MIT License - see [LICENSE](LICENSE) file for details.