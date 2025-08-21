# Chat Interface Refactor Plan

## Overview

This document outlines the comprehensive refactor needed to transform the current single query/response interface into a conversational chat interface. The refactor will enable users to have ongoing conversations with the AI agent, with proper context retention and a modern chat UX.

## Current Architecture Analysis

### Frontend Current State
- **App.tsx**: Manages single `currentResponse` state
- **QueryInput**: Complex form with advanced options (date range, file inclusion, thread options)
- **ResponseDisplay**: Shows single response with metadata and sources
- **State Management**: Single query/response pair, no conversation history
- **UI Layout**: Grid layout with channel selector on left, query/response on right

### Backend Current State
- **API Route**: `/query` endpoint processes single queries
- **Response Format**: Single QueryResponse with metadata
- **Streaming**: Already supports streaming via `stream: true` option
- **Context**: Per-query context, no conversation memory
- **Services**: QueryExecutor, LLMService, AgentManager handle individual queries

## Target Architecture

### Chat Interface Goals
1. **Conversational UX**: Multiple message exchanges in a single conversation
2. **Context Retention**: AI remembers previous messages in conversation
3. **Real-time Responses**: Streaming responses for immediate feedback
4. **Conversation Management**: Create, view, delete conversations
5. **Persistent History**: Conversations survive page refreshes
6. **Mobile-Friendly**: Responsive chat interface

### Key Design Decisions
- **Conversation-First**: Move from query-centric to conversation-centric design
- **Simplified Input**: Streamline message input (move advanced options to settings)
- **Message History**: Store complete conversation threads
- **Contextual Queries**: Each query includes conversation history for context

## Detailed Implementation Plan

### Phase 1: Backend API Changes

#### 1.1 New Types and Interfaces

```typescript
// New conversation types
interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  metadata?: {
    tokenUsage?: TokenUsage;
    processingTime?: number;
    sources?: Source[];
  };
}

interface Conversation {
  id: string;
  title?: string;
  messages: ChatMessage[];
  channels: string[];
  options: ConversationOptions;
  createdAt: Date;
  updatedAt: Date;
}

interface ConversationOptions {
  includeFiles: boolean;
  includeThreads: boolean;
  dateRange?: {
    start?: string;
    end?: string;
  };
}

interface ChatRequest {
  conversationId?: string;
  message: string;
  channels: string[];
  options?: ConversationOptions;
  stream?: boolean;
}
```

#### 1.2 New API Endpoints

```typescript
// New chat routes (/api/chat)
POST /chat                     // Send message, create/continue conversation
GET /chat/:conversationId      // Get conversation history
GET /chat                      // List user's conversations
POST /chat/:conversationId/new // Start new conversation with same settings
DELETE /chat/:conversationId   // Delete conversation
```

#### 1.3 Services Modifications

**ConversationService**: New service to manage chat history
- Store/retrieve conversations (in-memory initially)
- Generate conversation titles from first user message
- Manage conversation lifecycle

**LLMService Updates**: 
- Accept conversation history as context
- Build conversation context for AI agent
- Stream responses with conversation awareness

### Phase 2: Frontend Refactor

#### 2.1 New Components

**ChatContainer**: Main chat interface
- Replaces the current grid layout
- Houses message history and input
- Manages conversation state

**ChatMessage**: Individual message display
- User message bubble (right-aligned)
- Assistant message bubble (left-aligned) 
- Metadata display (timestamps, tokens, sources)
- Copy functionality

**ChatInput**: Simplified message input
- Multi-line text input with send button
- Keyboard shortcuts (Enter to send, Shift+Enter for newline)
- Character limit display
- Loading state during response

**ConversationSidebar**: Conversation management
- List of previous conversations
- New conversation button
- Delete conversation functionality
- Channel selector integration

**ChannelSelector**: Updated for chat context
- Compact design for sidebar
- Quick channel switching
- Show selected channels in conversation header

#### 2.2 State Management Refactor

```typescript
// New state structure in App.tsx
interface AppState {
  currentConversation: Conversation | null;
  conversations: Conversation[];
  selectedChannels: string[];
  isLoading: boolean;
  streamingMessage: string;
}

// Key state changes:
// - Replace currentResponse with currentConversation
// - Add conversations array for conversation list
// - Add streamingMessage for real-time updates
// - Move selectedChannels to conversation level
```

#### 2.3 UI/UX Changes

**Layout Structure**:
```
┌─────────────────┬─────────────────────────────────┐
│   Sidebar       │        Chat Area                │
│                 │                                 │
│ - Conversations │  ┌─────────────────────────────┐ │
│ - New Chat      │  │     Message History         │ │
│ - Channels      │  │  User: Hi, how are you?     │ │
│ - Settings      │  │  AI: I'm doing well...      │ │
│                 │  │  User: Tell me about...     │ │
│                 │  │  AI: [Streaming response]   │ │
│                 │  └─────────────────────────────┘ │
│                 │  ┌─────────────────────────────┐ │
│                 │  │     Message Input           │ │
│                 │  │ [Type your message...]      │ │
│                 │  └─────────────────────────────┘ │
└─────────────────┴─────────────────────────────────┘
```

**Message Styling**:
- User messages: Right-aligned, blue/primary color
- AI messages: Left-aligned, gray/neutral color
- Timestamps and metadata: Subtle, expandable
- Sources: Collapsible sections

### Phase 3: Advanced Features

#### 3.1 Conversation Context
- Include last N messages in API requests for context
- Smart context truncation to stay within token limits
- Conversation title generation based on first user message

