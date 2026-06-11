import { motion } from 'framer-motion';
import {
  ClockAlert,
  TrainFront,
  MapPin,
  AlertTriangle,
  Gauge,
} from 'lucide-react';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { formatDuration } from '@/lib/utils';
import type { DelayReport } from '@/types';

interface DelayTimelineProps {
  report: DelayReport | null;
}

export function DelayTimeline({ report }: DelayTimelineProps) {
  if (!report) {
    return (
      <div className="control-panel p-12 text-center text-rail-text-dim">
        <ClockAlert className="w-8 h-8 mx-auto mb-2" />
        <p className="text-sm">No delay data available</p>
      </div>
    );
  }

  // Defensive defaults — ensures arrays always exist
  const delayedTrains = report.delayed_trains ?? [];
  const affectedLocations = report.affected_locations ?? [];

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="grid grid-cols-3 gap-3">
        <div className="control-panel p-3">
          <p className="text-[10px] text-rail-text-muted uppercase">Total Delay</p>
          <p className="text-xl font-mono font-bold text-amber-400 mt-1">
            {formatDuration(report.total_delay_minutes ?? 0)}
          </p>
        </div>
        <div className="control-panel p-3">
          <p className="text-[10px] text-rail-text-muted uppercase">Affected Trains</p>
          <p className="text-xl font-mono font-bold text-rail-text mt-1">
            {delayedTrains.length}
          </p>
        </div>
        <div className="control-panel p-3">
          <p className="text-[10px] text-rail-text-muted uppercase">Avg Delay</p>
          <p className="text-xl font-mono font-bold text-rail-active mt-1">
            {formatDuration(report.avg_delay_minutes ?? 0)}
          </p>
        </div>
      </div>

      {/* Delayed Trains */}
      <div className="control-panel">
        <div className="control-panel-header">
          <span className="control-panel-title flex items-center gap-2">
            <ClockAlert className="w-4 h-4 text-amber-400" />
            Delayed Trains
          </span>
        </div>
        <div className="divide-y divide-rail-border">
          {delayedTrains.map((train, index) => (
            <motion.div
              key={train.train_number}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: index * 0.03 }}
              className="p-3 flex items-start gap-3"
            >
              <div className="p-2 rounded-lg bg-amber-400/10 shrink-0">
                <TrainFront className="w-4 h-4 text-amber-400" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono font-semibold text-rail-text">{train.train_number}</span>
                  <StatusBadge status="DELAYED" size="sm" />
                </div>
                <div className="flex items-center gap-3 mt-1">
                  <span className="flex items-center gap-1 text-[10px] text-rail-text-dim">
                    <ClockAlert className="w-3 h-3" />
                    +{train.delay_minutes}m
                  </span>
                  {train.location && (
                    <span className="flex items-center gap-1 text-[10px] text-rail-text-dim">
                      <MapPin className="w-3 h-3" />
                      {train.location}
                    </span>
                  )}
                  {train.reason && (
                    <span className="flex items-center gap-1 text-[10px] text-amber-400">
                      <AlertTriangle className="w-3 h-3" />
                      {train.reason}
                    </span>
                  )}
                </div>
              </div>
            </motion.div>
          ))}
        </div>
        {delayedTrains.length === 0 && (
          <div className="p-12 text-center text-rail-text-dim">
            <Gauge className="w-8 h-8 mx-auto mb-2 text-emerald-400" />
            <p className="text-sm">No delayed trains</p>
            <p className="text-[10px] mt-1">All trains running on schedule</p>
          </div>
        )}
      </div>

      {/* Affected Locations */}
      {affectedLocations.length > 0 && (
        <div className="control-panel">
          <div className="control-panel-header">
            <span className="control-panel-title">Affected Locations</span>
          </div>
          <div className="p-4 flex flex-wrap gap-2">
            {affectedLocations.map((loc) => (
              <span key={loc} className="px-2 py-1 rounded-md bg-rail-surface text-[10px] font-mono text-rail-text-muted border border-rail-border">
                {loc}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}