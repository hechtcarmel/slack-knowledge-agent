# AGENTS.md - Backend

## Backend Architecture Overview

Node.js/TypeScript API server using Express.js with dependency injection container pattern. Core responsibilities: REST API, LLM agent orchestration, Slack API integration, and business logic services.

## 🚨 CRITICAL: Backend Documentation Requirements

**Before working on backend code, agents MUST read:**
1. `../docs/PROJECT_OVERVIEW.md` - Overall system understanding
2. `../docs/ARCHITECTURE.md` - High-level architecture patterns  
3. `docs/README.md` - Backend-specific architecture overview
4. `docs/SERVICES.md` - Service layer patterns and implementations
5. `docs/LLM.md` - LLM integration and agent architecture
6. `docs/SLACK.md` - Slack API integration patterns

**When making changes, agents MUST:**
- Update relevant documentation in `backend/docs/` folder
- Keep API documentation synchronized with endpoint changes
- Update service documentation when modifying business logic
- Document new configuration options and environment variables

**Documentation maintenance is mandatory - not optional.**

## Development Commands

```bash
# Backend-specific development
cd backend
pnpm install                 # Install backend dependencies
pnpm run dev                 # Start dev server with hot reload
pnpm run dev:old            # Start with legacy server config

# Building and type checking
pnpm run build              # Compile TypeScript to dist/
pnpm run typecheck          # Type checking without compilation
pnpm run start              # Start production build

# Testing
pnpm run test               # Run Jest test suites
pnpm run test:watch         # Run tests in watch mode  
pnpm run test:coverage      # Generate coverage reports
pnpm run test:integration   # Test with real Slack/LLM APIs
pnpm run test:tools         # Test individual Slack tools

# Code quality
pnpm run lint               # ESLint checking
pnpm run lint:fix           # Auto-fix ESLint issues
pnpm run format             # Prettier formatting
```

## Service Architecture

### Dependency Injection Pattern
All services use constructor injection managed by custom DI container:

```typescript
// Service registration in ApplicationFactory
container.registerSingleton(SERVICE_TOKENS.SLACK_SERVICE, SlackService);
container.registerFactory(SERVICE_TOKENS.LLM_SERVICE, () => 
  new LLMService(slackService, config)
);

// Service resolution
const llmService = container.resolve<ILLMService>(SERVICE_TOKENS.LLM_SERVICE);
```

**Key principle**: Services should depend on interfaces, not concrete implementations.

### Service Layer Hierarchy
1. **LLMService** - Main orchestrator (depends on AgentManager, QueryExecutor)
2. **SlackService** - Slack API abstraction (depends on SlackApiClient)
3. **AgentManager** - LangChain agent lifecycle (depends on SlackService)
4. **QueryExecutor** - Query processing pipeline (depends on AgentManager, SlackService)

### Interface-First Design
Always create interfaces in `src/interfaces/services/` before implementing services:

```typescript
// Define interface first
export interface ISlackService {
  getChannels(): Promise<Channel[]>;
  searchMessages(params: SearchParams): Promise<SearchResult>;
}

// Implement interface
export class SlackService implements ISlackService {
  // Implementation...
}
```

## LLM Integration Patterns

### LangChain Agent Architecture
- **Tool-Calling Agents**: Use `createToolCallingAgent()` for reliable tool execution
- **Memory Management**: Implement conversation memory with token limits
- **Error Handling**: Wrap LangChain errors with application-specific error types

### Tool Development Pattern
All tools follow this structure:

```typescript
export class SlackTools {
  // 1. Zod schema for validation
  private toolSchema = z.object({
    param1: z.string().describe('Parameter description'),
    param2: z.array(z.string()).min(1)
  });

  // 2. Tool definition for LangChain
  getToolDefinition() {
    return {
      definition: { /* JSON schema */ },
      handler: this.toolHandler.bind(this)
    };
  }

  // 3. Handler implementation
  private async toolHandler(params: any): Promise<ToolExecutionResult> {
    try {
      const validated = this.toolSchema.parse(params);
      const result = await this.performOperation(validated);
      return { success: true, data: result };
    } catch (error) {
      return { success: false, error: this.formatError(error) };
    }
  }
}
```

