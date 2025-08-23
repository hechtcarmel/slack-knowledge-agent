# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 🚨 CRITICAL: AGENTS.md Documentation Requirements

**Before working on ANY code in this project, you MUST:**

1. **READ ALL AGENTS.md files first** - These contain critical architecture patterns and requirements:
   - `/AGENTS.md` - Project overview and monorepo structure
   - `/backend/AGENTS.md` - Backend architecture, dependency injection, and service patterns
   - `/frontend/AGENTS.md` - Frontend architecture, component patterns, and state management

2. **FOLLOW the documentation requirements** specified in AGENTS.md files:
   - Backend agents must read `docs/ARCHITECTURE.md`, `backend/docs/SERVICES.md`, etc.
   - Frontend agents must read component and state management documentation
   - Update documentation when making changes

3. **AGENTS.md files are mandatory reading** - The project has specific architectural patterns that must be followed.

## Development Commands

### Quick Start
```bash
# Install dependencies for both backend and frontend
pnpm install

# Start both backend (port 3000) and frontend (port 5173) in development
pnpm run dev

# Build both applications for production
pnpm run build
```

### Backend Development
```bash
cd backend
pnpm run dev                 # Start with hot reload (uses server_new.ts)
pnpm run dev:old            # Start with legacy server (uses server.ts)
pnpm run build              # Compile TypeScript to dist/
pnpm run start              # Start production build
pnpm run test               # Run Jest test suites
pnpm run test:integration   # Test with real Slack/LLM APIs (requires env vars)
pnpm run test:tools         # Test individual Slack tools
pnpm run lint               # ESLint checking
pnpm run typecheck          # Type checking without compilation
```

### Frontend Development  
```bash
cd frontend
pnpm run dev                # Start Vite dev server with hot reload
pnpm run build              # Build for production
pnpm run preview            # Preview production build
pnpm run lint               # ESLint checking
pnpm run typecheck          # TypeScript type checking
```

## Architecture Overview

This is a **TypeScript monorepo** with:
- **Backend**: Node.js/Express API server with dependency injection container
- **Frontend**: React/TypeScript SPA with Vite, TanStack Query, and Shadcn/ui
- **Integration**: LangChain agents for AI-powered Slack knowledge extraction

### Backend Architecture (Critical Patterns)

#### Dependency Injection Container
- **Custom DI container** (`src/core/container/Container.ts`) manages all service lifecycles
- **Service registration** happens in `ApplicationFactory.registerServices()`
- **Interface-first design** - always define interfaces in `src/interfaces/services/`

```typescript
// Service registration pattern
container.registerSingleton(SERVICE_TOKENS.SLACK_SERVICE, SlackService);
container.registerFactory(SERVICE_TOKENS.LLM_SERVICE, () => new LLMService(...));

// Service resolution
const llmService = container.resolve<ILLMService>(SERVICE_TOKENS.LLM_SERVICE);
```

#### Service Layer Hierarchy
1. **LLMService** - Main orchestrator (entry point for queries)
2. **SlackService** - Slack API abstraction layer
3. **AgentManager** - LangChain agent lifecycle management
4. **QueryExecutor** - Query processing pipeline

#### LangChain Tool Architecture
- **Tool-calling agents** using `createToolCallingAgent()` 
- **Slack tools** in `src/llm/tools/slack/` (SearchMessages, GetThread, etc.)
- **Tool validation** with Zod schemas
- **Error handling** with structured error responses

### Frontend Architecture (Critical Patterns)

#### Component Structure
- **Functional components only** with TypeScript interfaces for props
- **Error boundaries** wrap major component sections
- **Shadcn/ui components** for consistent design system
- **Responsive design** with mobile-first approach

#### State Management Strategy
- **TanStack Query** for server state (API data, caching, background updates)
- **React useState** for local UI state
- **localStorage** for user preferences persistence
- **No global state libraries** (Redux, Zustand) - unnecessary for this app size

```typescript
// Server state pattern
const { data, error, isLoading } = useChannelsQuery();
const sendMessageMutation = useSendMessageMutation();

// Local state pattern
const [selectedChannels, setSelectedChannels] = useState<string[]>([]);
```

