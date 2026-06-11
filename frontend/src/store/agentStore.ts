import { create } from 'zustand';
import type { Agent, AgentSummary, AgentActivity } from '@/types';

interface AgentStore {
  agents: Agent[];
  activities: AgentActivity[];
  summary: AgentSummary;
  loading: boolean;
  error: string | null;

  setAgents: (agents: Agent[]) => void;
  updateAgent: (agent: Agent) => void;
  setActivities: (activities: AgentActivity[]) => void;
  addActivity: (activity: AgentActivity) => void;
  setSummary: (summary: AgentSummary) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
}

const defaultSummary: AgentSummary = {
  total_agents: 0,
  running: 0,
  degraded: 0,
  stopped: 0,
  error: 0,
  total_events_processed: 0,
  avg_response_time_ms: 0,
};

export const useAgentStore = create<AgentStore>((set) => ({
  agents: [],
  activities: [],
  summary: defaultSummary,
  loading: false,
  error: null,

  setAgents: (agents) => set({ agents, summary: computeSummary(agents) }),

  updateAgent: (agent) =>
    set((state) => {
      const exists = state.agents.find((a) => a.name === agent.name);
      const agents = exists
        ? state.agents.map((a) => (a.name === agent.name ? { ...a, ...agent } : a))
        : [...state.agents, agent];
      return { agents, summary: computeSummary(agents) };
    }),

  setActivities: (activities) => set({ activities }),

  addActivity: (activity) =>
    set((state) => ({
      activities: [activity, ...state.activities].slice(0, 200),
    })),

  setSummary: (summary) => set({ summary }),
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),
}));

function computeSummary(agents: Agent[]): AgentSummary {
  const total_agents = agents.length;
  const running = agents.filter((a) => a.status === 'RUNNING').length;
  const degraded = agents.filter((a) => a.status === 'DEGRADED').length;
  const stopped = agents.filter((a) => a.status === 'STOPPED').length;
  const error = agents.filter((a) => a.status === 'ERROR').length;
  const total_events_processed = agents.reduce((sum, a) => sum + a.events_processed, 0);
  const avg_response_time_ms =
    total_agents > 0
      ? Math.round(agents.reduce((sum, a) => sum + a.avg_response_time_ms, 0) / total_agents)
      : 0;
  return { total_agents, running, degraded, stopped, error, total_events_processed, avg_response_time_ms };
}
