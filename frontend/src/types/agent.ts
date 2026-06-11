export type AgentName =
  | 'PlatformAllocationAgent'
  | 'RouteAllocationAgent'
  | 'SignalControlAgent'
  | 'LoopLineAgent'
  | 'DelayPropagationAgent'
  | 'ConflictDetectionAgent'
  | 'TrainDispatchAgent'
  | 'MaintenanceAgent'
  | 'EmergencyResponseAgent'
  | 'NetworkMonitoringAgent';

export type AgentStatus = 'RUNNING' | 'DEGRADED' | 'STOPPED' | 'ERROR' | 'INITIALIZING';

export interface Agent {
  name: AgentName;
  status: AgentStatus;
  events_processed: number;
  events_per_minute: number;
  avg_response_time_ms: number;
  last_event_at: string | null;
  last_event_type: string | null;
  subscribed_events: string[];
  uptime_seconds: number;
  error_count: number;
  memory_usage_mb: number;
}

export interface AgentActivity {
  agent_name: AgentName;
  event_type: string;
  timestamp: string;
  details: string;
  processing_time_ms: number;
  success: boolean;
}

export interface AgentSummary {
  total_agents: number;
  running: number;
  degraded: number;
  stopped: number;
  error: number;
  total_events_processed: number;
  avg_response_time_ms: number;
}

export const AGENT_DISPLAY_NAMES: Record<AgentName, string> = {
  PlatformAllocationAgent: 'Platform Allocation',
  RouteAllocationAgent: 'Route Allocation',
  SignalControlAgent: 'Signal Control',
  LoopLineAgent: 'Loop Line',
  DelayPropagationAgent: 'Delay Propagation',
  ConflictDetectionAgent: 'Conflict Detection',
  TrainDispatchAgent: 'Train Dispatch',
  MaintenanceAgent: 'Maintenance',
  EmergencyResponseAgent: 'Emergency Response',
  NetworkMonitoringAgent: 'Network Monitoring',
};

export const AGENT_DESCRIPTIONS: Record<AgentName, string> = {
  PlatformAllocationAgent: 'Finds optimal platforms, matches train length, checks maintenance',
  RouteAllocationAgent: 'Finds shortest valid routes via graph traversal',
  SignalControlAgent: 'Checks track occupancy, controls signal states',
  LoopLineAgent: 'Diverts slower trains, prioritizes faster trains',
  DelayPropagationAgent: 'Predicts downstream delays using decay model',
  ConflictDetectionAgent: 'Scans for track occupancy and route overlaps',
  TrainDispatchAgent: 'Priority queue for train movement authority',
  MaintenanceAgent: 'Monitors maintenance blocks, generates alerts',
  EmergencyResponseAgent: 'Handles failures, stops trains, blocks routes',
  NetworkMonitoringAgent: 'Maintains digital twin state, aggregates metrics',
};
