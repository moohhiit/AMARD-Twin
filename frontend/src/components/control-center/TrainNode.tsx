import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { TrainFront } from 'lucide-react';
import type { Train } from '@/types';

interface TrainNodeData {
  train: Train;
  onClick?: () => void;
}

const statusConfig: Record<string, { color: string; bg: string; glow: string; label: string }> = {
  RUNNING: { color: 'text-train-running', bg: 'bg-train-running/15', glow: 'shadow-glow-green', label: 'Running' },
  DELAYED: { color: 'text-train-delayed', bg: 'bg-train-delayed/15', glow: 'shadow-glow-yellow', label: 'Delayed' },
  STOPPED: { color: 'text-train-stopped', bg: 'bg-train-stopped/15', glow: '', label: 'Stopped' },
  EMERGENCY: { color: 'text-train-emergency', bg: 'bg-train-emergency/15', glow: 'shadow-glow-red', label: 'Emergency' },
  APPROACHING: { color: 'text-train-approaching', bg: 'bg-train-approaching/15', glow: 'shadow-glow', label: 'Approaching' },
  MAINTENANCE: { color: 'text-train-stopped', bg: 'bg-train-stopped/15', glow: '', label: 'Maintenance' },
};

export const TrainNode = memo(({ data }: { data: TrainNodeData }) => {
  const { train } = data;
  const config = statusConfig[train.status] || statusConfig.STOPPED;

  return (
    <div
      className={`${config.bg} ${config.glow} border border-current rounded-lg px-2.5 py-1.5 min-w-[120px] cursor-pointer hover:scale-105 transition-transform`}
      style={{ color: 'inherit' }}
    >
      <Handle type="target" position={Position.Left} className="!w-1 !h-1" />
      <Handle type="source" position={Position.Right} className="!w-1 !h-1" />

      <div className="flex items-center gap-2">
        <TrainFront className={`w-4 h-4 ${config.color}`} />
        <div className="min-w-0">
          <p className={`text-[11px] font-bold font-mono ${config.color} truncate`}>
            {train.train_number}
          </p>
          <p className="text-[9px] text-rail-text-muted truncate">{train.name}</p>
        </div>
      </div>
      <div className="flex items-center gap-2 mt-1 pt-1 border-t border-rail-border/30">
        <span className={`w-1.5 h-1.5 rounded-full ${config.color.replace('text-', 'bg-')} animate-pulse`} />
        <span className="text-[9px] text-rail-text-dim">{Math.round(train.speed)} km/h</span>
        <span className="text-[9px] text-rail-text-dim">{train.direction}</span>
      </div>
    </div>
  );
});

TrainNode.displayName = 'TrainNode';
