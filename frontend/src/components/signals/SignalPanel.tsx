import { useState } from 'react';
import { motion } from 'framer-motion';
import { TrafficCone, Shield } from 'lucide-react';
import { signalApi } from '@/services/api';
import { useSignalStore } from '@/store';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { toast } from 'sonner';
import type { Signal, SignalState } from '@/types';

interface SignalPanelProps {
  signals: Signal[];
}

const stateOrder: SignalState[] = ['GREEN', 'YELLOW', 'RED', 'FLASHING', 'OFF'];

export function SignalPanel({ signals }: SignalPanelProps) {
  const [loading, setLoading] = useState<string | null>(null);
  const updateSignalState = useSignalStore((s) => s.updateSignalState);

  const handleChangeState = async (signalId: string, newState: SignalState) => {
    setLoading(signalId);
    try {
      await signalApi.updateState(signalId, { state: newState });
      updateSignalState(signalId, newState);
      toast.success(`Signal ${signalId} changed to ${newState}`);
    } catch (err) {
      toast.error(`Failed to update signal: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setLoading(null);
    }
  };

  const handleSafetyCheck = async (signalId: string) => {
    setLoading(signalId);
    try {
      const result = await signalApi.safetyCheck(signalId);
      if (result.safe_to_proceed) {
        toast.success(`Signal ${signalId} is safe to proceed`);
      } else {
        toast.warning(`Signal ${signalId} has warnings: ${result.warnings.join(', ')}`);
      }
    } catch (err) {
      toast.error(`Safety check failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
      {signals.map((signal, index) => (
        <motion.div
          key={signal.signal_id}
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: index * 0.02 }}
          className={`control-panel p-3 ${
            signal.state === 'RED' ? 'border-l-2 border-l-red-400' :
            signal.state === 'GREEN' ? 'border-l-2 border-l-emerald-400' :
            signal.state === 'YELLOW' ? 'border-l-2 border-l-amber-400' :
            ''
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <TrafficCone className="w-4 h-4 text-rail-active" />
              <span className="text-xs font-mono font-semibold text-rail-text">{signal.signal_id}</span>
            </div>
            <StatusBadge status={signal.state} size="sm" pulse={signal.state === 'FLASHING'} />
          </div>

          <div className="space-y-1 mb-3">
            <div className="text-[10px] text-rail-text-dim">
              Track: <span className="font-mono text-rail-active">{signal.controlled_track}</span>
            </div>
            <div className="text-[10px] text-rail-text-dim">
              Type: {signal.type} | Mode: {signal.auto_mode ? 'AUTO' : 'MANUAL'}
            </div>
          </div>

          <div className="flex gap-1">
            {stateOrder.map((state) => (
              <button
                key={state}
                onClick={() => signal.state !== state && handleChangeState(signal.signal_id, state)}
                disabled={loading === signal.signal_id || signal.state === state}
                className={`flex-1 py-1 rounded text-[9px] font-mono font-medium transition-all ${
                  signal.state === state
                    ? state === 'GREEN' ? 'bg-emerald-400/20 text-emerald-400' :
                      state === 'RED' ? 'bg-red-400/20 text-red-400' :
                      state === 'YELLOW' ? 'bg-amber-400/20 text-amber-400' :
                      'bg-rail-text-dim/20 text-rail-text-dim'
                    : 'bg-rail-surface text-rail-text-muted hover:bg-rail-active/10 hover:text-rail-active'
                }`}
              >
                {state[0]}
              </button>
            ))}
          </div>

          <button
            onClick={() => handleSafetyCheck(signal.signal_id)}
            disabled={loading === signal.signal_id}
            className="mt-2 w-full flex items-center justify-center gap-1.5 py-1 rounded text-[10px] text-rail-text-muted hover:bg-rail-surface transition-colors"
          >
            <Shield className="w-3 h-3" />
            Safety Check
          </button>
        </motion.div>
      ))}
      {signals.length === 0 && (
        <div className="col-span-full control-panel p-12 text-center text-rail-text-dim">No signals found</div>
      )}
    </div>
  );
}
