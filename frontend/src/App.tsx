import { useState } from 'react';
import { Layout } from '@/components/Layout';
import { ChannelSelector } from '@/components/ChannelSelector';
import { QueryInput } from '@/components/QueryInput';
import { ResponseDisplay } from '@/components/ResponseDisplay';
import { useSubmitQueryMutation } from '@/hooks/api';
import { QueryResponse } from '@/types/api';
import { AlertCircle } from 'lucide-react';

interface QueryOptions {
  includeFiles: boolean;
  includeThreads: boolean;
  dateRange?: {
    start?: string;
    end?: string;
  };
}

function App() {
  const [selectedChannels, setSelectedChannels] = useState<string[]>([]);
  const [query, setQuery] = useState('');
  const [currentResponse, setCurrentResponse] = useState<{
    response: QueryResponse;
    query: string;
  } | null>(null);

  const submitQueryMutation = useSubmitQueryMutation();

  const handleSubmitQuery = async (queryText: string, options: QueryOptions) => {
    if (selectedChannels.length === 0) {
      alert('Please select at least one channel to search');
      return;
    }

    const queryRequest = {
      query: queryText,
      channels: selectedChannels,
      context: {
        includeFiles: options.includeFiles,
        includeThreads: options.includeThreads,
        dateRange: options.dateRange,
      },
    };

    try {
      const response = await submitQueryMutation.mutateAsync(queryRequest);
      setCurrentResponse({
        response,
        query: queryText,
      });
    } catch (error) {
      console.error('Failed to submit query:', error);
      // Error handling is already done by the mutation
    }
  };

  const handleNewQuery = () => {
    setCurrentResponse(null);
    setQuery('');
  };

  return (
    <Layout>
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Error Display */}
        {submitQueryMutation.error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-red-600 mt-0.5 flex-shrink-0" />
            <div>
              <h3 className="font-medium text-red-800">Query Failed</h3>
              <p className="text-red-700 text-sm mt-1">
                {submitQueryMutation.error.message}
              </p>
            </div>
          </div>
        )}

        {/* Welcome Message - Show when no response */}
        {!currentResponse && !submitQueryMutation.isPending && (
          <div className="text-center py-12 animate-fade-in">
            <h2 className="text-3xl font-bold mb-4 bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
              Welcome to Slack Knowledge Agent
            </h2>
            <p className="text-muted-foreground text-lg mb-8">
              AI-powered knowledge extraction from your Slack workspace
            </p>
            <div className="max-w-2xl mx-auto text-left">
              <h3 className="font-semibold mb-3">How to get started:</h3>
              <ol className="space-y-2 text-muted-foreground">
                {[
                  'Select the channels you want to search from',
                  'Enter your question in the query box', 
                  'Configure search options (files, threads, date range)',
                  'Submit your query and get AI-powered insights'
                ].map((step, index) => (
                  <li key={index} className="flex items-start gap-3 animate-slide-up" style={{animationDelay: `${index * 100}ms`}}>
                    <span className="flex-shrink-0 w-6 h-6 bg-primary/10 text-primary rounded-full text-sm flex items-center justify-center font-medium mt-0.5">
                      {index + 1}
                    </span>
                    <span>{step}</span>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        )}

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Channel Selection */}
          <div className="lg:col-span-1">
            <ChannelSelector
              selectedChannels={selectedChannels}
              onSelectionChange={setSelectedChannels}
            />
          </div>

          {/* Right Column - Query and Response */}
          <div className="lg:col-span-2 space-y-6">
            {/* Query Input - Always Visible */}
            <QueryInput
              query={query}
              onQueryChange={setQuery}
              onSubmit={handleSubmitQuery}
              isLoading={submitQueryMutation.isPending}
              disabled={selectedChannels.length === 0}
            />

            {/* Show Response or Loading */}
            {submitQueryMutation.isPending && (
              <div className="text-center py-12 space-y-6">
                <div className="flex flex-col items-center space-y-4">
                  <div className="relative">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
                    <div className="absolute inset-0 rounded-full border-2 border-primary/20"></div>
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-lg font-semibold">Searching your Slack workspace...</h3>
                    <p className="text-muted-foreground">
                      Analyzing {selectedChannels.length} channel{selectedChannels.length !== 1 ? 's' : ''}
                    </p>
                  </div>
                </div>
                
                {/* Loading skeleton for response */}
                <div className="space-y-4 max-w-2xl mx-auto">
                  <div className="h-4 bg-muted rounded animate-pulse"></div>
                  <div className="h-4 bg-muted rounded animate-pulse w-3/4"></div>
                  <div className="h-4 bg-muted rounded animate-pulse w-1/2"></div>
                </div>
              </div>
            )}

            {/* Response Display */}
            {currentResponse && !submitQueryMutation.isPending && (
              <div className="space-y-4 animate-slide-up">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold">Query Results</h3>
                  <button
                    onClick={handleNewQuery}
                    className="text-sm text-muted-foreground hover:text-foreground underline transition-colors hover:scale-105"
                  >
                    Ask another question
                  </button>
                </div>
                <div className="animate-scale-in">
                  <ResponseDisplay
                    response={currentResponse.response}
                    query={currentResponse.query}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}

export default App;