#### 3.2 Streaming Integration
- Real-time message updates as AI responds
- Typing indicators during response generation
- Smooth scrolling to newest messages

#### 3.3 Persistence
- Local storage for conversation history
- Session restoration on page reload
- Export/import conversation functionality

#### 3.4 Advanced Options
- Move advanced query options (date range, file inclusion) to:
  - Conversation settings (applies to whole conversation)
  - Per-message options (contextual menu)
  - Global preferences

## Implementation Steps

### Backend Implementation (Priority 1)

1. **Create ConversationService**:
   - In-memory conversation storage
   - CRUD operations for conversations
   - Message history management

2. **Add Chat API Routes**:
   - New `/api/chat` router
   - Conversation endpoints
   - Streaming message support

3. **Update LLM Context Building**:
   - Include conversation history in LLMContext
   - Conversation-aware prompting
   - Token limit management

### Frontend Implementation (Priority 2)

1. **Create Core Chat Components**:
   - ChatContainer component
   - ChatMessage component
   - ChatInput component

2. **Refactor App.tsx**:
   - New conversation state management
   - Chat-focused layout
   - Streaming response handling

3. **Update API Integration**:
   - New chat API hooks
   - Streaming response handling
   - Conversation persistence

### Polish and Enhancement (Priority 3)

1. **UX Improvements**:
   - Conversation sidebar
   - Message styling and animations
   - Responsive design

2. **Advanced Features**:
   - Conversation persistence
   - Export functionality
   - Advanced settings

## File Changes Required

### New Files
- `frontend/src/components/chat/ChatContainer.tsx`
- `frontend/src/components/chat/ChatMessage.tsx`
- `frontend/src/components/chat/ChatInput.tsx`
- `frontend/src/components/chat/ConversationSidebar.tsx`
- `frontend/src/types/chat.ts`
- `frontend/src/hooks/chat.ts`
- `backend/src/services/ConversationService.ts`
- `backend/src/routes/chat.ts`
- `backend/src/api/dto/ChatDto.ts`

### Modified Files
- `frontend/src/App.tsx` - Complete refactor for chat interface
- `frontend/src/types/api.ts` - Add chat-related types
- `frontend/src/lib/api.ts` - Add chat API methods
- `frontend/src/components/ChannelSelector.tsx` - Adapt for sidebar
- `backend/src/server.ts` - Add chat routes
- `backend/src/services/LLMService.ts` - Add conversation context support

### Removed/Deprecated Files
- Keep existing components for gradual migration
- Potentially remove after chat interface is stable:
  - Current `QueryInput.tsx` (replace with ChatInput)
  - Current `ResponseDisplay.tsx` (replace with ChatMessage)

## Migration Strategy

### Phase 1: Parallel Implementation
- Implement chat interface alongside existing query interface
- Add route flag to switch between interfaces
- Test chat functionality without breaking existing features

### Phase 2: Gradual Migration
- Default to chat interface for new users
- Provide toggle to switch back to query interface
- Gather user feedback and iterate

### Phase 3: Full Replacement
- Remove old query interface components
- Clean up deprecated code
- Optimize chat performance

## Technical Considerations

### Performance
- **Message Pagination**: Load conversation history in chunks
- **Context Truncation**: Smart message truncation for token limits  
- **Streaming Optimization**: Efficient WebSocket or SSE implementation
- **Memory Management**: Clean up old conversations from memory

### User Experience
- **Auto-scroll**: Always scroll to newest message
- **Typing Indicators**: Show when AI is responding
- **Error Handling**: Graceful failure handling for network issues
- **Keyboard Shortcuts**: Intuitive keyboard navigation

### Accessibility
- **Screen Reader Support**: Proper ARIA labels for chat messages
- **Keyboard Navigation**: Full keyboard accessibility
- **Focus Management**: Proper focus handling in chat flow

### Data Management
- **Local Storage**: Save conversations locally
- **Sync Strategy**: Future server-side persistence
- **Data Export**: Allow users to export conversation history

## Success Metrics

### Functional Requirements
- ✅ Users can start new conversations
- ✅ Users can send messages and receive responses
- ✅ Conversation history is maintained and displayed
- ✅ AI responses include conversation context
- ✅ Streaming responses work properly
- ✅ Channel selection works in chat context

### Performance Requirements
- Response time < 2 seconds for typical queries
- Smooth streaming with < 100ms chunk delays
- UI remains responsive during streaming
- Memory usage stays reasonable with long conversations

### UX Requirements
- Intuitive chat interface familiar to users
- Clear distinction between user and AI messages
- Easy access to conversation history
- Mobile-responsive design
- Accessible to screen readers

## Risk Mitigation

### Backwards Compatibility
- Keep existing API endpoints during transition
- Implement feature flags for gradual rollout
- Provide fallback to query interface if needed

### Error Handling
- Graceful degradation when streaming fails
- Proper error messages for conversation failures
- Recovery mechanisms for interrupted conversations

### Performance Risks
- Monitor token usage with conversation context
- Implement conversation length limits
- Add pagination for very long conversations

## Timeline Estimate

- **Backend API Changes**: 1-2 days
- **Core Frontend Components**: 2-3 days  
- **Integration and Testing**: 1-2 days
- **Polish and Advanced Features**: 1-2 days
- **Total Estimated Time**: 5-9 days

This refactor will significantly improve user experience by enabling natural conversational interactions with the Slack knowledge agent, while maintaining all existing functionality around channel search and AI-powered insights.
