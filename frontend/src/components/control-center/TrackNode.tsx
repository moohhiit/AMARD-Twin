import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import type { TrackSegment } from '@/types';

interface TrackNodeData {
  track: TrackSegment;
  trainCount: number;
  isBlocked: boolean;
  onClick?: () => void;
}

const statusConfig: Record<string, { border: string; bg: string; text: string }> = {
  ACTIVE: { border: 'border-rail-border', bg: 'bg-rail-surface', text: 'text-rail-text-muted' },
  BLOCKED: { border: 'border-signal-red/50', bg: 'bg-signal-red/5', text: 'text-signal-red' },
  MAINTENANCE: { border: 'border-rail-text-dim/50', bg: 'bg-rail-text-dim/5', text: 'text-rail-text-dim' },
  LIMITED: { border: 'border-signal-yellow/50', bg: 'bg-signal-yellow/5', text: 'text-signal-yellow' },
};

export const TrackNode = memo(({ data }: { data: TrackNodeData }) => {
  const { track, trainCount, isBlocked } = data;
  const config = statusConfig[track.status] || statusConfig.ACTIVE;

  return (
    <div
      className={`${config.bg} ${config.border} border rounded px-2 py-1 min-w-[100px] cursor-pointer hover:border-rail-active/50 transition-colors`}
    >
      <Handle type="target" position={Position.Left} className="!w-1.5 !h-1.5 !bg-rail-track" />
      <Handle type="source" position={Position.Right} className="!w-1.5 !h-1.5 !bg-rail-track" />
      <Handle type="target" position={Position.Top} className="!w-1.5 !h-1.5 !bg-rail-track" />
      <Handle type="source" position={Position.Bottom} className="!w-1.5 !h-1.5 !bg-rail-track" />

      <div className="flex items-center justify-between gap-2">
        <span className={`text-[9px] font-mono font-medium ${config.text}`}>{track.track_id}</span>
        {trainCount > 0 && (
          <span className="flex items-center gap-0.5">
            <span className="w-1 h-1 rounded-full bg-train-running" />
            <span className="text-[8px] text-train-running font-mono">{trainCount}</span>
          </span>
        )}
      </div>
      <div className="flex items-center gap-2 mt-0.5">
        <span className="text-[8px] text-rail-text-dim">{track.length_km}km</span>
        <span className="text-[8px] text-rail-text-dim">{track.speed_limit}km/h</span>
        {isBlocked && (
          <span className="text-[8px] text-signal-red font-medium animate-pulse">BLOCKED</span>
        )}
      </div>
    </div>
  );
});

TrackNode.displayName = 'TrackNode';
