# AGENTS.md - Frontend

## Frontend Architecture Overview

React/TypeScript single-page application built with Vite, using Tailwind CSS and Shadcn/ui components. Provides modern chat interface for interacting with the AI-powered Slack knowledge extraction system.

## 🚨 CRITICAL: Frontend Documentation Requirements

**Before working on frontend code, agents MUST read:**
1. `../docs/PROJECT_OVERVIEW.md` - Overall system understanding
2. `../docs/ARCHITECTURE.md` - High-level architecture patterns
3. `docs/README.md` - Frontend-specific architecture overview  
4. `docs/COMPONENTS.md` - Component architecture and patterns
5. `docs/STATE_MANAGEMENT.md` - State management patterns with TanStack Query
6. `docs/UI_GUIDELINES.md` - UI/UX patterns and design system

**When making changes, agents MUST:**
- Update relevant documentation in `frontend/docs/` folder
- Keep component documentation synchronized with implementations
- Update API integration docs when modifying client code
- Document new UI patterns and accessibility considerations

**Documentation maintenance is mandatory - not optional.**

## Development Commands

```bash
# Frontend-specific development
cd frontend
pnpm install                 # Install frontend dependencies
pnpm run dev                 # Start Vite dev server with hot reload

# Building and type checking  
pnpm run build              # Build for production
pnpm run preview            # Preview production build
pnpm run typecheck          # TypeScript type checking

# Testing
pnpm run test               # Run component and hook tests
pnpm run test:watch         # Run tests in watch mode

# Code quality
pnpm run lint               # ESLint checking
pnpm run lint:fix           # Auto-fix ESLint issues  
pnpm run format             # Prettier formatting
```

## Component Architecture

### Component Patterns
- **Functional Components Only**: No class components, use hooks for state
- **Composition Over Inheritance**: Compose complex UIs from simple components  
- **Props Interface**: Always define TypeScript interfaces for component props
- **Error Boundaries**: Wrap components with error boundaries for fault isolation

### Component Structure
```typescript
interface ComponentProps {
  // Props interface with JSDoc comments
  title: string;
  onAction?: (data: any) => void;
  isLoading?: boolean;
}

export function MyComponent({ title, onAction, isLoading = false }: ComponentProps) {
  // Hooks at top
  const [state, setState] = useState();
  const { data, error } = useQuery();
  
  // Event handlers
  const handleClick = useCallback(() => {
    onAction?.(data);
  }, [data, onAction]);
  
  // Early returns for loading/error states
  if (isLoading) return <LoadingSpinner />;
  if (error) return <ErrorMessage error={error} />;
  
  // Main render
  return (
    <div className="...">
      {/* JSX with proper accessibility */}
    </div>
  );
}
```

### File Naming Conventions
- **Components**: PascalCase with `.tsx` extension (`ChatContainer.tsx`)
- **Hooks**: camelCase starting with `use` (`useChannelsQuery.ts`)
- **Utils**: camelCase with `.ts` extension (`apiClient.ts`)
- **Types**: camelCase with `.ts` extension (`api.ts`, `chat.ts`)

## State Management Patterns

### TanStack Query for Server State
```typescript
// API queries - use for server state
export function useChannelsQuery() {
  return useQuery({
    queryKey: ['channels'],
    queryFn: () => apiClient.getChannels(),
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000,   // 10 minutes
  });
}

// Mutations - use for server state changes
export function useSendMessageMutation() {
  return useMutation({
    mutationFn: (request: ChatRequest) => chatApiClient.sendMessage(request),
    onSuccess: (data) => {
      // Handle success
    },
    onError: (error) => {
      // Handle error
    },
  });
}
```

### React State for Local State
```typescript
// Local component state
const [selectedChannels, setSelectedChannels] = useState<string[]>([]);
const [isModalOpen, setIsModalOpen] = useState(false);

// Persistent local state with localStorage
useEffect(() => {
  const saved = localStorage.getItem('selected-channels');
  if (saved) {
    setSelectedChannels(JSON.parse(saved));
  }
}, []);

useEffect(() => {
  localStorage.setItem('selected-channels', JSON.stringify(selectedChannels));
}, [selectedChannels]);
```

### Global State Strategy
- **Server State**: TanStack Query handles caching, synchronization, background updates
- **Local UI State**: React useState for component-specific state
- **Persistent State**: localStorage for user preferences and session data
- **Avoid**: Global state libraries (Redux, Zustand) - not needed for this app size

