import { motion } from 'framer-motion';
import { Bot } from 'lucide-react';
import { useHealthCheckQuery } from '@/hooks/useNetworkState';
import { AgentGrid } from '@/components/agents/AgentGrid';
import { LoadingState } from '@/components/shared/LoadingState';
import { ErrorState } from '@/components/shared/ErrorState';
import { useMemo } from 'react';
import type { Agent, AgentSummary } from '@/types';

export default function AgentsPage() {
  const { data: health, isLoading, error, refetch } = useHealthCheckQuery(10000);

  const { agents, summary } = useMemo(() => {
    if (!health?.agent_states) return { agents: [] as Agent[], summary: null as AgentSummary | null };

    const agentEntries = Object.entries(health.agent_states);
    const mappedAgents: Agent[] = agentEntries.map(([name, status]) => ({
      name: name as Agent['name'],
      status: (status as string).toUpperCase() as Agent['status'],
      events_processed: 0,
      events_per_minute: 0,
      avg_response_time_ms: 0,
      last_event_at: null,
      last_event_type: null,
      subscribed_events: [],
      uptime_seconds: 0,
      error_count: 0,
      memory_usage_mb: 0,
    }));

    const summary: AgentSummary = {
      total_agents: mappedAgents.length,
      running: mappedAgents.filter((a) => a.status === 'RUNNING').length,
      degraded: mappedAgents.filter((a) => a.status === 'DEGRADED').length,
      stopped: mappedAgents.filter((a) => a.status === 'STOPPED').length,
      error: mappedAgents.filter((a) => a.status === 'ERROR').length,
      total_events_processed: 0,
      avg_response_time_ms: 0,
    };

    return { agents: mappedAgents, summary };
  }, [health]);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
      <div className="flex items-center gap-3">
        <Bot className="w-5 h-5 text-rail-active" />
        <div>
          <h1 className="text-lg font-bold text-rail-text">Agent Monitor</h1>
          <p className="text-xs text-rail-text-muted">Multi-agent system status</p>
        </div>
      </div>

      {isLoading ? (
        <LoadingState fullPage />
      ) : error ? (
        <ErrorState message="Failed to load agents" onRetry={refetch} fullPage />
      ) : summary ? (
        <AgentGrid agents={agents} summary={summary} />
      ) : null}
    </motion.div>
  );
}
