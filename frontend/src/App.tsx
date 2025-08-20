function App() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto px-4 py-4">
          <h1 className="text-2xl font-bold">Slack Knowledge Agent</h1>
        </div>
      </header>
      
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold mb-2">Welcome to Slack Knowledge Agent</h2>
            <p className="text-muted-foreground">
              AI-powered knowledge extraction from your Slack workspace
            </p>
          </div>
          
          <div className="bg-card border rounded-lg p-6">
            <p className="text-center text-muted-foreground">
              Frontend is ready! The backend API is available at <code>/api</code>
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;