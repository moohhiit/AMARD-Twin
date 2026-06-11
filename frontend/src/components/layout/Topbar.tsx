import { useEffect, useState } from 'react';
import { Wifi, Clock, Bell, AlertTriangle } from 'lucide-react';
import { useNetworkStore } from '@/store';
import { useHealthCheckQuery } from '@/hooks/useNetworkState';
import { useRealtimeConnection } from '@/hooks/useRealtimeUpdates';
import { useEventStore } from '@/store';
import { getWebSocketService } from '@/services/websocket';
import { motion, AnimatePresence } from 'framer-motion';

export function Topbar() {
  const [currentTime, setCurrentTime] = useState(new Date());
  const wsConnected = useNetworkStore((s) => s.wsConnected);
  const setWsConnected = useNetworkStore((s) => s.setWsConnected);
  const unreadCount = useEventStore((s) => s.unreadCount);
  const markAllRead = useEventStore((s) => s.markAllRead);

  useRealtimeConnection(setWsConnected);

  const { data: health } = useHealthCheckQuery();

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const statusColor =
    health?.status === 'healthy'
      ? 'text-emerald-400'
      : health?.status === 'degraded'
        ? 'text-amber-400'
        : 'text-red-400';

  const StatusIcon =
    health?.status === 'healthy'
      ? () => <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
      : AlertTriangle;

  return (
    <header
      className="fixed top-0 right-0 h-14 bg-rail-panel/80 backdrop-blur-md border-b border-rail-border z-30 flex items-center justify-between px-4"
      style={{ left: 220 }}
    >
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <StatusIcon className="w-3.5 h-3.5 text-amber-400" />
          <span className={`text-xs font-medium ${statusColor} uppercase tracking-wider`}>
            {health?.status || 'checking'}
          </span>
        </div>
        <div className="flex items-center gap-1.5 text-rail-text-dim">
          <Wifi className={wsConnected ? 'w-3.5 h-3.5 text-emerald-400' : 'w-3.5 h-3.5 text-red-400'} />
          <span className="text-xs">
            {wsConnected ? 'LIVE' : 'OFFLINE'}
          </span>
          {!wsConnected && (
            <button
              onClick={() => getWebSocketService()}
              className="text-[10px] text-rail-active hover:underline ml-1"
            >
              Retry
            </button>
          )}
        </div>
        {health && (
          <div className="hidden md:flex items-center gap-3 text-rail-text-dim text-xs">
            <span>WS Clients: {health.websocket_clients}</span>
            <span>Queue: {health.event_queue_size}</span>
          </div>
        )}
      </div>

      <div className="flex items-center gap-4">
        <div className="flex items-center gap-1.5 text-rail-text-muted">
          <Clock className="w-3.5 h-3.5" />
          <span className="text-xs font-mono">
            {currentTime.toLocaleTimeString('en-IN', { hour12: false })}
          </span>
          <span className="text-xs text-rail-text-dim">
            {currentTime.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
          </span>
        </div>

        <button
          onClick={markAllRead}
          className="relative p-1.5 rounded-md hover:bg-rail-surface transition-colors"
        >
          <Bell className="w-4 h-4 text-rail-text-muted" />
          <AnimatePresence>
            {unreadCount > 0 && (
              <motion.span
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0 }}
                className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-red-400 text-[9px] font-bold text-white flex items-center justify-center"
              >
                {unreadCount > 9 ? '9+' : unreadCount}
              </motion.span>
            )}
          </AnimatePresence>
        </button>
      </div>
    </header>
  );
}
