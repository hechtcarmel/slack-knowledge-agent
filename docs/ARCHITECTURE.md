# Architecture Guide

This document provides a comprehensive overview of the Slack Knowledge Agent architecture, design patterns, and technical implementation details.

## System Architecture

### High-Level Architecture

```mermaid
graph TB
    subgraph "Client Layer"
        Browser[Web Browser]
        Mobile[Mobile Browser]
    end
    
    subgraph "Frontend"
        React[React App]
        UI[Shadcn/UI Components]
        Query[TanStack Query]
        State[State Management]
    end
    
    subgraph "Backend API"
        Express[Express.js Server]
        Routes[API Routes]
        WebhookEndpoint[Webhook Endpoint]
        Middleware[Middleware Stack]
        Container[DI Container]
    end
    
    subgraph "Core Services"
        LLMService[LLM Service]
        SlackService[Slack Service]
        AgentManager[Agent Manager]
        QueryExecutor[Query Executor]
    end
    
    subgraph "Webhook Services"
        WebhookService[Webhook Service]
        EventProcessor[Event Processor]
        ResponsePoster[Response Poster]
    end
    
    subgraph "LLM Integration"
        LangChain[LangChain Agents]
        Tools[Slack Tools]
        Memory[Conversation Memory]
        Providers[LLM Providers]
    end
    
    subgraph "External Services"
        SlackAPI[Slack Web API]
        OpenAI[OpenAI API]
        Anthropic[Anthropic API]
    end
    
    Browser --> React
    Mobile --> React
    React --> Express
    SlackAPI --> WebhookEndpoint
    Express --> LLMService
    Express --> SlackService
    WebhookEndpoint --> WebhookService
    WebhookService --> EventProcessor
    EventProcessor --> LLMService
    EventProcessor --> ResponsePoster
    ResponsePoster --> SlackAPI
    LLMService --> AgentManager
    LLMService --> QueryExecutor
    AgentManager --> LangChain
    LangChain --> Tools
    Tools --> SlackAPI
    Providers --> OpenAI
    Providers --> Anthropic
```

## Backend Architecture

### Core Design Patterns

#### 1. Dependency Injection Container
The application uses a custom dependency injection container for service management:

```typescript
// Service registration
container.registerSingleton(SERVICE_TOKENS.SLACK_SERVICE, SlackService);
container.registerFactory(SERVICE_TOKENS.LLM_SERVICE, () => new LLMService(...));

// Service resolution
const slackService = container.resolve<ISlackService>(SERVICE_TOKENS.SLACK_SERVICE);
```

**Benefits:**
- Loose coupling between components
- Easy testing with mock services
- Lifecycle management (singleton, transient, scoped)
- Circular dependency detection

#### 2. Application Factory Pattern
The `ApplicationFactory` creates fully configured application instances:

```typescript
export class ApplicationFactory {
  async createApplication(options: ApplicationFactoryOptions): Promise<Application> {
    // Validate configuration
    // Create container
    // Register services
    // Setup middleware
    // Initialize routes
    // Configure error handling
  }
}
```

**Benefits:**
- Consistent application setup
- Environment-specific configuration
- Testable application creation
- Clear separation of concerns

#### 3. Service Layer Architecture

```mermaid
graph TB
    subgraph "Service Layer"
        LLMService[LLM Service<br/>Main orchestrator]
        SlackService[Slack Service<br/>Slack API abstraction]
        AgentManager[Agent Manager<br/>LangChain agent lifecycle]
        QueryExecutor[Query Executor<br/>Query processing pipeline]
        ProviderManager[Provider Manager<br/>LLM provider management]
    end
    
    subgraph "Infrastructure"
        Container[DI Container<br/>Service lifecycle]
        Config[App Config<br/>Configuration management]
        Logger[Logger<br/>Structured logging]
        ErrorHandler[Error Handler<br/>Error management]
    end
    
    LLMService --> AgentManager
    LLMService --> QueryExecutor
    LLMService --> ProviderManager
    QueryExecutor --> SlackService
    AgentManager --> SlackService
```

