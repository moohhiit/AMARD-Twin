import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { Building2 } from 'lucide-react';
import type { Station } from '@/types';

interface StationNodeData {
  station: Station;
  trainCount: number;
  onClick?: () => void;
}

export const StationNode = memo(({ data }: { data: StationNodeData }) => {
  const { station, trainCount } = data;

  return (
    <div className="node-station px-3 py-2 min-w-[140px] cursor-pointer hover:border-rail-active/60 transition-colors">
      <Handle type="target" position={Position.Top} className="!w-2 !h-2 !bg-rail-active" />
      <Handle type="source" position={Position.Bottom} className="!w-2 !h-2 !bg-rail-active" />
      <Handle type="target" position={Position.Left} className="!w-2 !h-2 !bg-rail-active" />
      <Handle type="source" position={Position.Right} className="!w-2 !h-2 !bg-rail-active" />

      <div className="flex items-center gap-2">
        <div className="w-7 h-7 rounded-md bg-rail-active/20 flex items-center justify-center shrink-0">
          <Building2 className="w-4 h-4 text-rail-active" />
        </div>
        <div className="min-w-0">
          <p className="text-xs font-semibold text-rail-text truncate">{station.name}</p>
          <p className="text-[10px] text-rail-text-dim">{station.station_id}</p>
        </div>
      </div>
      <div className="flex items-center gap-3 mt-2 pt-2 border-t border-rail-border/50">
        <div className="flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-train-running" />
          <span className="text-[10px] text-rail-text-muted">{trainCount} trains</span>
        </div>
        <span className="text-[10px] text-rail-text-dim capitalize">{station.type.toLowerCase()}</span>
      </div>
    </div>
  );
});

StationNode.displayName = 'StationNode';
