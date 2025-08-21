# Troubleshooting Guide: Backend Issues & Fixes

This document addresses the issues identified in the refactored backend and provides solutions.

## 🚨 Issues Identified & Fixed

### 1. **Service Resolution Error** ✅ FIXED
**Issue**: `Service not registered: Symbol(AppConfig)`

**Root Cause**: The `server_new.ts` was using a literal `Symbol('AppConfig')` instead of the proper service token.

**Fix Applied**:
- Updated `server_new.ts` to import and use `SERVICE_TOKENS.APP_CONFIG`
- Ensures consistent service token usage across the application

**Files Modified**:
- `src/server_new.ts`

### 2. **Tool Parameter Validation Failures** ✅ FIXED
**Issue**: LLM agent getting "Invalid or incomplete tool input" errors

**Root Cause**: The system prompt in the agent was providing inconsistent parameter guidance that conflicted with the actual tool schemas.

**Problems Found**:
- Agent prompt mentioned `channel_id` but `search_messages` expects `channels` (array)
- Inconsistent parameter format examples
- Tool descriptions didn't match actual Zod schemas

**Fix Applied**:
- Updated `SlackKnowledgeAgent.ts` system prompt with accurate parameter specifications
- Added clear examples of required parameter formats
- Emphasized using exact parameter names from tool schemas
- Added enhanced debugging to `GetChannelInfo.ts`

**Files Modified**:
- `src/llm/agents/SlackKnowledgeAgent.ts`
- `src/llm/tools/slack/GetChannelInfo.ts`

### 3. **Debugging & Testing Infrastructure** ✅ ADDED

**New Tools Created**:

#### Debug API Endpoints
- `GET /api/debug/tools` - Lists all available tools and their schemas
- `POST /api/debug/test-tool` - Test individual tools with parameters
- `GET /api/debug/channels` - Lists available Slack channels

#### Standalone Testing Scripts
- `pnpm test:tools` - Tests all Slack tools individually
- `pnpm test:integration` - Tests the complete refactored architecture

**Files Added**:
- `src/routes/debug.ts` - Debug API endpoints
- `src/test-tools.ts` - Standalone tool testing script

## 🧪 How to Test the Fixes

### 1. **Basic Server Startup Test**
```bash
cd backend
pnpm dev
```

**Expected**: Server should start without the `Symbol(AppConfig)` error.

### 2. **Tool Functionality Test**
```bash
pnpm test:tools
```

**Expected**: All tools should pass parameter validation and execute successfully.

### 3. **Debug API Test**
With the server running, test the debug endpoints:

```bash
# List available tools
curl http://localhost:3000/api/debug/tools

# Test get_channel_info tool
curl -X POST http://localhost:3000/api/debug/test-tool \
  -H "Content-Type: application/json" \
  -d '{
    "toolName": "get_channel_info",
    "parameters": {"channel_id": "C09B8CNEQNR"}
  }'

# List channels
curl http://localhost:3000/api/debug/channels
```

### 4. **LLM Query Test**
```bash
curl -X POST http://localhost:3000/api/query \
  -H "Content-Type: application/json" \
  -d '{
    "query": "Get info for channel C09B8CNEQNR",
    "channels": ["C09B8CNEQNR"]
  }'
```

**Expected**: Should work without "Invalid or incomplete tool input" errors.

## 🔍 Additional Troubleshooting

### **Network Issues (Premature Close)**
The "Premature close" errors from OpenAI API are typically network-related:

**Solutions**:
1. Check internet connectivity
2. Verify OpenAI API key is valid and has credits
3. Try with a different network if possible
4. Consider adding retry logic with exponential backoff

### **Tool Parameter Debugging**
If you still see parameter validation issues:

1. **Check tool schemas**:
   ```bash
   curl http://localhost:3000/api/debug/tools
   ```

2. **Test tools individually**:
   ```bash
   curl -X POST http://localhost:3000/api/debug/test-tool \
     -H "Content-Type: application/json" \
     -d '{"toolName": "TOOL_NAME", "parameters": {...}}'
   ```

3. **Check agent logs** for parameter format issues

### **Service Initialization Issues**
If services fail to initialize:

1. **Check environment variables**:
   - `SLACK_BOT_TOKEN` (starts with `xoxb-`)
   - `SLACK_USER_TOKEN` (starts with `xoxp-`)  
   - `OPENAI_API_KEY` (starts with `sk-`)

2. **Test service health**:
   ```bash
   curl http://localhost:3000/api/health
   ```

3. **Check service logs** for specific initialization errors

## 📋 Verification Checklist

- [ ] Server starts without `Symbol(AppConfig)` error
- [ ] All tools pass parameter validation (`pnpm test:tools`)
- [ ] Debug endpoints are accessible
- [ ] Health check shows all services as healthy
- [ ] LLM queries work without tool validation errors
- [ ] Individual tools can be tested via debug API

## 🚀 Performance Improvements Applied

1. **Better Error Messages**: Enhanced error logging with parameter details
2. **Tool Validation**: Clear parameter validation with helpful error messages  
3. **Debug Infrastructure**: Easy testing and troubleshooting tools
4. **Agent Prompt Clarity**: More precise tool usage instructions

## 📞 Next Steps

1. **Test all fixes** using the verification checklist above
2. **Monitor logs** for any remaining issues
3. **Use debug endpoints** to troubleshoot specific problems
4. **Report any persistent issues** with log context

The refactored architecture is now more robust and debuggable, with clear error messages and testing tools to help identify and resolve issues quickly.
