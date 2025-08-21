# AGENTS.md

## Project Overview

Slack Knowledge Agent is a TypeScript monorepo with backend (Node.js/Express) and frontend (React/Vite) applications. The system uses AI agents to extract knowledge from Slack workspaces via LangChain integration.

## 🚨 CRITICAL: Documentation Requirements

**ALL agents working on this project MUST:**
1. **Read the comprehensive documentation** in `docs/` folder before making any changes
2. **Maintain and update documentation** when implementing new features or changes  
3. **Reference relevant documentation sections** when working on specific components
4. **Keep documentation in sync** with code changes - outdated docs are worse than no docs

**Key documentation locations:**
- `docs/README.md` - Documentation index and navigation
- `docs/PROJECT_OVERVIEW.md` - High-level system understanding (READ FIRST)
- `docs/ARCHITECTURE.md` - System design and patterns (READ BEFORE CODING)
- `backend/docs/` - Backend-specific implementation details
- `frontend/docs/` - Frontend-specific implementation details

**Documentation is not optional - it's a core requirement for working on this codebase.**

## Setup Commands

```bash
# Install all dependencies (backend + frontend)
pnpm install

# Start both backend and frontend in development
pnpm run dev

# Build both applications for production  
pnpm run build

# Start production server
pnpm run start

# Run all tests
pnpm run test

# Lint all code
pnpm run lint
```

## Environment Configuration

**Critical**: Always copy `.env.example` to `.env` and configure these required variables:

```env
# Slack Configuration (Required)
SLACK_BOT_TOKEN=xoxb-your-bot-token-here
SLACK_USER_TOKEN=xoxp-your-user-token-here  
SLACK_SIGNING_SECRET=your-signing-secret

# LLM Configuration (Required - Choose one or both)
OPENAI_API_KEY=sk-your-openai-api-key-here
ANTHROPIC_API_KEY=sk-ant-your-anthropic-api-key-here

# LLM Settings
DEFAULT_LLM_PROVIDER=openai
LLM_MODEL=gpt-4o-mini
```

**Never commit real API keys or secrets to version control.**

## Development Workflow

### Quick Development Start
1. `cp .env.example .env` and configure environment variables
2. `pnpm install` to install all dependencies
3. `pnpm run dev` to start both backend (port 3000) and frontend (port 5173)
4. Verify setup: `curl http://localhost:3000/api/health`

### Code Organization
- `backend/` - Node.js/TypeScript API server with dependency injection
- `frontend/` - React/TypeScript SPA with Tailwind CSS
- `docs/` - Comprehensive project documentation
- Root-level commands orchestrate both applications

### Key Architectural Patterns
- **Backend**: Dependency injection container, service layer architecture, LangChain agents
- **Frontend**: Component composition, custom hooks, TanStack Query for server state
- **Shared**: TypeScript strict mode, consistent error handling, structured logging

## Testing Strategy

### Backend Testing
```bash
cd backend
pnpm run test           # Jest test suites
pnpm run test:coverage  # Generate coverage report
pnpm run test:integration # Test with real APIs (requires env vars)
pnpm run test:tools     # Test individual Slack tools
```

### Frontend Testing
```bash
cd frontend
pnpm run test           # Component and hook tests
```

### Test Requirements
- Add tests for new services, components, and utilities
- Integration tests require real Slack/LLM API keys in `.env`
- Maintain >80% code coverage on critical paths
- Test error scenarios and edge cases

## Code Style Guidelines

### TypeScript Standards
- **Strict mode enabled** - no `any` types without explicit justification
- **Interface over type** for object definitions
- **Explicit return types** for public methods
- **Consistent naming**: PascalCase for classes/interfaces, camelCase for functions/variables

### Code Formatting
- **Prettier configuration** applied automatically
- **ESLint rules** enforced - fix with `pnpm run lint:fix`
- **Import organization**: External imports first, then internal imports
- **File naming**: PascalCase for components, camelCase for utilities

### Architecture Patterns
- **Backend**: Service-oriented architecture with dependency injection
- **Frontend**: Functional components with hooks, no class components
- **Error handling**: Use custom error classes with proper context
- **Logging**: Structured logging with Winston (backend) and console (frontend)

## Build and Deployment

