import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ErrorStateProps {
  message?: string;
  onRetry?: () => void;
  fullPage?: boolean;
}

export function ErrorState({ message = 'Failed to load data', onRetry, fullPage = false }: ErrorStateProps) {
  const content = (
    <div className="flex flex-col items-center justify-center gap-3 py-12">
      <AlertTriangle className="w-8 h-8 text-signal-red" />
      <p className="text-sm text-rail-text-muted">{message}</p>
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry} className="mt-2">
          <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
          Retry
        </Button>
      )}
    </div>
  );

  if (fullPage) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        {content}
      </div>
    );
  }

  return content;
}
