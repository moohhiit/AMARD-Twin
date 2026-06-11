import { motion } from 'framer-motion';
import { TrainFront, ChevronRight, ArrowUp, ArrowDown } from 'lucide-react';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { formatSpeed } from '@/lib/utils';
import type { Train } from '@/types';

interface TrainTableProps {
  trains: Train[];
  onSelect: (train: Train) => void;
  selectedTrainNumber?: string | null;
}

export function TrainTable({ trains, onSelect, selectedTrainNumber }: TrainTableProps) {
  return (
    <div className="control-panel overflow-hidden">
      <div className="control-panel-header">
        <span className="control-panel-title">Train Registry</span>
        <span className="text-[10px] text-rail-text-muted">{trains.length} trains</span>
      </div>
      <div className="overflow-x-auto scrollbar-thin">
        <table className="data-table">
          <thead>
            <tr>
              <th className="w-8"></th>
              <th>Train Number</th>
              <th>Name</th>
              <th>Status</th>
              <th>Speed</th>
              <th>Direction</th>
              <th>Current Track</th>
              <th>Route</th>
              <th>Delay</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {trains.map((train, index) => (
              <motion.tr
                key={train.train_number}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: index * 0.02 }}
                onClick={() => onSelect(train)}
                className={`cursor-pointer transition-colors ${selectedTrainNumber === train.train_number ? 'bg-rail-active-dim' : ''}`}
              >
                <td className="pl-3">
                  <TrainFront className={`w-4 h-4 ${
                    train.status === 'EMERGENCY' ? 'text-signal-red' :
                    train.status === 'DELAYED' ? 'text-signal-yellow' :
                    train.status === 'RUNNING' ? 'text-train-running' :
                    'text-rail-text-dim'
                  }`} />
                </td>
                <td className="font-mono text-xs font-semibold text-rail-text">{train.train_number}</td>
                <td className="text-xs text-rail-text">{train.name}</td>
                <td>
                  <StatusBadge status={train.status} size="sm" />
                </td>
                <td className="font-mono text-xs text-rail-text">
                  <span className={train.speed > 0 ? 'text-emerald-400' : 'text-rail-text-dim'}>
                    {formatSpeed(train.speed)}
                  </span>
                </td>
                <td>
                  <span className="flex items-center gap-1 text-xs text-rail-text-muted">
                    {train.direction === 'UP' || train.direction === 'NORTH' || train.direction === 'EAST' ? (
                      <ArrowUp className="w-3 h-3" />
                    ) : (
                      <ArrowDown className="w-3 h-3" />
                    )}
                    {train.direction}
                  </span>
                </td>
                <td className="font-mono text-[11px] text-rail-active">{train.current_track}</td>
                <td className="font-mono text-[11px] text-rail-text-muted">{train.route_id || '-'}</td>
                <td>
                  <span className={`font-mono text-xs ${train.delay_minutes > 0 ? 'text-signal-yellow' : 'text-rail-text-dim'}`}>
                    {train.delay_minutes > 0 ? `${train.delay_minutes}m` : '-'}
                  </span>
                </td>
                <td className="pr-3">
                  <ChevronRight className="w-3.5 h-3.5 text-rail-text-dim" />
                </td>
              </motion.tr>
            ))}
          </tbody>
        </table>
        {trains.length === 0 && (
          <div className="py-12 text-center text-rail-text-dim text-sm">No trains found</div>
        )}
      </div>
    </div>
  );
}
