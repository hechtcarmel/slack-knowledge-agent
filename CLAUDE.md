# Claude Development Guidelines - Slack Knowledge Agent

This document provides specific guidelines for working on the Slack Knowledge Agent project using Claude Code.

## 📋 Project-Specific Requirements

### **CRITICAL: Task Management**
- **ALWAYS** update `@docs/tasks.md` after completing any implementation work
- Mark completed tasks with ✅ and update progress metrics
- Add implementation notes and any deviations from original plans
- Update the "Implementation Status Update" section with current progress

### **Package Management**
- **ALWAYS use pnpm** - never use npm or yarn
- Run `pnpm install` for dependencies
- Use `pnpm run <script>` for all package scripts

### **Quality Assurance Pipeline**
After making ANY changes to the codebase, run these commands in sequence:

1. **Type Check**: `pnpm run typecheck`
2. **Build**: `pnpm run build` 
3. **Lint**: `pnpm run lint:fix`
4. **Test**: `pnpm run test`

**If any of these fail, fix the issues before proceeding or committing.**

## 🏗️ Architecture Guidelines

### **Follow Established Patterns**
- Use the existing error handling patterns (BaseError, SlackError, etc.)
- Follow the structured logging format with sensitive data filtering
- Implement retry logic for external API calls using RetryManager
- Use Zod for all validation schemas

### **Code Organization**
```
src/
├── api/          # REST routes, middleware, validators
├── core/         # Business logic, configuration
├── integrations/ # External service clients (Slack, LLM)
├── types/        # TypeScript definitions
├── utils/        # Shared utilities
└── server.ts     # Application entry point
```

### **Configuration Management**
- All environment variables must be defined in `src/core/config/env.ts`
- Use Zod schemas for validation
- Support hot-reloading for JSON configuration files
- Never commit sensitive data or real API keys

## 🔧 Development Workflow

### **Before Starting Work**
1. Read `@docs/tasks.md` to understand current progress
2. Read `@docs/requirements.md` and `@docs/design.md` for context
3. Check existing patterns in the codebase
4. Understand the current implementation status

### **During Implementation**
- Follow TypeScript strict mode requirements
- Use the existing utilities (Logger, RetryManager, etc.)
- Implement comprehensive error handling
- Add structured logging with appropriate levels
- Write tests for new functionality

### **After Completing Work**
1. Run the quality assurance pipeline (typecheck, build, lint, test)
2. Update `@docs/tasks.md` with completed tasks
3. Update progress metrics and status
4. Test the server starts and responds correctly
5. Create descriptive commit messages

## 📊 Current Project Status

### **Completed Infrastructure** ✅
- TypeScript project with strict configuration
- Express.js server with security middleware
- Structured logging with sensitive data filtering
- Environment configuration with Zod validation
- Hot-reloadable configuration management
- Docker containerization (production + development)
- Comprehensive error handling
- Request validation middleware
- Health check endpoints (`/api/health`)

### **Next Implementation Priorities**
1. **Phase 3: Slack Integration**
   - SlackClient class with retry logic
   - Search, thread, and channel API methods
   - Events API endpoint for @mentions
   - Request signature verification

2. **Phase 4: LLM Integration**
   - LLMManager with provider abstraction
   - OpenAI and Anthropic providers
   - Tool calling system for Slack data access

3. **Phase 5: Frontend Development**
   - React + Vite + Shadcn/ui setup
   - Channel selection and query interfaces

## 🛡️ Security & Best Practices

### **Security Requirements**
- Never log sensitive data (tokens, keys, credentials)
- Validate all incoming requests with Zod schemas
- Implement request signature verification for Slack webhooks
- Use non-root users in Docker containers
- Filter sensitive keys in logging (already implemented)

### **Code Quality Standards**
- Use TypeScript strict mode (configured)
- Follow ESLint and Prettier configurations
- Maintain >80% test coverage goal
- Implement proper error boundaries
- Use structured error responses

### **Performance Considerations**
- Implement retry logic with exponential backoff
- Use connection pooling for external APIs
- Add request rate limiting where appropriate
- Monitor token usage for LLM providers
- Implement response caching where beneficial

## 🧪 Testing Strategy

### **Test Categories**
- **Unit Tests**: Individual classes and functions
- **Integration Tests**: API endpoints and service interactions  
- **End-to-End Tests**: Complete user workflows
- **Load Tests**: Performance and concurrent request handling

### **Testing Commands**
```bash
pnpm run test           # Run all tests
pnpm run test:watch     # Watch mode for development
pnpm run test:coverage  # Generate coverage report
```

## 📝 Documentation Requirements

### **Code Documentation**
- Use JSDoc comments for public APIs
- Document complex business logic
- Explain "why" not just "what"
- Keep README.md updated with setup instructions

### **API Documentation**
- Document all endpoints with examples
- Include request/response schemas
- Document error codes and meanings
- Maintain OpenAPI/Swagger specifications

## 🔄 Continuous Integration

### **Pre-commit Hooks** (Already Configured)
- Automatic linting and formatting
- TypeScript type checking
- Prevents commits with lint errors

### **Development Scripts**
```bash
pnpm run dev        # Start development server with hot reload
pnpm run build      # Production build
pnpm run start      # Start production server
pnpm run typecheck  # TypeScript validation
pnpm run lint:fix   # Fix linting issues
```

## 📈 Progress Tracking

### **Task Management Process**
1. Before starting: Check `@docs/tasks.md` for current status
2. During work: Update task status to "🟨 In Progress" 
3. After completion: Mark as "✅ Completed" and update metrics
4. Document any changes or deviations from original plan

### **Commit Message Format**
Follow conventional commits:
```
feat: Add Slack client implementation
fix: Resolve retry logic bug in LLM provider
docs: Update API documentation
test: Add integration tests for health endpoints
```

### **Current Metrics** (Update after each session)
- **Tasks Completed**: 18/100 (18%)
- **Critical Tasks Completed**: 15/45 (33%)
- **Phase 1**: 100% Complete
- **Phase 2**: 80% Complete  
- **Overall Progress**: ~28/161 hours

## 🚨 Critical Success Factors

1. **Always run build and tests** before committing
2. **Keep @docs/tasks.md updated** with accurate progress
3. **Use pnpm exclusively** for package management
4. **Follow established architectural patterns**
5. **Implement comprehensive error handling**
6. **Maintain security best practices**
7. **Document significant changes and decisions**

---

**Remember**: This is a critical project requiring high reliability and maintainability. Take time to understand existing patterns, follow established conventions, and maintain quality standards throughout the implementation.