### Provider Management
- Support multiple LLM providers (OpenAI, Anthropic) with runtime switching
- Provider health monitoring and failover
- Model-specific configuration and validation

## Slack API Integration

### API Client Patterns
Use `SlackApiClient` wrapper instead of direct Slack SDK:

```typescript
// Good - uses abstraction with error handling
const result = await this.slackService.searchMessages(params);

// Avoid - direct SDK usage bypasses error handling
const result = await this.slack.search.messages(query);
```

### Error Handling for Slack APIs
Provide user-friendly error messages for common Slack API issues:

```typescript
// Channel access errors
if (error.code === 'not_in_channel') {
  return new SlackError(
    'Bot needs to be invited to this channel',
    'CHANNEL_ACCESS_DENIED',
    { suggestion: 'Use /invite @bot-name in the channel' }
  );
}

// Permission errors  
if (error.code === 'missing_scope') {
  return new SlackError(
    'Missing required OAuth scope',
    'INSUFFICIENT_PERMISSIONS',
    { requiredScope: 'channels:read' }
  );
}
```

### Slack Token Management
- **Bot Token** (`xoxb-`): General API operations, channel access
- **User Token** (`xoxp-`): Search operations, user-level permissions
- **App Token** (`xapp-`): Socket mode events (future feature)

## Configuration Management

### Environment-Based Configuration
Use `AppConfig` class for all configuration access:

```typescript
// Get configuration sections
const slackConfig = appConfig.getSlackConfig();
const llmConfig = appConfig.getLLMConfig();

// Configuration is validated at startup
const validation = appConfig.validateConfiguration();
if (!validation.isValid) {
  // Application fails to start
}
```

### Configuration Validation
- **Schema Validation**: Zod schemas ensure type safety
- **Business Logic Validation**: Custom rules for configuration consistency
- **Environment-Specific Defaults**: Development vs production settings

## Testing Strategies

### Unit Testing Patterns
```typescript
// Use dependency injection for testability
describe('SlackService', () => {
  let slackService: SlackService;
  let mockApiClient: jest.Mocked<SlackApiClient>;

  beforeEach(() => {
    mockApiClient = createMockSlackApiClient();
    slackService = new SlackService(mockApiClient);
  });

  it('should handle channel not found error', async () => {
    mockApiClient.getChannelInfo.mockRejectedValue(
      new SlackApiError('channel_not_found')
    );

    await expect(slackService.getChannelById('invalid'))
      .rejects.toThrow('Channel not found');
  });
});
```

### Integration Testing
- Use `test:integration` command with real API keys
- Test actual Slack workspace integration
- Validate LLM provider connections
- Test tool execution with real data

### Tool Testing
- Use `test:tools` for individual tool validation
- Test with real Slack data when possible
- Validate error handling for common API issues

## Error Handling Patterns

### Custom Error Classes
```typescript
// Application-specific errors
export class LLMError extends Error {
  constructor(
    message: string, 
    public code: string, 
    public context?: any
  ) {
    super(message);
    this.name = 'LLMError';
  }
}

// Usage in services
throw new LLMError(
  'Agent initialization failed',
  'AGENT_INIT_ERROR',
  { provider, model, toolCount }
);
```

### Error Propagation Strategy
1. **Tool Level**: Specific error handling for API issues
2. **Service Level**: Business logic error wrapping
3. **API Level**: HTTP status codes and client-friendly messages
4. **Global Level**: Unhandled error logging and monitoring

## Logging and Monitoring

### Structured Logging
Use Winston logger with structured JSON output:

```typescript
const logger = Logger.create('ServiceName');

// Good - structured logging with context
logger.info('Query processed successfully', {
  query: query.substring(0, 100),
  provider: result.provider,
  toolCalls: result.toolCalls,
  processingTime: Date.now() - startTime
});

// Avoid - string concatenation
logger.info(`Processed query: ${query} with ${result.toolCalls} tool calls`);
```

### Health Check Implementation
All services should provide health status:

```typescript
export class MyService {
  getHealthStatus(): { status: 'healthy' | 'degraded' | 'unhealthy', details?: any } {
    try {
      // Check service dependencies
      return { status: 'healthy' };
    } catch (error) {
      return { 
        status: 'unhealthy', 
        details: { error: error.message } 
      };
    }
  }
}
```