### Docker Deployment
```bash
# Quick Docker start
docker-compose up -d

# Check container health
docker-compose ps

# View logs
docker-compose logs -f
```

### Production Build Process
1. `pnpm run build` - Builds both backend and frontend
2. Backend compiles TypeScript to `backend/dist/`
3. Frontend builds to `frontend/dist/` and serves as static assets
4. Production server serves both API and static frontend

### Environment-Specific Behavior
- **Development**: Hot reload, detailed errors, CORS enabled
- **Production**: Minified builds, security headers, static file serving
- **Test**: Isolated environment, mock external services

## Development Environment Tips

### Backend Development
- Use `pnpm run dev` from backend folder for backend-only development
- Server restarts automatically on file changes via nodemon
- Check `/api/health` endpoint to verify service connections
- Use `pnpm run test:integration` to test real Slack/LLM integration

### Frontend Development  
- Use `pnpm run dev` from frontend folder for frontend-only development
- Proxy configuration routes `/api/*` to backend automatically
- TanStack Query DevTools available in development mode
- Error boundaries catch and display component errors gracefully

### Debugging Tips
- Backend logs to console and `logs/` directory with structured JSON
- Frontend uses browser DevTools and React DevTools
- Health endpoints: `/api/health`, `/api/slack/health`, `/api/query/health`
- Use `DEBUG=*` environment variable for verbose backend logging

## Security Considerations

### API Security
- **Never log or expose API keys** in error messages or responses
- **Input validation** with Zod schemas on all API endpoints
- **Rate limiting** configured for production environments
- **CORS** properly configured for allowed origins

### Slack Integration Security
- Bot tokens (`xoxb-`) for API operations, user tokens (`xoxp-`) for search
- Webhook signature verification using `SLACK_SIGNING_SECRET`
- Respect Slack channel permissions - bot only accesses invited channels
- **No data persistence** - Slack data processed in memory only

### LLM Provider Security
- API keys securely stored in environment variables
- **No training data** - user data never used to train models
- Request isolation - each query processed independently
- Provider switching supported for security/compliance requirements

## Common Issues and Solutions

### "Cannot connect to Slack API"
- Verify `SLACK_BOT_TOKEN` starts with `xoxb-` and is valid
- Ensure bot is installed in the Slack workspace
- Check bot has necessary OAuth scopes: `channels:read`, `chat:write`, `files:read`

### "LLM provider not available"  
- Verify API key format and validity
- Check API quota/billing status
- Try switching providers: `DEFAULT_LLM_PROVIDER=anthropic`

### "No channels available"
- Bot must be invited to channels: `/invite @your-bot-name`
- Verify `SLACK_USER_TOKEN` has `search:read` scope for message search
- Check workspace permissions and user token validity

### Build/Runtime Errors
- Clear `node_modules` and `pnpm-lock.yaml`, then `pnpm install`
- Verify Node.js version is 20+ and pnpm version is 8+
- Check TypeScript compilation: `pnpm run typecheck`

## PR and Commit Guidelines

### Commit Format
```
feat(scope): description
fix(scope): description  
docs(scope): description
test(scope): description
```

### Pre-commit Checklist
- [ ] `pnpm run lint` passes without errors
- [ ] `pnpm run typecheck` passes without errors
- [ ] `pnpm run test` passes all tests
- [ ] Environment variables documented if new ones added
- [ ] Tests added for new functionality
- [ ] Documentation updated for API changes

### PR Requirements
- Title format: `[component] Brief description`
- All CI checks must pass
- Add tests for new features or bug fixes
- Update relevant documentation in `docs/` folder
- No hardcoded secrets or API keys in code

## Monorepo Structure

### Root Level Commands
All root-level `pnpm` commands orchestrate both backend and frontend:
- `pnpm run dev` → Starts both applications concurrently
- `pnpm run build` → Builds both applications
- `pnpm run test` → Runs backend tests (frontend tests need explicit path)

### Component-Specific Commands
Navigate to `backend/` or `frontend/` directories for component-specific operations:
- More granular control over individual services
- Component-specific environment variables
- Isolated dependency management

### File Organization
- Shared types and schemas should go in appropriate component
- Documentation in `docs/` folder with cross-references
- Configuration files at appropriate levels (root, backend, frontend)
