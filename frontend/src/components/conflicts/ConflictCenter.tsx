import { motion } from 'framer-motion';
import {
  AlertTriangle,
  TrainFront,
  MapPin,
  ShieldAlert,
  Clock,
  Siren,
  GitFork,
  Route,
} from 'lucide-react';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { formatDistanceToNow } from '@/lib/utils';
import type { RouteConflict } from '@/types';

interface ConflictCenterProps {
  conflicts: RouteConflict[];
}

const conflictTypeIcons: Record<string, typeof AlertTriangle> = {
  TRACK_OCCUPANCY: TrainFront,
  ROUTE_OVERLAP: Route,
  JUNCTION: GitFork,
  HEADWAY: Siren,
};

export function ConflictCenter({ conflicts }: ConflictCenterProps) {
  const critical = conflicts.filter((c) => c.severity === 'CRITICAL');
  const high = conflicts.filter((c) => c.severity === 'HIGH');
  const medium = conflicts.filter((c) => c.severity === 'MEDIUM');
  const low = conflicts.filter((c) => c.severity === 'LOW');

  return (
    <div className="space-y-4">
      {/* Severity Summary */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: 'Critical', count: critical.length, color: 'bg-red-500/10 text-red-400 border-red-500/20' },
          { label: 'High', count: high.length, color: 'bg-orange-500/10 text-orange-400 border-orange-500/20' },
          { label: 'Medium', count: medium.length, color: 'bg-amber-500/10 text-amber-400 border-amber-500/20' },
          { label: 'Low', count: low.length, color: 'bg-blue-500/10 text-blue-400 border-blue-500/20' },
        ].map((item) => (
          <div key={item.label} className={`control-panel p-3 border ${item.color}`}>
            <p className="text-[10px] uppercase tracking-wider text-rail-text-muted">{item.label}</p>
            <p className="text-2xl font-mono font-bold mt-1">{item.count}</p>
          </div>
        ))}
      </div>

      {/* Conflicts List */}
      <div className="control-panel">
        <div className="control-panel-header">
          <span className="control-panel-title flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-signal-red" />
            Active Conflicts
          </span>
          <span className="text-[10px] text-rail-text-muted">{conflicts.length} conflicts</span>
        </div>
        <div className="divide-y divide-rail-border">
          {conflicts.map((conflict, index) => {
            const Icon = conflictTypeIcons[conflict.conflict_type] || AlertTriangle;
            const isCritical = conflict.severity === 'CRITICAL';

            return (
              <motion.div
                key={`${conflict.track_id}-${index}`}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: index * 0.03 }}
                className={`p-3 flex items-start gap-3 ${isCritical ? 'animate-flash-critical' : ''}`}
              >
                <div className={`p-2 rounded-lg shrink-0 ${
                  conflict.severity === 'CRITICAL' ? 'bg-red-500/10' :
                  conflict.severity === 'HIGH' ? 'bg-orange-500/10' :
                  conflict.severity === 'MEDIUM' ? 'bg-amber-500/10' :
                  'bg-blue-500/10'
                }`}>
                  <Icon className={`w-4 h-4 ${
                    conflict.severity === 'CRITICAL' ? 'text-red-400' :
                    conflict.severity === 'HIGH' ? 'text-orange-400' :
                    conflict.severity === 'MEDIUM' ? 'text-amber-400' :
                    'text-blue-400'
                  }`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-semibold text-rail-text">{conflict.conflict_type}</span>
                    <StatusBadge status={conflict.severity} size="sm" />
                  </div>
                  <p className="text-[10px] text-rail-text-muted mt-0.5">{conflict.description}</p>
                  <div className="flex items-center gap-3 mt-1.5">
                    <span className="flex items-center gap-1 text-[10px] text-rail-text-dim">
                      <MapPin className="w-3 h-3" />
                      {conflict.track_id}
                    </span>
                    {conflict.train_a && (
                      <span className="flex items-center gap-1 text-[10px] font-mono text-rail-active">
                        <TrainFront className="w-3 h-3" />
                        {conflict.train_a}
                      </span>
                    )}
                    {conflict.train_b && (
                      <span className="flex items-center gap-1 text-[10px] font-mono text-signal-yellow">
                        <TrainFront className="w-3 h-3" />
                        {conflict.train_b}
                      </span>
                    )}
                    <span className="flex items-center gap-1 text-[10px] text-rail-text-dim">
                      <Clock className="w-3 h-3" />
                      {formatDistanceToNow(conflict.timestamp)}
                    </span>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
        {conflicts.length === 0 && (
          <div className="p-12 text-center text-rail-text-dim">
            <ShieldAlert className="w-8 h-8 mx-auto mb-2 text-emerald-400" />
            <p className="text-sm">No active conflicts</p>
            <p className="text-[10px] mt-1">All clear</p>
          </div>
        )}
      </div>
    </div>
  );
}