## UI and Styling Guidelines

### Tailwind CSS Patterns
```typescript
// Good - semantic class groupings with consistent spacing
<div className="flex items-center justify-between p-4 border-b border-border bg-card">
  <h1 className="text-lg font-semibold text-foreground">Title</h1>
  <Button variant="outline" size="sm">Action</Button>
</div>

// Avoid - random class order and inconsistent spacing  
<div className="bg-card p-2 text-lg border-b flex font-semibold">
```

### Shadcn/ui Component Usage
- **Use Design System**: Prefer Shadcn/ui components over custom implementations
- **Consistent Variants**: Use consistent button, input, and card variants throughout
- **Accessibility**: Components include proper ARIA attributes and keyboard navigation
- **Dark Mode**: Components support dark mode via CSS variables

### Responsive Design Patterns
```typescript
// Mobile-first responsive design
<div className="flex flex-col lg:flex-row">
  <aside className="w-full lg:w-80 border-b lg:border-r lg:border-b-0">
    {/* Sidebar content */}
  </aside>
  <main className="flex-1 min-w-0">
    {/* Main content */}
  </main>
</div>

// Conditional mobile/desktop rendering
<div className="lg:hidden">
  <MobileSidebar />
</div>
<div className="hidden lg:block">
  <DesktopSidebar />
</div>
```

## Error Handling Patterns

### Error Boundaries
```typescript
// Component-level error boundaries
<ErrorBoundary
  fallback={<ErrorFallback message="Failed to load chat" />}
  onError={(error, errorInfo) => {
    console.error('Chat error:', error, errorInfo);
  }}
>
  <ChatContainer />
</ErrorBoundary>
```

### Query Error Handling
```typescript
// Handle errors in queries
const { data, error, isLoading } = useChannelsQuery();

if (error) {
  return (
    <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4">
      <div className="flex items-center gap-2">
        <AlertCircle className="h-4 w-4 text-destructive" />
        <span className="text-destructive">
          {error.message || 'Failed to load channels'}
        </span>
      </div>
    </div>
  );
}
```

### Form Validation
```typescript
// Client-side validation with error display
const [errors, setErrors] = useState<Record<string, string>>({});

const validateInput = (value: string): string | null => {
  if (!value.trim()) return 'Message cannot be empty';
  if (value.length > 1000) return 'Message too long';
  return null;
};

const handleSubmit = (message: string) => {
  const error = validateInput(message);
  if (error) {
    setErrors({ message: error });
    return;
  }
  setErrors({});
  onSubmit(message);
};
```

## API Integration Patterns

### API Client Usage
```typescript
// Use centralized API client
import { apiClient } from '@/lib/api';

// Good - typed API calls with error handling
const channels = await apiClient.getChannels();

// Avoid - direct fetch calls
const response = await fetch('/api/channels');
```

### Request/Response Types
Always define TypeScript types for API interactions:

```typescript
// Request types
interface QueryRequest {
  query: string;
  channels: string[];
  options: {
    includeFiles: boolean;
    includeThreads: boolean;
  };
}

// Response types  
interface QueryResponse {
  response: string;
  metadata: {
    channels: string[];
    tokenUsage: TokenUsage;
    processingTime: number;
  };
}
```

## Development Environment Setup

### Required Tools
- **Node.js 20+**: Runtime environment
- **pnpm 8+**: Package manager (required, not npm/yarn)
- **VS Code**: Recommended editor with extensions:
  - TypeScript and JavaScript Language Features
  - Tailwind CSS IntelliSense
  - ESLint
  - Prettier

### Environment Configuration
```env
# Frontend development uses proxy to backend
VITE_API_BASE_URL=http://localhost:3000  # Backend API URL
```

### Development Server Features
- **Hot Module Replacement**: Instant updates on file changes
- **TypeScript Compilation**: Instant type checking and compilation
- **Proxy Configuration**: `/api/*` requests proxied to backend
- **Error Overlay**: Full-screen error display with stack traces

### Browser DevTools Integration
- **React DevTools**: Component tree inspection and props debugging
- **TanStack Query DevTools**: Query state and cache inspection  
- **Browser Console**: Application logs and error messages
- **Network Tab**: API request/response inspection

## Testing Strategies

