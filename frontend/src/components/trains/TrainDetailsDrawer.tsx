import { motion } from 'framer-motion';
import { X, TrainFront, Route, Gauge, Clock, MapPin, ArrowUp, Ruler } from 'lucide-react';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { formatSpeed } from '@/lib/utils';
import { useTrainGraphQuery } from '@/hooks/useTrainData';
import { LoadingState } from '@/components/shared/LoadingState';
import type { Train } from '@/types';

interface TrainDetailsDrawerProps {
  train: Train | null;
  onClose: () => void;
}

export function TrainDetailsDrawer({ train, onClose }: TrainDetailsDrawerProps) {
  const { data: graph, isLoading } = useTrainGraphQuery(train?.train_number || '', !!train);

  if (!train) return null;

  return (
    <motion.div
      initial={{ x: 400, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: 400, opacity: 0 }}
      transition={{ type: 'spring', damping: 25, stiffness: 200 }}
      className="fixed right-0 top-14 bottom-0 w-96 bg-rail-panel border-l border-rail-border z-40 overflow-y-auto scrollbar-thin shadow-panel"
    >
      <div className="sticky top-0 bg-rail-panel border-b border-rail-border p-4 flex items-center justify-between z-10">
        <div className="flex items-center gap-2">
          <TrainFront className={`w-5 h-5 ${
            train.status === 'EMERGENCY' ? 'text-red-400' :
            train.status === 'DELAYED' ? 'text-amber-400' :
            'text-rail-active'
          }`} />
          <div>
            <h2 className="text-sm font-bold text-rail-text">{train.train_number}</h2>
            <p className="text-[10px] text-rail-text-muted">{train.name}</p>
          </div>
        </div>
        <button onClick={onClose} className="p-1.5 rounded-md hover:bg-rail-surface transition-colors">
          <X className="w-4 h-4 text-rail-text-muted" />
        </button>
      </div>

      <div className="p-4 space-y-4">
        <div className="flex items-center gap-2">
          <StatusBadge status={train.status} size="md" pulse={train.status === 'EMERGENCY'} />
          {train.delay_minutes > 0 && (
            <span className="text-xs text-amber-400 font-mono">+{train.delay_minutes}m delay</span>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="bg-rail-surface rounded-md p-3">
            <div className="flex items-center gap-1.5 text-rail-text-muted mb-1">
              <Gauge className="w-3.5 h-3.5" />
              <span className="text-[10px] uppercase tracking-wider">Speed</span>
            </div>
            <p className="text-lg font-mono font-bold text-rail-text">{formatSpeed(train.speed)}</p>
          </div>
          <div className="bg-rail-surface rounded-md p-3">
            <div className="flex items-center gap-1.5 text-rail-text-muted mb-1">
              <Ruler className="w-3.5 h-3.5" />
              <span className="text-[10px] uppercase tracking-wider">Length</span>
            </div>
            <p className="text-lg font-mono font-bold text-rail-text">{train.train_length_m}m</p>
          </div>
        </div>

        <div className="space-y-3">
          <InfoRow
            icon={<MapPin className="w-3.5 h-3.5" />}
            label="Current Track"
            value={train.current_track}
            mono
          />
          <InfoRow
            icon={<ArrowUp className="w-3.5 h-3.5" />}
            label="Direction"
            value={train.direction}
          />
          <InfoRow
            icon={<Route className="w-3.5 h-3.5" />}
            label="Route ID"
            value={train.route_id || 'Unassigned'}
            mono
          />
          <InfoRow
            icon={<Clock className="w-3.5 h-3.5" />}
            label="Progress"
            value={`${Math.round(train.progress_on_track)}%`}
          />
          <InfoRow
            icon={<MapPin className="w-3.5 h-3.5" />}
            label="Platform"
            value={train.current_platform || 'None'}
            mono
          />
        </div>

        {isLoading ? (
          <LoadingState message="Loading graph data..." />
        ) : graph ? (
          <div className="border-t border-rail-border pt-4">
            <h3 className="text-xs font-semibold text-rail-text uppercase tracking-wider mb-3">Graph Context</h3>
            <div className="space-y-2">
              {graph.current_track && (
                <div className="bg-rail-surface rounded-md p-3">
                  <p className="text-[10px] text-rail-text-muted uppercase">Current Track</p>
                  <p className="text-xs font-mono text-rail-active mt-0.5">{graph.current_track.track_id}</p>
                  <div className="flex gap-3 mt-1">
                    <span className="text-[10px] text-rail-text-dim">{graph.current_track.length_km}km</span>
                    <span className="text-[10px] text-rail-text-dim">{graph.current_track.speed_limit}km/h limit</span>
                  </div>
                </div>
              )}
              {graph.zone && (
                <div className="bg-rail-surface rounded-md p-3">
                  <p className="text-[10px] text-rail-text-muted uppercase">Zone</p>
                  <p className="text-xs font-mono text-rail-text mt-0.5">{graph.zone.name}</p>
                  <p className="text-[10px] text-rail-text-dim mt-1">
                    Congestion: {Math.round(graph.zone.congestion_level * 100)}%
                  </p>
                </div>
              )}
              {graph.route && (
                <div className="bg-rail-surface rounded-md p-3">
                  <p className="text-[10px] text-rail-text-muted uppercase">Route</p>
                  <p className="text-xs font-mono text-rail-active mt-0.5">{graph.route.name}</p>
                  <p className="text-[10px] text-rail-text-dim mt-1">Priority: {graph.route.priority}</p>
                </div>
              )}
              {graph.next_track && (
                <div className="bg-rail-surface rounded-md p-3">
                  <p className="text-[10px] text-rail-text-muted uppercase">Next Track</p>
                  <p className="text-xs font-mono text-rail-text mt-0.5">{graph.next_track.track_id}</p>
                </div>
              )}
            </div>
          </div>
        ) : null}
      </div>
    </motion.div>
  );
}

function InfoRow({ icon, label, value, mono }: { icon: React.ReactNode; label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-rail-border/30">
      <div className="flex items-center gap-2 text-rail-text-muted">
        {icon}
        <span className="text-xs">{label}</span>
      </div>
      <span className={`text-xs text-rail-text ${mono ? 'font-mono' : ''}`}>{value}</span>
    </div>
  );
}
