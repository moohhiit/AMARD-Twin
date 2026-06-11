import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { GitFork } from 'lucide-react';
import type { Junction } from '@/types';

interface JunctionNodeData {
  junction: Junction;
  conflictCount: number;
  onClick?: () => void;
}

export const JunctionNode = memo(({ data }: { data: JunctionNodeData }) => {
  const { junction, conflictCount } = data;
  const hasConflict = junction.status === 'CONFLICTED' || conflictCount > 0;

  return (
    <div
      className={`bg-rail-elevated border-2 rounded-full w-14 h-14 flex items-center justify-center cursor-pointer transition-all ${
        hasConflict
          ? 'border-signal-red shadow-glow-red animate-pulse-glow'
          : 'border-signal-yellow hover:border-signal-yellow/80'
      }`}
    >
      <Handle type="target" position={Position.Top} className="!w-2 !h-2 !bg-signal-yellow" />
      <Handle type="source" position={Position.Bottom} className="!w-2 !h-2 !bg-signal-yellow" />
      <Handle type="target" position={Position.Left} className="!w-2 !h-2 !bg-signal-yellow" />
      <Handle type="source" position={Position.Right} className="!w-2 !h-2 !bg-signal-yellow" />

      <div className="relative">
        <GitFork className={`w-5 h-5 ${hasConflict ? 'text-signal-red' : 'text-signal-yellow'}`} />
        {hasConflict && (
          <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-signal-red border-2 border-rail-panel text-[6px] font-bold text-white flex items-center justify-center">
            {conflictCount}
          </span>
        )}
      </div>
    </div>
  );
});

JunctionNode.displayName = 'JunctionNode';