### Component Testing
```typescript
// Test component behavior, not implementation
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ChatContainer } from './ChatContainer';

describe('ChatContainer', () => {
  it('should display error message when no channels selected', () => {
    render(
      <QueryClientProvider client={new QueryClient()}>
        <ChatContainer selectedChannels={[]} onSendMessage={jest.fn()} />
      </QueryClientProvider>
    );
    
    expect(screen.getByText(/select at least one channel/i)).toBeInTheDocument();
  });
});
```

### Hook Testing
```typescript
// Test custom hooks
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useChannelsQuery } from './api';

const createWrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={new QueryClient()}>
    {children}
  </QueryClientProvider>
);

describe('useChannelsQuery', () => {
  it('should fetch channels successfully', async () => {
    const { result } = renderHook(() => useChannelsQuery(), { wrapper: createWrapper });
    
    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
      expect(result.current.data).toBeDefined();
    });
  });
});
```

## Performance Optimization

### Bundle Optimization
- **Code Splitting**: Use React.lazy() for route-level splitting
- **Tree Shaking**: Import only used functions from libraries
- **Bundle Analysis**: Use `pnpm run build` and analyze bundle size

### React Performance
```typescript
// Memoization for expensive calculations
const expensiveValue = useMemo(() => {
  return processLargeDataSet(data);
}, [data]);

// Callback memoization to prevent unnecessary re-renders
const handleClick = useCallback((id: string) => {
  onItemClick(id);
}, [onItemClick]);

// Component memoization for pure components
const MemoizedComponent = memo(({ data }: Props) => {
  return <div>{data.title}</div>;
});
```

### Query Optimization
```typescript
// Efficient query configuration
const { data } = useQuery({
  queryKey: ['channels'],
  queryFn: getChannels,
  staleTime: 5 * 60 * 1000,     // Don't refetch for 5 minutes
  gcTime: 30 * 60 * 1000,       // Keep in cache for 30 minutes  
  refetchOnWindowFocus: false,   // Don't refetch on window focus
  refetchOnReconnect: true,      // Do refetch on network reconnect
});
```

## Accessibility Requirements

### WCAG Compliance
- **Keyboard Navigation**: All interactive elements must be keyboard accessible
- **Screen Reader Support**: Proper ARIA labels and semantic HTML
- **Color Contrast**: Minimum 4.5:1 contrast ratio for text
- **Focus Management**: Visible focus indicators and logical tab order

### Implementation Patterns
```typescript
// Good - accessible button with proper ARIA
<button
  onClick={handleClick}
  disabled={isLoading}
  aria-label="Send message"
  aria-describedby="message-help"
>
  {isLoading ? <Spinner aria-hidden="true" /> : 'Send'}
</button>

// Good - accessible form with labels
<label htmlFor="message-input" className="sr-only">
  Enter your message
</label>
<input
  id="message-input"
  type="text"
  aria-describedby="message-error"
  aria-invalid={!!error}
/>
{error && (
  <div id="message-error" role="alert" className="text-destructive">
    {error}
  </div>
)}
```

## Common Frontend Issues

### State Management Problems
```
Error: Cannot update component while rendering another component
```
**Solution**: Move state updates to useEffect or event handlers, not during render

### Query Cache Issues  
```
Data not updating after mutation
```
**Solution**: Invalidate relevant queries after mutations:
```typescript
const queryClient = useQueryClient();
await mutation.mutateAsync(data);
queryClient.invalidateQueries({ queryKey: ['channels'] });
```

### TypeScript Errors
```
Property 'X' does not exist on type 'Y'
```
**Solution**: Define proper TypeScript interfaces and use type assertions carefully

### Build Failures
```
Module not found: Can't resolve '@/components/...'
```
**Solution**: Check path mapping in `vite.config.ts` and ensure imports are correct

### Responsive Design Issues
**Solution**: Test on multiple screen sizes, use mobile-first approach with Tailwind CSS

## Production Build Notes

### Build Process
1. TypeScript compilation with type checking
2. Vite bundling with optimization and minification  
3. Static asset processing and hashing
4. Bundle analysis and size optimization

### Environment Requirements
- All environment variables validated at build time
- API endpoints properly configured for production
- Static assets served with proper caching headers
- Error boundaries configured for production error handling

### Performance Targets
- **First Contentful Paint**: < 2 seconds
- **Time to Interactive**: < 3 seconds  
- **Bundle Size**: < 500KB gzipped
- **Lighthouse Score**: > 90 for Performance, Accessibility, Best Practices
