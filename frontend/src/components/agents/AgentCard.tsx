import { memo } from 'react';
import {
  Bot,
  Clock,
  AlertTriangle,
  CheckCircle,
  PauseCircle,
  XCircle,
  Loader,
} from 'lucide-react';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { formatDistanceToNow } from '@/lib/utils';
import { AGENT_DISPLAY_NAMES, AGENT_DESCRIPTIONS } from '@/types';
import type { Agent } from '@/types';

interface AgentCardProps {
  agent: Agent;
  index: number;
}

const statusIcons = {
  RUNNING: CheckCircle,
  DEGRADED: AlertTriangle,
  STOPPED: PauseCircle,
  ERROR: XCircle,
  INITIALIZING: Loader,
};

export const AgentCard = memo(({ agent, index }: AgentCardProps) => {
  const Icon = statusIcons[agent.status] || Bot;
  const displayName = AGENT_DISPLAY_NAMES[agent.name] || agent.name;
  const description = AGENT_DESCRIPTIONS[agent.name] || '';

  return (
    <div
      className={`control-panel p-4 animate-fade-in ${
        agent.status === 'ERROR' ? 'border-l-2 border-l-red-400' :
        agent.status === 'DEGRADED' ? 'border-l-2 border-l-amber-400' :
        agent.status === 'RUNNING' ? 'border-l-2 border-l-emerald-400' :
        ''
      }`}
      style={{ animationDelay: `${index * 50}ms` }}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className={`p-1.5 rounded-lg ${
            agent.status === 'RUNNING' ? 'bg-emerald-400/10' :
            agent.status === 'DEGRADED' ? 'bg-amber-400/10' :
            agent.status === 'ERROR' ? 'bg-red-400/10' :
            'bg-slate-400/10'
          }`}>
            <Icon className={`w-4 h-4 ${
              agent.status === 'RUNNING' ? 'text-emerald-400' :
              agent.status === 'DEGRADED' ? 'text-amber-400' :
              agent.status === 'ERROR' ? 'text-red-400' :
              'text-slate-400'
            }`} />
          </div>
          <div>
            <h3 className="text-xs font-semibold text-rail-text">{displayName}</h3>
            <p className="text-[10px] text-rail-text-dim truncate max-w-[200px]">{description}</p>
          </div>
        </div>
        <StatusBadge status={agent.status} size="sm" />
      </div>

      <div className="grid grid-cols-2 gap-2 text-[10px]">
        <div className="bg-rail-surface rounded p-2">
          <span className="text-rail-text-muted block">Events</span>
          <span className="font-mono font-semibold text-rail-text">{agent.events_processed.toLocaleString()}</span>
        </div>
        <div className="bg-rail-surface rounded p-2">
          <span className="text-rail-text-muted block">Rate/min</span>
          <span className="font-mono font-semibold text-rail-text">{agent.events_per_minute.toFixed(1)}</span>
        </div>
        <div className="bg-rail-surface rounded p-2">
          <span className="text-rail-text-muted block">Response</span>
          <span className="font-mono font-semibold text-rail-text">{Math.round(agent.avg_response_time_ms)}ms</span>
        </div>
        <div className="bg-rail-surface rounded p-2">
          <span className="text-rail-text-muted block">Errors</span>
          <span className={`font-mono font-semibold ${agent.error_count > 0 ? 'text-red-400' : 'text-rail-text'}`}>
            {agent.error_count}
          </span>
        </div>
      </div>

      {agent.last_event_at && (
        <div className="mt-2 flex items-center gap-1.5 text-[9px] text-rail-text-dim">
          <Clock className="w-3 h-3" />
          <span>Last event: {formatDistanceToNow(agent.last_event_at)}</span>
          <span className="text-rail-active">{agent.last_event_type}</span>
        </div>
      )}

      {agent.subscribed_events.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {agent.subscribed_events.slice(0, 4).map((evt) => (
            <span key={evt} className="text-[8px] px-1.5 py-0.5 rounded bg-rail-active/10 text-rail-active font-mono">
              {evt.replace(/_/g, ' ')}
            </span>
          ))}
          {agent.subscribed_events.length > 4 && (
            <span className="text-[8px] text-rail-text-dim">+{agent.subscribed_events.length - 4}</span>
          )}
        </div>
      )}
    </div>
  );
});

AgentCard.displayName = 'AgentCard';
