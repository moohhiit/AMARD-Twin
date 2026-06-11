import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEffect } from 'react';
import { useNetworkStore } from '@/store';
import { getWebSocketService } from '@/services/websocket';
import { Toaster } from '@/components/ui/sonner';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 2,
      staleTime: 5000,
    },
  },
});

export function AppShell() {
  const setWsConnected = useNetworkStore((s) => s.setWsConnected);

  useEffect(() => {
    const ws = getWebSocketService();
    const unsub = ws.onConnectionChange(setWsConnected);
    ws.subscribe(['all']);
    return () => {
      unsub();
    };
  }, [setWsConnected]);

  return (
    <QueryClientProvider client={queryClient}>
      <div className="min-h-screen bg-rail-dark">
        <Sidebar />
        <Topbar />
        <main
          className="pt-14 min-h-screen"
          style={{ marginLeft: 220 }}
        >
          <div className="p-4">
            <Outlet />
          </div>
        </main>
        <Toaster 
          position="bottom-right" 
          toastOptions={{
            style: {
              background: '#111827',
              border: '1px solid #2a3550',
              color: '#e2e8f0',
            },
          }}
        />
      </div>
    </QueryClientProvider>
  );
}
