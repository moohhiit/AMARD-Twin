import { motion } from 'framer-motion';
import {
  Activity,
  TrendingUp,
  TrendingDown,
  Minus,
  TrainFront,
  SquareStack,
  TrafficCone,
  AlertTriangle,
} from 'lucide-react';
import { useDigitalTwinQuery } from '@/hooks/useNetworkState';
import { LoadingState } from '@/components/shared/LoadingState';
import { ErrorState } from '@/components/shared/ErrorState';
import type { NetworkMetrics } from '@/types';

function MiniTrend({ value, max, color }: { value: number; max: number; color: string }) {
  const percentage = Math.min(100, Math.max(0, (value / max) * 100));
  return (
    <div className="w-16 h-1.5 bg-rail-surface rounded-full overflow-hidden">
      <motion.div
        initial={{ width: 0 }}
        animate={{ width: `${percentage}%` }}
        transition={{ duration: 0.5 }}
        className={`h-full rounded-full ${color}`}
      />
    </div>
  );
}

interface SystemOverviewProps {
  metrics: NetworkMetrics | null;
}

export function SystemOverview({ metrics }: SystemOverviewProps) {
  const { data: twin, isLoading, error, refetch } = useDigitalTwinQuery(10000);

  if (isLoading) return <LoadingState message="Loading overview..." />;
  if (error) return <ErrorState message="Failed to load overview" onRetry={refetch} />;
  if (!metrics) return null;

  const trend = twin?.metrics
    ? twin.metrics.train_count > metrics.train_count
      ? 'up'
      : twin.metrics.train_count < metrics.train_count
        ? 'down'
        : 'neutral'
    : 'neutral';

  const TrendIcon = trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : Minus;
  const trendColor = trend === 'up' ? 'text-emerald-400' : trend === 'down' ? 'text-red-400' : 'text-rail-text-dim';

  const overviewItems = [
    {
      label: 'Train Utilization',
      value: `${Math.round((metrics.active_trains / Math.max(1, metrics.train_count)) * 100)}%`,
      icon: TrainFront,
      trend: metrics.active_trains,
      max: Math.max(1, metrics.train_count),
      color: 'bg-blue-400',
      desc: `${metrics.active_trains} of ${metrics.train_count} trains active`,
    },
    {
      label: 'Platform Utilization',
      value: `${Math.round(((metrics.platform_occupancy.occupied + metrics.platform_occupancy.reserved) / Math.max(1, metrics.platform_occupancy.free + metrics.platform_occupancy.occupied + metrics.platform_occupancy.reserved)) * 100)}%`,
      icon: SquareStack,
      trend: metrics.platform_occupancy.occupied + metrics.platform_occupancy.reserved,
      max: metrics.platform_occupancy.free + metrics.platform_occupancy.occupied + metrics.platform_occupancy.reserved,
      color: 'bg-emerald-400',
      desc: `${metrics.platform_occupancy.occupied} occupied, ${metrics.platform_occupancy.reserved} reserved`,
    },
    {
      label: 'Signal Efficiency',
      value: `${Math.round((metrics.signal_states.green / Math.max(1, metrics.signal_states.green + metrics.signal_states.red + metrics.signal_states.yellow)) * 100)}%`,
      icon: TrafficCone,
      trend: metrics.signal_states.green,
      max: metrics.signal_states.green + metrics.signal_states.red + metrics.signal_states.yellow,
      color: 'bg-amber-400',
      desc: `${metrics.signal_states.green} green, ${metrics.signal_states.red} red`,
    },
    {
      label: 'Network Risk',
      value: metrics.conflict_count > 0 ? 'ELEVATED' : 'NORMAL',
      icon: AlertTriangle,
      trend: metrics.conflict_count,
      max: 10,
      color: metrics.conflict_count > 0 ? 'bg-red-400' : 'bg-emerald-400',
      desc: `${metrics.conflict_count} active conflicts`,
    },
  ];

  return (
    <div className="control-panel">
      <div className="control-panel-header">
        <span className="control-panel-title">System Overview</span>
        <TrendIcon className={`w-3.5 h-3.5 ${trendColor}`} />
      </div>
      <div className="control-panel-body space-y-3">
        {overviewItems.map((item, index) => (
          <motion.div
            key={item.label}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
          >
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <item.icon className="w-3.5 h-3.5 text-rail-text-muted" />
                <span className="text-xs text-rail-text">{item.label}</span>
              </div>
              <span className="text-xs font-mono font-semibold text-rail-text">{item.value}</span>
            </div>
            <div className="flex items-center gap-2">
              <MiniTrend value={item.trend} max={item.max} color={item.color} />
              <span className="text-[10px] text-rail-text-dim shrink-0">{item.desc}</span>
            </div>
          </motion.div>
        ))}

        {twin && (
          <div className="pt-2 mt-2 border-t border-rail-border">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Activity className="w-3 h-3 text-rail-active" />
                <span className="text-[10px] text-rail-text-muted">Uptime</span>
              </div>
              <span className="text-[10px] font-mono text-rail-text">
                {Math.floor(twin.uptime_seconds / 3600)}h {Math.floor((twin.uptime_seconds % 3600) / 60)}m
              </span>
            </div>
            <div className="flex items-center justify-between mt-1">
              <span className="text-[10px] text-rail-text-muted">Last updated</span>
              <span className="text-[10px] font-mono text-rail-text-dim">
                {new Date(twin.last_updated).toLocaleTimeString()}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
