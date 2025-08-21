# Migration Guide: New Refactored Backend Architecture

This guide explains how to migrate from the old backend architecture to the new refactored version.

## 🚀 Quick Migration Steps

### 1. **Switch Entry Point**
**Old**: `src/server.ts`
```bash
pnpm dev  # Uses old server.ts
```

**New**: `src/server_new.ts`
```bash
# Update package.json scripts to use the new entry point
node src/server_new.ts
# OR
tsx src/server_new.ts
```

### 2. **Environment Variables**
The new architecture uses the same environment variables but with enhanced validation:

**Required Environment Variables:**
```env
# Server
NODE_ENV=development
PORT=3000

# Slack (Required)
SLACK_BOT_TOKEN=xoxb-your-bot-token
SLACK_USER_TOKEN=xoxp-your-user-token
SLACK_SIGNING_SECRET=your-signing-secret

# LLM (Required)
OPENAI_API_KEY=sk-your-openai-key
DEFAULT_LLM_PROVIDER=openai
LLM_MODEL=gpt-4o-mini

# Optional
ANTHROPIC_API_KEY=sk-ant-your-anthropic-key
MAX_CONTEXT_TOKENS=8000
DEFAULT_QUERY_LIMIT=50
MAX_QUERY_LIMIT=200
```

### 3. **API Compatibility**
✅ **All existing API endpoints remain the same**
- `/api/health` - System health checks
- `/api/slack/*` - Slack operations
- `/api/query/*` - LLM query processing

The new architecture maintains **100% backward compatibility** with existing API contracts.

## 📊 What Changed

### **Service Layer Architecture**
```
OLD ARCHITECTURE:
SlackService → SlackClient → Slack API
LangChainManager (monolithic) → LLM Providers

NEW ARCHITECTURE:
SlackService → SlackApiClient → Slack API
LLMService → {
  ├── LLMProviderManager → LLM Providers
  ├── QueryExecutor → Query Processing
  └── AgentManager → Agent Lifecycle
}
```

### **Dependency Injection**
**Old**: Manual dependency creation in server.ts
```typescript
// OLD
const slackService = new SlackService(botToken, userToken);
const llmManager = new LangChainManager(apiKey, ...);
```

**New**: Container-managed dependencies
```typescript
// NEW
const container = new Container();
const slackService = container.resolve(SERVICE_TOKENS.SLACK_SERVICE);
const llmService = container.resolve(SERVICE_TOKENS.LLM_SERVICE);
```

### **Configuration Management**
**Old**: Scattered configuration loading
**New**: Centralized `AppConfig` class with validation

### **Error Handling**
**Old**: Inconsistent error responses
**New**: Standardized error responses with proper context

## 🧪 Testing the Migration

### 1. **Basic Health Check**
```bash
curl http://localhost:3000/api/health
```
Expected response:
```json
{
  "status": "success",
  "data": {
    "slack": { "status": "connected" },
    "llm": { "status": "healthy" }
  }
}
```

### 2. **Slack Integration Test**
```bash
curl http://localhost:3000/api/slack/channels
```

### 3. **LLM Query Test**
```bash
curl -X POST http://localhost:3000/api/query \
  -H "Content-Type: application/json" \
  -d '{
    "query": "What has been discussed recently?",
    "channels": ["general"]
  }'
```

## 🔧 Development Differences

### **Service Registration** (for developers adding new services)
**Old**: Manual instantiation
```typescript
const myService = new MyService(dependencies...);
```

**New**: Container registration
```typescript
container.registerSingleton(
  'MyService',
  MyService,
  [SERVICE_TOKENS.DEPENDENCY1, SERVICE_TOKENS.DEPENDENCY2]
);
```

### **Testing**
**New architecture enables much better testing:**
```typescript
// Mock dependencies easily
const mockSlackService = createMock<ISlackService>();
container.registerInstance(SERVICE_TOKENS.SLACK_SERVICE, mockSlackService);

// Test in isolation
const llmService = container.resolve(SERVICE_TOKENS.LLM_SERVICE);
```

## 🚨 Troubleshooting

### **"Service not initialized" errors**
Make sure you're using the new entry point (`server_new.ts`) which properly initializes the dependency injection container.

### **Configuration validation errors**
The new system has stricter validation. Check that all required environment variables are properly set with correct formats (e.g., tokens start with correct prefixes).

### **"Provider not available" errors**
Ensure your API keys are valid and the LLM providers are properly configured in the environment.

## 📈 Performance Improvements

The new architecture provides several performance benefits:

1. **Service Caching**: Services are singletons, reducing initialization overhead
2. **Agent Reuse**: LLM agents are cached and reused across queries
3. **Better Memory Management**: Proper service disposal and cleanup
4. **Connection Pooling**: Improved resource management

## 🔄 Rollback Plan

If you need to rollback to the old architecture:

1. **Switch back to old entry point**:
   ```bash
   # Use old server.ts
   node src/server.ts
   ```

2. **The old files are still present** and functional

3. **No data migration needed** - both versions use the same data structures

## 🎯 Next Steps

1. **Test thoroughly** with your specific use cases
2. **Update deployment scripts** to use `server_new.ts`
3. **Monitor performance** - should see improvements
4. **Consider removing old files** once fully migrated

## 📞 Support

If you encounter any issues during migration:

1. Check the logs - much better error messages now
2. Verify environment variables with the new validation
3. Test individual services using the health endpoints
4. The old architecture remains as fallback during transition

---

## Summary

✅ **Zero Downtime Migration** - Switch entry points
✅ **Backward Compatible** - All existing APIs work
✅ **Better Architecture** - Cleaner separation of concerns  
✅ **Enhanced Testing** - Dependency injection enables mocking
✅ **Improved Performance** - Service caching and reuse
✅ **Better Monitoring** - Enhanced health checks and logging

The new architecture maintains all existing functionality while providing a much more maintainable and scalable foundation for future development.