### Service Descriptions

#### LLM Service
**Purpose**: Main orchestration service for LLM operations
**Responsibilities**:
- Query processing coordination
- Provider management
- Memory management
- Health monitoring

#### Slack Service  
**Purpose**: Abstraction layer for Slack Web API
**Responsibilities**:
- Channel management
- Message searching
- File operations
- Thread retrieval

#### Agent Manager
**Purpose**: LangChain agent lifecycle management
**Responsibilities**:
- Agent creation and caching
- Tool registration
- Memory management
- Context formatting

#### Query Executor
**Purpose**: Query processing pipeline
**Responsibilities**:
- Query validation
- Context building
- Agent invocation
- Response formatting

### Tool-Based Architecture

The system uses a tool-based architecture where the LLM agent has access to specialized tools:

```mermaid
graph LR
    Agent[LangChain Agent] --> SearchTool[Search Messages]
    Agent --> HistoryTool[Get Channel History]
    Agent --> ThreadTool[Get Thread]
    Agent --> InfoTool[Get Channel Info]
    Agent --> FilesTool[List Files]
    Agent --> ContentTool[Get File Content]
    
    SearchTool --> SlackAPI[Slack Web API]
    HistoryTool --> SlackAPI
    ThreadTool --> SlackAPI
    InfoTool --> SlackAPI
    FilesTool --> SlackAPI
    ContentTool --> SlackAPI
```

#### Available Tools

| Tool | Purpose | Parameters |
|------|---------|------------|
| `search_messages` | Search for messages across channels | query, channels, limit, days_back |
| `get_channel_history` | Get recent messages from a channel | channel_id, limit, include_threads |
| `get_thread` | Get all messages in a thread | channel_id, thread_ts |
| `get_channel_info` | Get channel metadata | channel_id |
| `list_files` | List files shared in channels | channels, file_types, limit |
| `get_file_content` | Get content of text files | file_id |

### Webhook Architecture

The system includes a real-time webhook integration that allows the bot to respond to Slack events:

```mermaid
graph TB
    subgraph "Slack Platform"
        SlackEvents[Event Generation]
        SlackAPI[Slack Web API]
    end
    
    subgraph "Webhook Processing"
        WebhookEndpoint["/slack/events"]
        WebhookService[Webhook Service<br/>• Signature validation<br/>• Event deduplication<br/>• Health monitoring]
        EventProcessor[Event Processor<br/>• Context extraction<br/>• Event filtering<br/>• LLM coordination]
        ResponsePoster[Response Poster<br/>• Message formatting<br/>• Thread handling<br/>• Error recovery]
    end
    
    subgraph "Existing Services"
        LLMService[LLM Service]
        SlackKnowledgeAgent[Slack Knowledge Agent]
        SlackTools[Slack Tools]
    end
    
    SlackEvents --> WebhookEndpoint
    WebhookEndpoint --> WebhookService
    WebhookService --> EventProcessor
    EventProcessor --> LLMService
    LLMService --> SlackKnowledgeAgent
    SlackKnowledgeAgent --> SlackTools
    SlackTools --> SlackAPI
    EventProcessor --> ResponsePoster
    ResponsePoster --> SlackAPI
```

#### Webhook Service Components

##### WebhookService
**Purpose**: Main webhook orchestration and security
**Responsibilities**:
- HMAC-SHA256 signature validation
- Event deduplication using TTL-based cache
- Processing timeout management
- Health status monitoring
- Statistics tracking

##### EventProcessor
**Purpose**: Slack event processing and LLM coordination
**Responsibilities**:
- Event type filtering (app mentions, DMs)
- Context extraction from Slack events
- User and channel information resolution
- LLM context preparation
- Response coordination

##### ResponsePoster
**Purpose**: Post AI responses back to Slack
**Responsibilities**:
- Slack message formatting (markdown, mentions)
- Thread handling for conversational continuity
- Message length management and truncation
- Error handling with user notification
- Direct message support

