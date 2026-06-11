import { motion } from 'framer-motion';
import { SquareStack, TrainFront } from 'lucide-react';
import { StatusBadge } from '@/components/shared/StatusBadge';
import type { Platform } from '@/types';

interface PlatformBoardProps {
  platforms: Platform[];
  onSelect?: (platform: Platform) => void;
}

export function PlatformBoard({ platforms, onSelect }: PlatformBoardProps) {
  const byStation = platforms.reduce<Record<string, Platform[]>>((acc, p) => {
    const key = p.station_name || p.station_id;
    if (!acc[key]) acc[key] = [];
    acc[key].push(p);
    return acc;
  }, {});

  return (
    <div className="space-y-4">
      {Object.entries(byStation).map(([stationName, stationPlatforms]) => (
        <div key={stationName} className="control-panel">
          <div className="control-panel-header">
            <span className="control-panel-title flex items-center gap-2">
              <SquareStack className="w-4 h-4 text-rail-active" />
              {stationName}
            </span>
            <span className="text-[10px] text-rail-text-muted">{stationPlatforms.length} platforms</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 p-4">
            {stationPlatforms.map((platform, index) => (
              <motion.div
                key={platform.platform_id}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: index * 0.03 }}
                onClick={() => onSelect?.(platform)}
                className={`bg-rail-surface border rounded-lg p-3 cursor-pointer transition-all hover:scale-[1.02] ${
                  platform.status === 'OCCUPIED'
                    ? 'border-red-400/30 shadow-[0_0_20px_rgba(239,68,68,0.3)]'
                    : platform.status === 'RESERVED'
                      ? 'border-amber-400/30'
                      : platform.status === 'MAINTENANCE'
                        ? 'border-rail-text-dim/30'
                        : 'border-rail-border hover:border-emerald-500/30'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-lg font-bold font-mono text-rail-text">
                    PF {platform.platform_number}
                  </span>
                  <StatusBadge status={platform.status} size="sm" />
                </div>
                <div className="space-y-1.5">
                  {platform.current_train && (
                    <div className="flex items-center gap-2">
                      <TrainFront className="w-3.5 h-3.5 text-rail-active" />
                      <span className="text-xs font-mono text-rail-active">{platform.current_train}</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between text-[10px] text-rail-text-dim">
                    <span>{platform.length_m}m length</span>
                    <span>{Math.round(platform.occupancy_percentage)}% used</span>
                  </div>
                  {platform.connected_track && (
                    <div className="text-[10px] font-mono text-rail-text-muted">
                      Track: {platform.connected_track}
                    </div>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      ))}
      {platforms.length === 0 && (
        <div className="control-panel p-12 text-center text-rail-text-dim">No platforms found</div>
      )}
    </div>
  );
}
