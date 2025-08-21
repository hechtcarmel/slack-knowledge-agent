import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { AlertTriangle } from 'lucide-react';

/**
 * Test component to trigger errors for testing the ErrorBoundary
 * Should only be used in development
 */
export function ErrorTestButton() {
  const [shouldThrow, setShouldThrow] = useState(false);

  if (process.env.NODE_ENV !== 'development') {
    return null;
  }

  const throwError = () => {
    setShouldThrow(true);
  };

  const throwAsyncError = () => {
    setTimeout(() => {
      throw new Error('Test async error from ErrorTestButton');
    }, 100);
  };

  if (shouldThrow) {
    throw new Error('Test error from ErrorTestButton - This is intentional for testing!');
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 space-y-2">
      <Button
        onClick={throwError}
        variant="destructive"
        size="sm"
        className="opacity-50 hover:opacity-100"
      >
        <AlertTriangle className="h-4 w-4 mr-2" />
        Test Error
      </Button>
      <Button
        onClick={throwAsyncError}
        variant="outline"
        size="sm"
        className="opacity-50 hover:opacity-100"
      >
        <AlertTriangle className="h-4 w-4 mr-2" />
        Test Async
      </Button>
    </div>
  );
}