#### Event Flow

```mermaid
sequenceDiagram
    participant Slack
    participant WebhookEndpoint
    participant WebhookService
    participant EventProcessor
    participant LLMService
    participant Agent
    participant ResponsePoster
    
    Slack->>WebhookEndpoint: POST /slack/events
    WebhookEndpoint->>WebhookService: handleSlackEvent()
    WebhookService->>WebhookService: validateSignature()
    WebhookService->>WebhookService: checkDuplicate()
    WebhookService->>WebhookEndpoint: 200 OK (< 3s)
    
    WebhookService->>EventProcessor: processEvent() [async]
    EventProcessor->>EventProcessor: extractContext()
    EventProcessor->>LLMService: processQuery()
    LLMService->>Agent: invoke()
    Agent->>Agent: Use Slack tools
    Agent->>LLMService: response
    LLMService->>EventProcessor: QueryResult
    EventProcessor->>ResponsePoster: postResponse()
    ResponsePoster->>Slack: chat.postMessage()
```

#### Security Features

- **Signature Validation**: HMAC-SHA256 verification of all incoming webhooks
- **Timestamp Validation**: Prevents replay attacks (5-minute window)
- **Event Deduplication**: Prevents processing of duplicate events
- **Input Sanitization**: All event data is validated and sanitized
- **Rate Limiting**: Built-in protection against event flooding

### Configuration Management

#### Hierarchical Configuration System
```typescript
interface AppConfiguration {
  server: ServerConfig;
  slack: SlackConfig;
  llm: LLMConfig;
  query: QueryConfig;
  logging: LoggingConfig;
  security: SecurityConfig;
  webhook: WebhookConfig;
}
```

#### Environment-Based Configuration
- **Development**: Defaults for local development
- **Production**: Security-focused settings
- **Test**: Isolated test environment settings

#### Validation Pipeline
1. **Schema Validation**: Zod schema validation for type safety
2. **Business Logic Validation**: Custom validation rules
3. **Cross-Field Validation**: Ensures configuration consistency

## Frontend Architecture

### Component Architecture

```mermaid
graph TB
    App[App Component<br/>Main application]
    
    subgraph "Layout Components"
        Layout[Layout<br/>Application shell]
        ErrorBoundary[Error Boundary<br/>Error handling]
    end
    
    subgraph "Feature Components"
        ChatContainer[Chat Container<br/>Main chat interface]
        ChannelSelector[Channel Selector<br/>Channel management]
        ChatMessage[Chat Message<br/>Message display]
        ChatInput[Chat Input<br/>Message input]
    end
    
    subgraph "UI Components"
        Button[Button]
        Input[Input]
        Card[Card]
        Dialog[Dialog]
        Sheet[Sheet]
    end
    
    App --> Layout
    App --> ErrorBoundary
    Layout --> ChatContainer
    Layout --> ChannelSelector
    ChatContainer --> ChatMessage
    ChatContainer --> ChatInput
    ChannelSelector --> Button
    ChatContainer --> Card
```

### State Management Strategy

#### Server State (TanStack Query)
- **API Data**: Channels, health status, query responses
- **Caching**: Automatic caching with configurable TTL
- **Background Updates**: Keep data fresh with background refetching
- **Error Handling**: Integrated error handling and retry logic

#### Local State (React State)
- **UI State**: Loading states, form inputs, modal visibility
- **Session State**: Selected channels, current conversation
- **Persistence**: LocalStorage for user preferences

#### State Flow
```mermaid
sequenceDiagram
    participant User
    participant React
    participant TanStack
    participant API
    participant Backend
    
    User->>React: Interact with UI
    React->>TanStack: Trigger query
    TanStack->>API: HTTP request
    API->>Backend: Process request
    Backend->>API: Response
    API->>TanStack: JSON response
    TanStack->>React: Update state
    React->>User: Update UI
```

