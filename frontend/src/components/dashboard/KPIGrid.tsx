import { motion } from 'framer-motion';
import {
  TrainFront,
  SquareStack,
  TrafficCone,
  AlertTriangle,
  ClockAlert,
  Gauge,
  ShieldAlert,
  Wrench,
} from 'lucide-react';
import { MetricCard } from '@/components/shared/MetricCard';
import type { NetworkMetrics } from '@/types';

interface KPIGridProps {
  metrics: NetworkMetrics | null;
}

export function KPIGrid({ metrics }: KPIGridProps) {
  if (!metrics) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="control-panel p-4 animate-pulse">
            <div className="h-8 bg-rail-surface rounded" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3"
    >
      <MetricCard
        title="Active Trains"
        value={metrics.active_trains}
        subtitle={`of ${metrics.train_count} total`}
        icon={<TrainFront className="w-4 h-4" />}
        color="blue"
        delay={0}
      />
      <MetricCard
        title="Platforms"
        value={`${metrics.platform_occupancy.occupied + metrics.platform_occupancy.reserved}/${metrics.platform_occupancy.free + metrics.platform_occupancy.occupied + metrics.platform_occupancy.reserved}`}
        subtitle={`${metrics.platform_occupancy.free} free`}
        icon={<SquareStack className="w-4 h-4" />}
        color="green"
        delay={1}
      />
      <MetricCard
        title="Signal Green"
        value={metrics.signal_states.green}
        subtitle={`${metrics.signal_states.red} red`}
        icon={<TrafficCone className="w-4 h-4" />}
        color="green"
        delay={2}
      />
      <MetricCard
        title="Conflicts"
        value={metrics.conflict_count}
        subtitle="active now"
        icon={<AlertTriangle className="w-4 h-4" />}
        color={metrics.conflict_count > 0 ? 'red' : 'green'}
        delay={3}
      />
      <MetricCard
        title="Avg Delay"
        value={`${Math.round(metrics.avg_delay_minutes)}m`}
        subtitle="network wide"
        icon={<ClockAlert className="w-4 h-4" />}
        color={metrics.avg_delay_minutes > 15 ? 'red' : metrics.avg_delay_minutes > 5 ? 'yellow' : 'green'}
        delay={4}
      />
      <MetricCard
        title="Avg Speed"
        value={`${Math.round(metrics.avg_speed)} km/h`}
        subtitle="active trains"
        icon={<Gauge className="w-4 h-4" />}
        color="blue"
        delay={5}
      />
      <MetricCard
        title="Emergencies"
        value={metrics.emergency_count}
        subtitle="active events"
        icon={<ShieldAlert className="w-4 h-4" />}
        color={metrics.emergency_count > 0 ? 'red' : 'green'}
        delay={6}
      />
      <MetricCard
        title="Maintenance"
        value={metrics.maintenance_blocks}
        subtitle="active blocks"
        icon={<Wrench className="w-4 h-4" />}
        color={metrics.maintenance_blocks > 0 ? 'yellow' : 'green'}
        delay={7}
      />
    </motion.div>
  );
}
