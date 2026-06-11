import { motion } from 'framer-motion';
import { Activity, Server, Radio, Cpu, HardDrive } from 'lucide-react';
import { useHealthCheckQuery } from '@/hooks/useNetworkState';
import { useNetworkStore } from '@/store';
import { LoadingState } from '@/components/shared/LoadingState';
import { ErrorState } from '@/components/shared/ErrorState';

export function NetworkHealth() {
  const { data: health, isLoading, error, refetch } = useHealthCheckQuery();
  const wsConnected = useNetworkStore((s) => s.wsConnected);

  if (isLoading) return <LoadingState message="Checking health..." />;
  if (error) return <ErrorState message="Health check failed" onRetry={refetch} />;
  if (!health) return null;

  const items = [
    {
      label: 'System Status',
      value: health.status.toUpperCase(),
      icon: Activity,
      color: health.status === 'healthy' ? 'text-emerald-400' : health.status === 'degraded' ? 'text-amber-400' : 'text-red-400',
      bg: health.status === 'healthy' ? 'bg-emerald-400/10' : health.status === 'degraded' ? 'bg-amber-400/10' : 'bg-red-400/10',
    },
    {
      label: 'Neo4j Database',
      value: health.neo4j_connected ? 'CONNECTED' : 'DISCONNECTED',
      icon: Server,
      color: health.neo4j_connected ? 'text-emerald-400' : 'text-red-400',
      bg: health.neo4j_connected ? 'bg-emerald-400/10' : 'bg-red-400/10',
    },
    {
      label: 'Event Bus',
      value: health.event_bus_running ? 'RUNNING' : 'STOPPED',
      icon: Radio,
      color: health.event_bus_running ? 'text-emerald-400' : 'text-red-400',
      bg: health.event_bus_running ? 'bg-emerald-400/10' : 'bg-red-400/10',
    },
    {
      label: 'WebSocket',
      value: wsConnected ? 'CONNECTED' : 'DISCONNECTED',
      icon: Radio,
      color: wsConnected ? 'text-emerald-400' : 'text-red-400',
      bg: wsConnected ? 'bg-emerald-400/10' : 'bg-red-400/10',
    },
    {
      label: 'WS Clients',
      value: String(health.websocket_clients),
      icon: Cpu,
      color: 'text-blue-400',
      bg: 'bg-blue-400/10',
    },
    {
      label: 'Event Queue',
      value: String(health.event_queue_size),
      icon: HardDrive,
      color: health.event_queue_size > 100 ? 'text-amber-400' : 'text-emerald-400',
      bg: health.event_queue_size > 100 ? 'bg-amber-400/10' : 'bg-emerald-400/10',
    },
  ];

  return (
    <div className="control-panel">
      <div className="control-panel-header">
        <span className="control-panel-title">System Health</span>
        <span className="text-[10px] font-mono text-rail-text-dim">v{health.version}</span>
      </div>
      <div className="control-panel-body space-y-2">
        {items.map((item, index) => (
          <motion.div
            key={item.label}
            initial={{ opacity: 0, x: -4 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.05 }}
            className="flex items-center justify-between py-1.5 px-2 rounded-md hover:bg-rail-surface transition-colors"
          >
            <div className="flex items-center gap-2">
              <div className={`p-1 rounded ${item.bg}`}>
                <item.icon className={`w-3 h-3 ${item.color}`} />
              </div>
              <span className="text-xs text-rail-text-muted">{item.label}</span>
            </div>
            <span className={`text-xs font-mono font-semibold ${item.color}`}>{item.value}</span>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