### Component Communication Patterns

#### Props Down, Events Up
- Parent components pass data down via props
- Child components communicate up via callback functions
- Unidirectional data flow for predictability

#### Composition Pattern
```typescript
// Higher-order component for error boundaries
<ErrorBoundary fallback={<ErrorFallback />}>
  <ChatContainer>
    <ChatMessage message={message} />
    <ChatInput onSend={handleSend} />
  </ChatContainer>
</ErrorBoundary>
```

#### Custom Hook Pattern
```typescript
// Encapsulate related logic in custom hooks
const { channels, isLoading, error } = useChannelsQuery();
const { sendMessage, isPending } = useSendMessageMutation();
```

## Data Flow Architecture

### Request Processing Pipeline

```mermaid
sequenceDiagram
    participant User
    participant Frontend
    participant API
    participant LLMService
    participant Agent
    participant SlackAPI
    participant LLMProvider
    
    User->>Frontend: Submit query
    Frontend->>API: POST /api/query
    API->>LLMService: processQuery()
    LLMService->>Agent: invoke()
    
    loop Tool Execution
        Agent->>SlackAPI: Search/fetch data
        SlackAPI->>Agent: Return results
    end
    
    Agent->>LLMProvider: Generate response
    LLMProvider->>Agent: AI response
    Agent->>LLMService: Final result
    LLMService->>API: Formatted response
    API->>Frontend: JSON response
    Frontend->>User: Display answer
```

### Error Handling Strategy

#### Multi-Layer Error Handling
1. **Frontend**: User-friendly error messages and fallbacks
2. **API**: Structured error responses with proper HTTP status codes
3. **Service Layer**: Business logic error handling and logging
4. **Tool Layer**: Specific error handling for Slack API issues

#### Error Types and Responses
```typescript
// Slack API errors
if (error.code === 'not_in_channel') {
  return {
    success: false,
    error: 'Bot needs to be invited to this channel'
  };
}

// LLM provider errors  
if (error.type === 'insufficient_quota') {
  return {
    status: 'error',
    message: 'API quota exceeded. Please try again later.'
  };
}
```

## Security Architecture

### Authentication and Authorization Flow
```mermaid
graph LR
    Client[Client Request] --> Middleware[Auth Middleware]
    Middleware --> Validation[Request Validation]
    Validation --> RateLimit[Rate Limiting]
    RateLimit --> Service[Service Layer]
    Service --> SlackAPI[Slack API<br/>with Bot Token]
```

### Security Layers

#### 1. Transport Security
- **HTTPS Only**: All communication over TLS
- **CORS Policy**: Configured allowed origins
- **Headers**: Security headers via Helmet.js

#### 2. Input Validation
- **Schema Validation**: Zod runtime validation
- **Sanitization**: Input sanitization for XSS prevention
- **Rate Limiting**: Request rate limiting per IP

#### 3. API Security
- **Token Management**: Secure storage of API keys
- **Scope Limiting**: Minimal required permissions
- **Request Signing**: Slack webhook signature verification

## Performance Considerations

### Backend Performance
- **Dependency Injection**: Singleton services for efficiency
- **Connection Pooling**: Reused HTTP connections
- **Caching**: Response caching where appropriate
- **Async Processing**: Non-blocking I/O operations

### Frontend Performance
- **Code Splitting**: Lazy loading of components
- **Bundle Optimization**: Tree shaking and minification
- **Caching**: Aggressive caching of API responses
- **Virtual Scrolling**: Efficient rendering of large message lists

### Monitoring and Observability
- **Health Checks**: Comprehensive health monitoring endpoints
- **Structured Logging**: JSON-formatted logs with correlation IDs
- **Metrics**: Performance metrics and usage tracking
- **Error Tracking**: Comprehensive error logging and reporting

---

*For implementation details, see the [Backend Documentation](../backend/docs/README.md) and [Frontend Documentation](../frontend/docs/README.md)*
