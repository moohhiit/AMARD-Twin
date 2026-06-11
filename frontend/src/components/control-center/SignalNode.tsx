import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import type { Signal } from '@/types';

interface SignalNodeData {
  signal: Signal;
  onClick?: () => void;
}

const stateColors: Record<string, { color: string; glow: string }> = {
  GREEN: { color: 'bg-signal-green', glow: 'shadow-glow-green' },
  RED: { color: 'bg-signal-red', glow: 'shadow-glow-red' },
  YELLOW: { color: 'bg-signal-yellow', glow: 'shadow-glow-yellow' },
  FLASHING: { color: 'bg-signal-flashing', glow: 'shadow-glow-yellow' },
  OFF: { color: 'bg-rail-text-dim', glow: '' },
};

export const SignalNode = memo(({ data }: { data: SignalNodeData }) => {
  const { signal } = data;
  const style = stateColors[signal.state] || stateColors.OFF;

  return (
    <div className="flex flex-col items-center gap-0.5">
      <Handle type="target" position={Position.Left} className="!w-1.5 !h-1.5 !bg-rail-border" />
      <Handle type="source" position={Position.Right} className="!w-1.5 !h-1.5 !bg-rail-border" />

      <div className="flex flex-col items-center gap-0.5 bg-rail-panel border border-rail-border rounded-md px-1.5 py-1">
        <div className="flex flex-col gap-0.5">
          <span className={`w-2.5 h-2.5 rounded-full ${signal.state === 'RED' ? style.color : 'bg-rail-border'} ${signal.state === 'RED' ? style.glow : ''}`} />
          <span className={`w-2.5 h-2.5 rounded-full ${signal.state === 'YELLOW' || signal.state === 'FLASHING' ? style.color : 'bg-rail-border'} ${signal.state === 'FLASHING' ? 'animate-pulse-signal' : ''}`} />
          <span className={`w-2.5 h-2.5 rounded-full ${signal.state === 'GREEN' ? style.color : 'bg-rail-border'} ${signal.state === 'GREEN' ? style.glow : ''}`} />
        </div>
      </div>
      <span className="text-[8px] font-mono text-rail-text-dim bg-rail-panel/80 px-1 rounded">{signal.signal_id}</span>
    </div>
  );
});

SignalNode.displayName = 'SignalNode';