## Key Configuration

### Environment Variables (Required)
```env
# Slack Configuration (Required)
SLACK_BOT_TOKEN=xoxb-your-bot-token       # General API operations
SLACK_USER_TOKEN=xoxp-your-user-token     # Search functionality
SLACK_SIGNING_SECRET=your-signing-secret   # Webhook verification

# LLM Configuration (At least one required)
OPENAI_API_KEY=sk-your-openai-key
ANTHROPIC_API_KEY=sk-ant-your-anthropic-key
DEFAULT_LLM_PROVIDER=openai
LLM_MODEL=gpt-4o-mini

# Development
NODE_ENV=development
PORT=3000
```

**Always copy `.env.example` to `.env` and configure before development.**

### Package Manager
- **pnpm ONLY** - Do not use npm or yarn
- Root commands orchestrate both backend and frontend
- Individual component commands available in respective directories

## Testing Strategy

### Backend Testing
- **Unit tests** with Jest and mocked dependencies via DI container
- **Integration tests** (`pnpm run test:integration`) with real APIs
- **Tool tests** (`pnpm run test:tools`) for individual Slack tools
- **Service layer testing** with proper dependency injection mocks

### Frontend Testing
- **Component testing** with React Testing Library
- **Hook testing** for custom hooks
- **API integration testing** with TanStack Query

## Code Style and Patterns

### TypeScript Standards
- **Strict mode enabled** - no `any` types without justification
- **Interface over type** for object definitions
- **Explicit return types** for public methods
- **Consistent naming**: PascalCase for classes/interfaces, camelCase for functions

### Backend Patterns
- **Service-oriented architecture** with clear separation of concerns
- **Error handling** with custom error classes and structured context
- **Logging** with Winston structured JSON logging
- **Health checks** for all services

### Frontend Patterns
- **Component composition** over inheritance
- **Custom hooks** for reusable logic
- **Error boundaries** for fault isolation
- **Responsive design** with Tailwind CSS utilities

## Development Workflow

### Pre-Development Checklist
1. Read relevant AGENTS.md files
2. Copy `.env.example` to `.env` and configure
3. Run `pnpm install` from root
4. Verify setup: `curl http://localhost:3000/api/health`

### Code Quality Requirements
- **All backend services** must be registered in the DI container
- **All components** must have proper TypeScript interfaces
- **API integrations** must use the centralized API client
- **Error handling** must provide user-friendly messages
- **Tests required** for new services and components

### Health Check Endpoints
- `/api/health` - Overall application health
- `/api/slack/health` - Slack API connectivity
- `/api/query/health` - LLM provider connectivity

## Debugging and Common Issues

### Backend Issues
- **Service resolution errors**: Check service registration in `ApplicationFactory`
- **Circular dependency**: Use DI container's circular dependency detection
- **Slack "not_in_channel"**: Bot must be invited with `/invite @bot-name`
- **LLM provider timeout**: Check API keys, quotas, and network

### Frontend Issues  
- **State update during render**: Move updates to `useEffect` or event handlers
- **Query cache not updating**: Invalidate queries after mutations
- **Module resolution**: Check path mapping in `vite.config.ts`

## Production Deployment

### Build Process
1. `pnpm run build` compiles both backend and frontend
2. Backend TypeScript compiles to `backend/dist/`
3. Frontend builds to `frontend/dist/` and serves as static assets
4. Production server serves both API and static frontend

### Docker Deployment
```bash
# Quick Docker start
docker-compose up -d

# Check status
docker-compose ps
```

## Security Considerations

- **Never log API keys** or include them in error messages
- **Input validation** with Zod schemas on all endpoints
- **Webhook signature verification** for Slack events
- **CORS properly configured** for allowed origins
- **Bot permissions** - only accesses invited Slack channels

---

**Remember**: This codebase follows specific architectural patterns documented in the AGENTS.md files. Always read the relevant AGENTS.md files before making changes to understand the established patterns and requirements.