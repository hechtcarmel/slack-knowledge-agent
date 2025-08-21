import { useHealthQuery } from '@/hooks/api';
import { AlertCircle, CheckCircle, Loader2 } from 'lucide-react';
import { ThemeToggle } from '@/components/theme-toggle';

interface LayoutProps {
  children: React.ReactNode;
}

function StatusIndicator() {
  const { data: health, isLoading } = useHealthQuery();

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span>Checking status...</span>
      </div>
    );
  }

  const isHealthy = health?.status === 'healthy';
  const slackConnected = health?.services.slack.status === 'connected';
  const llmConnected = health?.services.llm.status === 'connected';

  return (
    <div className="flex items-center gap-4 text-sm">
      <div className="flex items-center gap-1">
        {isHealthy ? (
          <CheckCircle className="h-4 w-4 text-green-600" />
        ) : (
          <AlertCircle className="h-4 w-4 text-red-600" />
        )}
        <span className={isHealthy ? 'text-green-600' : 'text-red-600'}>
          System {isHealthy ? 'Healthy' : 'Unhealthy'}
        </span>
      </div>

      <div className="flex items-center gap-1">
        <div 
          className={`w-2 h-2 rounded-full ${
            slackConnected ? 'bg-green-500' : 'bg-red-500'
          }`} 
        />
        <span className="text-muted-foreground">Slack</span>
      </div>

      <div className="flex items-center gap-1">
        <div 
          className={`w-2 h-2 rounded-full ${
            llmConnected ? 'bg-green-500' : 'bg-red-500'
          }`} 
        />
        <span className="text-muted-foreground">
          {health?.services?.llm?.provider || 'LLM'}
        </span>
      </div>
    </div>
  );
}

export function Layout({ children }: LayoutProps) {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">Slack Knowledge Agent</h1>
              <p className="text-sm text-muted-foreground">
                AI-powered knowledge extraction from your Slack workspace
              </p>
            </div>
            <div className="flex items-center gap-4">
              <StatusIndicator />
              <ThemeToggle />
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {children}
      </main>

      <footer className="border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 mt-auto">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <p>© 2025 Slack Knowledge Agent</p>
            <p>Powered by AI</p>
          </div>
        </div>
      </footer>
    </div>
  );
}