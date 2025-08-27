# UI Guidelines

This document outlines the user interface design guidelines and patterns for the Slack Knowledge Agent frontend application.

## Design System Overview

The application uses a modern, accessible design system built on:

- **Shadcn/ui**: High-quality, accessible component library
- **Tailwind CSS**: Utility-first CSS framework
- **Radix UI**: Unstyled, accessible UI primitives
- **Lucide React**: Beautiful, consistent icon library

## Color System

### Color Palette

The application uses CSS variables for theming, supporting both light and dark modes:

```css
:root {
  /* Light mode colors */
  --background: 0 0% 100%;
  --foreground: 222.2 84% 4.9%;
  --card: 0 0% 100%;
  --card-foreground: 222.2 84% 4.9%;
  --primary: 222.2 47.4% 11.2%;
  --primary-foreground: 210 40% 98%;
  --secondary: 210 40% 96%;
  --secondary-foreground: 222.2 84% 4.9%;
  --muted: 210 40% 96%;
  --muted-foreground: 215.4 16.3% 46.9%;
  --accent: 210 40% 96%;
  --accent-foreground: 222.2 84% 4.9%;
  --destructive: 0 84.2% 60.2%;
  --destructive-foreground: 210 40% 98%;
  --border: 214.3 31.8% 91.4%;
  --input: 214.3 31.8% 91.4%;
  --ring: 222.2 84% 4.9%;
}

.dark {
  /* Dark mode colors */
  --background: 222.2 84% 4.9%;
  --foreground: 210 40% 98%;
  /* ... */
}
```

### Usage Guidelines

```typescript
// ✅ Use semantic color classes
<div className="bg-background text-foreground">
  <Card className="bg-card text-card-foreground">
    <Button className="bg-primary text-primary-foreground">
      Primary Action
    </Button>
  </Card>
</div>

// ❌ Avoid hardcoded colors
<div className="bg-white text-black">
  <div className="bg-gray-100">
    <button className="bg-blue-500 text-white">
      Action
    </button>
  </div>
</div>
```

### Color Meanings

| Color | Usage | Example |
|-------|--------|---------|
| `primary` | Main brand actions | Send button, selected states |
| `secondary` | Secondary actions | Cancel button, alternative actions |
| `destructive` | Dangerous actions | Delete, error states |
| `muted` | Less important content | Helper text, placeholders |
| `accent` | Highlights, hover states | Hover backgrounds, focus states |

## Typography

### Font System

```css
/* Primary font stack */
.font-sans {
  font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", sans-serif;
}

/* Monospace for code */
.font-mono {
  font-family: ui-monospace, SFMono-Regular, "SF Mono", Consolas, "Liberation Mono", Menlo, monospace;
}
```

### Typography Scale

| Class | Size | Usage |
|-------|------|-------|
| `text-xs` | 12px | Small labels, timestamps |
| `text-sm` | 14px | Body text, descriptions |
| `text-base` | 16px | Primary body text |
| `text-lg` | 18px | Emphasized text |
| `text-xl` | 20px | Small headings |
| `text-2xl` | 24px | Page headings |
| `text-3xl` | 30px | Section headings |

### Typography Usage

```typescript
function MessageDisplay({ message }: { message: ChatMessage }) {
  return (
    <div className="space-y-2">
      {/* Main content - readable body text */}
      <div className="text-base leading-relaxed">
        {message.content}
      </div>
      
      {/* Metadata - smaller, muted text */}
      <div className="text-sm text-muted-foreground">
        {message.timestamp} • {message.author}
      </div>
      
      {/* Code blocks - monospace font */}
      <pre className="font-mono text-sm bg-muted p-3 rounded">
        {message.code}
      </pre>
    </div>
  );
}
```

## Layout Patterns

### Container Patterns

```typescript
// Page container - consistent margins and max width
<div className="container mx-auto px-4 py-8">
  <h1 className="text-2xl font-bold mb-6">Page Title</h1>
  <div className="space-y-6">
    {/* Content */}
  </div>
</div>

// Card container - grouped content with padding
<Card className="p-6">
  <CardHeader>
    <CardTitle>Section Title</CardTitle>
  </CardHeader>
  <CardContent className="space-y-4">
    {/* Card content */}
  </CardContent>
</Card>

// Flex layouts - responsive direction changes
<div className="flex flex-col lg:flex-row gap-6">
  <aside className="lg:w-80">Sidebar</aside>
  <main className="flex-1">Main Content</main>
</div>
```

### Spacing System

Use consistent spacing throughout the application:

| Class | Size | Usage |
|-------|------|-------|
| `space-y-1` | 4px | Tight vertical spacing |
| `space-y-2` | 8px | Close related items |
| `space-y-4` | 16px | Standard vertical spacing |
| `space-y-6` | 24px | Section spacing |
| `space-y-8` | 32px | Large section spacing |
| `gap-2` | 8px | Flex/grid item spacing |
| `gap-4` | 16px | Standard gap |
| `p-4` | 16px | Standard padding |
| `p-6` | 24px | Large padding |

## Component Guidelines

### Button Design

```typescript
// Primary actions - high emphasis
<Button variant="default" size="default">
  Send Message
</Button>

// Secondary actions - medium emphasis  
<Button variant="outline" size="default">
  Cancel
</Button>

// Destructive actions - danger indication
<Button variant="destructive" size="default">
  Delete
</Button>

// Ghost actions - minimal emphasis
<Button variant="ghost" size="sm">
  <MoreHorizontal className="h-4 w-4" />
</Button>

// Loading states
<Button disabled>
  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
  Please wait
</Button>
```

### Input Design

```typescript
function SearchInput() {
  const [query, setQuery] = useState('');
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="space-y-2">
      <Label htmlFor="search" className="text-sm font-medium">
        Search channels
      </Label>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          id="search"
          type="text"
          placeholder="Type to search..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className={cn(
            "pl-9",
            error && "border-destructive"
          )}
          aria-invalid={!!error}
          aria-describedby={error ? "search-error" : undefined}
        />
      </div>
      {error && (
        <p id="search-error" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
```

### Card Design

```typescript
function ChannelCard({ channel, isSelected, onSelect }: ChannelCardProps) {
  return (
    <Card 
      className={cn(
        "cursor-pointer transition-all duration-200 hover:shadow-md",
        isSelected 
          ? "border-primary bg-accent/50" 
          : "hover:border-accent-foreground/20"
      )}
      onClick={onSelect}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <h3 className="font-medium truncate">
              #{channel.name}
            </h3>
            <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
              {channel.description || 'No description'}
            </p>
          </div>
          {isSelected && (
            <Check className="h-5 w-5 text-primary flex-shrink-0 ml-2" />
          )}
        </div>
        
        <div className="flex items-center justify-between mt-3 text-xs text-muted-foreground">
          <span>{channel.memberCount} members</span>
          <span>{formatDate(channel.lastActivity)}</span>
        </div>
      </CardContent>
    </Card>
  );
}
```

## Responsive Design

### Breakpoint System

```css
/* Tailwind breakpoints */
sm: 640px   /* Small devices (tablets) */
md: 768px   /* Medium devices (small laptops) */
lg: 1024px  /* Large devices (laptops) */
xl: 1280px  /* Extra large devices (desktops) */
2xl: 1536px /* 2X large devices (large desktops) */
```

### Mobile-First Approach

```typescript
function ResponsiveLayout() {
  return (
    <div className="min-h-screen bg-background">
      {/* Mobile: full-width, stacked layout */}
      <div className="flex flex-col lg:flex-row">
        
        {/* Sidebar: mobile sheet, desktop fixed */}
        <div className="lg:w-80">
          {/* Mobile */}
          <div className="lg:hidden">
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="ghost" size="sm">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left">
                <Sidebar />
              </SheetContent>
            </Sheet>
          </div>
          
          {/* Desktop */}
          <div className="hidden lg:block h-full border-r">
            <Sidebar />
          </div>
        </div>

        {/* Main content: responsive padding */}
        <main className="flex-1 p-4 lg:p-6">
          <MainContent />
        </main>
      </div>
    </div>
  );
}
```

### Touch-Friendly Design

```typescript
// Ensure tap targets are at least 44px
<button className="min-h-[44px] min-w-[44px] touch-manipulation">
  <Icon className="h-5 w-5" />
</button>

// Increase spacing on mobile for easier touch interaction
<div className="space-y-3 md:space-y-2">
  {items.map(item => (
    <TouchTarget key={item.id} item={item} />
  ))}
</div>
```

## Animation and Transitions

### Transition Guidelines

```typescript
// Smooth, purposeful animations
<div className="transition-all duration-200 ease-out hover:shadow-lg">
  Content
</div>

// Loading states with gentle animation
<div className="animate-pulse bg-muted rounded h-4 w-3/4" />

// Entrance animations for new content
<div className="animate-in slide-in-from-bottom-4 duration-300">
  New message
</div>

// Focus indicators
<input className="focus:ring-2 focus:ring-primary focus:ring-offset-2 transition-shadow" />
```

### Loading States