## Development Environment Setup

### Required Environment Variables
```env
# Slack Integration
SLACK_BOT_TOKEN=xoxb-...        # Required for API access
SLACK_USER_TOKEN=xoxp-...       # Required for search functionality
SLACK_SIGNING_SECRET=...        # Required for webhook verification

# LLM Providers (at least one required)
OPENAI_API_KEY=sk-...           # OpenAI models
ANTHROPIC_API_KEY=sk-ant-...    # Claude models

# Configuration
DEFAULT_LLM_PROVIDER=openai     # Provider selection
LLM_MODEL=gpt-4o-mini          # Model selection
NODE_ENV=development            # Environment mode
```

### Development Server Features
- **Hot Reload**: Server restarts on file changes via nodemon
- **Detailed Errors**: Full stack traces and error context in development
- **Request Logging**: HTTP request/response logging via Morgan
- **TypeScript**: Direct execution via tsx without compilation

### Debugging Tools
- **Health Endpoints**: `/api/health`, `/api/slack/health`, `/api/query/health`
- **Debug Routes**: `/api/debug/*` for testing tools and services
- **Logging**: Structured logs to console and `logs/` directory
- **Error Traces**: Full stack traces with source maps

## Database and Persistence

**Note**: This application is stateless and does not use persistent storage.

- **No Database**: All data retrieved from Slack APIs in real-time
- **Memory Management**: Conversation memory with token limits, automatic cleanup
- **Caching**: Service-level caching for performance (channels, configuration)
- **File Storage**: Logs stored in `logs/` directory with rotation

## Performance Considerations

### Service Optimization
- **Singleton Pattern**: Core services instantiated once
- **Connection Pooling**: HTTP connections reused via agents
- **Caching**: Channel info and configuration cached with TTL
- **Concurrent Processing**: Multiple queries processed simultaneously

### Memory Management
- **Agent Caching**: LangChain agents cached per provider/model
- **Memory Limits**: Conversation memory bounded by token count
- **Garbage Collection**: Proper cleanup of resources in service disposal

### Rate Limiting
- **Slack API**: Respect tier-based rate limits with backoff
- **LLM Providers**: Implement request queuing and retry logic
- **Application**: Rate limiting middleware for API endpoints

## Security Implementation

### Token Security
- **Environment Variables**: All tokens stored in environment, never in code
- **Token Masking**: Logs mask sensitive tokens showing only prefixes
- **Scope Validation**: Verify tokens have required OAuth scopes

### Input Validation
- **Zod Schemas**: Runtime validation of all inputs
- **Sanitization**: Clean inputs to prevent injection attacks  
- **Error Messages**: Avoid exposing sensitive information in errors

### API Security
- **CORS**: Configured for allowed origins only
- **Headers**: Security headers via Helmet.js
- **Request Size**: Body parsing limits to prevent DoS

## Common Backend Issues

### Service Resolution Errors
```
Error: Service not registered: Symbol(ServiceName)
```
**Solution**: Ensure service is registered in `ApplicationFactory.registerServices()`

### Circular Dependency Detection
```
Error: Circular dependency detected: ServiceA -> ServiceB -> ServiceA
```
**Solution**: Break cycle by introducing abstraction or restructuring dependencies

### Slack API "not_in_channel" Errors
**Solution**: Bot must be invited to channels. Provide clear error message with `/invite` instruction.

### LLM Provider Timeout
**Solution**: Check API key validity, quota limits, and network connectivity.

### Memory Leaks in Long-Running Conversations
**Solution**: Implement conversation memory limits and periodic cleanup.

## Production Deployment Notes

### Build Process
1. TypeScript compilation to `dist/` folder
2. Source maps generated for debugging
3. Environment-specific configuration validation
4. Health check endpoints for load balancer integration

### Environment Requirements
- Node.js 20+ runtime
- Environment variables properly configured
- Log directory permissions for file logging
- Network access to Slack and LLM provider APIs

### Monitoring Integration
- Structured JSON logs compatible with log aggregation systems
- Health check endpoints for uptime monitoring  
- Error reporting with context and stack traces
- Performance metrics via service statistics endpoints
