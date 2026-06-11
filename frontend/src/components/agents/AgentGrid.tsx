import {
  TrendingUp,
  Activity,
  Clock,
} from 'lucide-react';
import { AgentCard } from './AgentCard';
import type { Agent, AgentSummary } from '@/types';

interface AgentGridProps {
  agents: Agent[];
  summary: AgentSummary;
}

export function AgentGrid({ agents, summary }: AgentGridProps) {
  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: 'Running', value: summary.running, color: 'text-emerald-400', icon: Activity },
          { label: 'Degraded', value: summary.degraded, color: 'text-amber-400', icon: TrendingUp },
          { label: 'Total Events', value: summary.total_events_processed.toLocaleString(), color: 'text-rail-active', icon: TrendingUp },
          { label: 'Avg Response', value: `${summary.avg_response_time_ms}ms`, color: 'text-rail-text', icon: Clock },
        ].map((item) => (
          <div key={item.label} className="control-panel p-3">
            <div className="flex items-center gap-2">
              <item.icon className={`w-3.5 h-3.5 ${item.color}`} />
              <span className="text-[10px] text-rail-text-muted uppercase">{item.label}</span>
            </div>
            <p className={`text-xl font-mono font-bold mt-1 ${item.color}`}>{item.value}</p>
          </div>
        ))}
      </div>

      {/* Agent Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {agents.map((agent, index) => (
          <AgentCard key={agent.name} agent={agent} index={index} />
        ))}
      </div>
    </div>
  );
}