```typescript
// Skeleton loading for content
function ChannelListSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="animate-pulse">
          <div className="flex items-center space-x-4">
            <div className="rounded-full bg-muted h-10 w-10" />
            <div className="space-y-2 flex-1">
              <div className="h-4 bg-muted rounded w-3/4" />
              <div className="h-3 bg-muted rounded w-1/2" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// Spinner for actions
<Button disabled>
  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
  Sending...
</Button>
```

## Accessibility Guidelines

### Focus Management

```typescript
// Visible focus indicators
<button className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2">
  Action
</button>

// Skip links for keyboard navigation
<a 
  href="#main-content" 
  className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 bg-primary text-primary-foreground px-4 py-2 rounded"
>
  Skip to main content
</a>
```

### Semantic HTML

```typescript
// Use proper heading hierarchy
<main>
  <h1>Application Title</h1>
  <section>
    <h2>Channel Selection</h2>
    <div role="group" aria-labelledby="channels-heading">
      <h3 id="channels-heading" className="sr-only">Available Channels</h3>
      {/* Channel list */}
    </div>
  </section>
</main>

// Meaningful link text
<Link to="/settings" className="text-primary hover:underline">
  Go to settings <span className="sr-only">page</span>
</Link>
```

### ARIA Labels and Descriptions

```typescript
function ChatInput() {
  const [message, setMessage] = useState('');
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="space-y-2">
      <Label htmlFor="message-input" className="sr-only">
        Enter your message
      </Label>
      <textarea
        id="message-input"
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder="Type your message..."
        aria-describedby={error ? "message-error" : "message-help"}
        aria-invalid={!!error}
        className="w-full min-h-[100px] resize-none"
      />
      <div id="message-help" className="text-sm text-muted-foreground">
        Press Ctrl+Enter to send
      </div>
      {error && (
        <div id="message-error" role="alert" className="text-sm text-destructive">
          {error}
        </div>
      )}
    </div>
  );
}
```

## Dark Mode Support

### Implementation

```typescript
// Theme provider setup
function ThemeProvider({ children }: { children: React.ReactNode }) {
  const theme = useSettingsStore((state) => state.theme);
  const effectiveTheme = useEffectiveTheme();

  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove('light', 'dark');
    root.classList.add(effectiveTheme);
  }, [effectiveTheme]);

  return <>{children}</>;
}

// Theme-aware components
function ThemedCard() {
  return (
    <Card className="bg-card border-border">
      <CardContent className="text-card-foreground">
        Content adapts to theme automatically
      </CardContent>
    </Card>
  );
}
```

### Theme Toggle

```typescript
function ThemeToggle() {
  const theme = useSettingsStore((state) => state.theme);
  const updateTheme = useSettingsStore((state) => state.updateTheme);

  const handleThemeChange = () => {
    const nextTheme = theme === 'light' ? 'dark' : theme === 'dark' ? 'system' : 'light';
    updateTheme(nextTheme);
  };

  const ThemeIcon = theme === 'light' ? Sun : theme === 'dark' ? Moon : Monitor;

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={handleThemeChange}
      aria-label={`Switch to ${theme === 'light' ? 'dark' : theme === 'dark' ? 'system' : 'light'} theme`}
    >
      <ThemeIcon className="h-4 w-4" />
    </Button>
  );
}
```

## Error State Design

### Error Messages

```typescript
function ErrorDisplay({ error, onRetry, onDismiss }: ErrorDisplayProps) {
  return (
    <div className="rounded-lg border border-destructive/20 bg-destructive/10 p-4">
      <div className="flex items-start gap-3">
        <AlertCircle className="h-5 w-5 text-destructive mt-0.5 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <h3 className="font-medium text-destructive">
            Something went wrong
          </h3>
          <p className="mt-1 text-sm text-destructive/80">
            {error.message || 'An unexpected error occurred.'}
          </p>
          {onRetry && (
            <div className="mt-3 flex gap-2">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={onRetry}
                className="border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground"
              >
                Try Again
              </Button>
              {onDismiss && (
                <Button variant="ghost" size="sm" onClick={onDismiss}>
                  Dismiss
                </Button>
              )}
            </div>
          )}
        </div>
        {onDismiss && !onRetry && (
          <Button variant="ghost" size="sm" onClick={onDismiss}>
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
}
```

### Empty States

```typescript
function EmptyChannelList() {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="rounded-full bg-muted p-6 mb-4">
        <Hash className="h-8 w-8 text-muted-foreground" />
      </div>
      <h3 className="font-medium text-lg mb-2">No channels found</h3>
      <p className="text-muted-foreground mb-6 max-w-sm">
        It looks like there are no channels available. Make sure the bot has been invited to the channels you want to search.
      </p>
      <Button variant="outline" onClick={onRefresh}>
        <RefreshCw className="mr-2 h-4 w-4" />
        Refresh Channels
      </Button>
    </div>
  );
}
```

