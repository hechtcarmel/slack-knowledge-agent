import { useHealthQuery } from '@/hooks/api';
import { AlertCircle, CheckCircle, Loader2 } from 'lucide-react';

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
          <CheckCircle className="h-4 w-4 text-success" />
        ) : (
          <AlertCircle className="h-4 w-4 text-destructive" />
        )}
        <span className={isHealthy ? 'text-success font-medium' : 'text-destructive font-medium'}>
          System {isHealthy ? 'Healthy' : 'Unhealthy'}
        </span>
      </div>

      <div className="flex items-center gap-1">
        <div 
          className={`w-2 h-2 rounded-full ${
            slackConnected ? 'bg-success' : 'bg-destructive'
          }`} 
        />
        <span className="text-muted-foreground">Slack</span>
      </div>

      <div className="flex items-center gap-1">
        <div 
          className={`w-2 h-2 rounded-full ${
            llmConnected ? 'bg-success' : 'bg-destructive'
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
      <header className="border-b bg-background-solid/95 backdrop-blur supports-[backdrop-filter]:bg-background-solid/60 shadow-lg">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gradient-primary">Slack Knowledge Agent</h1>
              <p className="text-sm text-muted-foreground mt-1">
                AI-powered knowledge extraction from your Slack workspace
              </p>
            </div>
            <div className="flex items-center gap-4">
              <StatusIndicator />
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {children}
      </main>

      <footer className="border-t bg-background-solid/95 backdrop-blur supports-[backdrop-filter]:bg-background-solid/60 mt-auto">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <p>© 2025 Slack Knowledge Agent</p>
            <p className="text-gradient-primary font-medium">Powered by AI ✨</p>
          </div>
        </div>
      </footer>
    </div>
  );
}