## Icon Usage

### Icon Guidelines

```typescript
// Consistent sizing
const iconSizes = {
  xs: 'h-3 w-3',    // 12px - Very small icons
  sm: 'h-4 w-4',    // 16px - Standard small icons
  md: 'h-5 w-5',    // 20px - Medium icons
  lg: 'h-6 w-6',    // 24px - Large icons
  xl: 'h-8 w-8',    // 32px - Extra large icons
};

// Usage examples
<Button>
  <Send className="mr-2 h-4 w-4" />
  Send Message
</Button>

<div className="flex items-center gap-2">
  <Hash className="h-4 w-4 text-muted-foreground" />
  <span>channel-name</span>
</div>

// Decorative icons should be hidden from screen readers
<MessageCircle className="h-8 w-8 text-primary" aria-hidden="true" />
```

### Icon Meanings

| Icon | Meaning | Usage |
|------|---------|-------|
| `Send` | Submit, send action | Send message button |
| `Search` | Search functionality | Search inputs |
| `Settings` | Configuration | Settings pages, gear icon |
| `Hash` | Channel indicator | Channel names, lists |
| `User` | User/person | User profiles, avatars |
| `Calendar` | Date/time | Timestamps, scheduling |
| `Check` | Success, selected | Confirmation, selection state |
| `X` | Close, cancel | Close modals, remove items |
| `AlertCircle` | Warning, error | Error messages, alerts |
| `Info` | Information | Help text, informational |

## Performance Considerations

### Image Optimization

```typescript
// Use appropriate image sizes
<img 
  src={avatarUrl}
  alt={`${user.name} avatar`}
  className="h-8 w-8 rounded-full object-cover"
  loading="lazy"
  width={32}
  height={32}
/>

// Skeleton loading for images
const [imageLoaded, setImageLoaded] = useState(false);

<div className="relative">
  {!imageLoaded && (
    <div className="absolute inset-0 bg-muted animate-pulse rounded" />
  )}
  <img 
    src={src}
    alt={alt}
    onLoad={() => setImageLoaded(true)}
    className={cn("transition-opacity", imageLoaded ? "opacity-100" : "opacity-0")}
  />
</div>
```

### CSS Optimization

```typescript
// Use CSS custom properties for consistent spacing
<div 
  className="space-y-4 p-6" 
  style={{ '--space-y': '1rem', '--padding': '1.5rem' }}
>
  Content
</div>

// Avoid expensive CSS operations
// ✅ Good - use transform instead of changing layout properties
<div className="transform transition-transform hover:scale-105">

// ❌ Avoid - causes layout recalculation
<div className="transition-all hover:w-64 hover:h-64">
```

## Testing Guidelines

### Visual Testing

```typescript
// Test different states
describe('Button Component', () => {
  it('renders all variants correctly', () => {
    render(
      <div className="space-y-2">
        <Button variant="default">Default</Button>
        <Button variant="outline">Outline</Button>
        <Button variant="ghost">Ghost</Button>
        <Button variant="destructive">Destructive</Button>
      </div>
    );

    expect(screen.getByRole('button', { name: /default/i })).toHaveClass('bg-primary');
    expect(screen.getByRole('button', { name: /outline/i })).toHaveClass('border-input');
  });

  it('handles loading state correctly', () => {
    render(<Button disabled>Loading...</Button>);
    
    expect(screen.getByRole('button')).toBeDisabled();
    expect(screen.getByRole('button')).toHaveAttribute('aria-disabled', 'true');
  });
});
```

### Accessibility Testing

```typescript
// Test keyboard navigation
it('supports keyboard navigation', async () => {
  render(<ChannelSelector channels={mockChannels} />);
  
  const user = userEvent.setup();
  
  // Tab to first channel
  await user.tab();
  expect(screen.getAllByRole('checkbox')[0]).toHaveFocus();
  
  // Arrow down to next channel
  await user.keyboard('[ArrowDown]');
  expect(screen.getAllByRole('checkbox')[1]).toHaveFocus();
  
  // Space to select
  await user.keyboard('[Space]');
  expect(screen.getAllByRole('checkbox')[1]).toBeChecked();
});
```

---

These UI guidelines provide a comprehensive foundation for building consistent, accessible, and user-friendly interfaces in the Slack Knowledge Agent application. Always refer to the Shadcn/ui documentation and Tailwind CSS documentation for the most up-to-date implementation details.