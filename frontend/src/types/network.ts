export interface NetworkState {
  trains: Array<{
    train_number: string;
    status: string;
    speed: number;
    current_track: string;
    zone_id: string | null;
    route_id: string | null;
    next_track?: string;
    progress_on_track?: number;
    direction?: string;
    delay_minutes?: number;
    name?: string;
    train_length_m?: number;
    current_platform?: string | null;
  }>;
  tracks: Array<{
    track_id: string;
    length_km: number;
    speed_limit: number;
    status: string;
    risk_level: number;
    zone_id: string;
    zone_name?: string;
    connected_tracks?: string[];
    protected_by_signals?: string[];
    current_trains?: string[];
  }>;
  signals: Array<{
    signal_id: string;
    state: string;
    controlled_track: string;
  }>;
  platforms: Array<{
    platform_id: string;
    platform_number: string;
    status: string;
    station_id: string;
    connected_track?: string;
  }>;
  zones: Array<{
    zone_id: string;
    name: string;
    occupancy_level: number;
    congestion_level: number;
    risk_score: number;
  }>;
  events: Array<{
    event_id: string;
    event_type: string;
    severity: string;
    timestamp: string;
    source_train?: string | null;
    location?: string | null;
    description?: string | null;
  }>;
  stations?: Array<{
    station_id: string;
    name: string;
    city: string;
    type: string;
    platform_count?: number;
    platforms?: Array<{
      platform_id: string;
      platform_number: string;
      connected_track?: string;
    }>;
  }>;
  junctions?: Array<{
    junction_id: string;
    name: string;
    status: string;
    conflict_risk_score: number;
    connected_tracks: string[];
  }>;
  timestamp: string;
}

export interface NetworkMetrics {
  train_count: number;
  active_trains: number;
  avg_speed: number;
  signal_states: {
    green: number;
    red: number;
    yellow: number;
  };
  platform_occupancy: {
    free: number;
    occupied: number;
    reserved: number;
  };
  zone_congestion: Array<{
    zone_id: string;
    zone_name: string;
    congestion_level: number;
    train_count: number;
  }>;
  conflict_count: number;
  avg_delay_minutes: number;
  emergency_count: number;
  maintenance_blocks: number;
  timestamp: string;
}

export interface DigitalTwinState {
  event_history: Array<{
    event_id: string;
    event_type: string;
    severity: string;
    timestamp: string;
    source_train: string | null;
    description: string;
  }>;
  metrics: NetworkMetrics;
  last_updated: string;
  uptime_seconds: number;
  websocket_clients: number;
  event_queue_size: number;
}

export interface HealthCheck {
  status: 'healthy' | 'degraded' | 'unhealthy';
  neo4j_connected: boolean;
  event_bus_running: boolean;
  websocket_clients: number;
  event_queue_size: number;
  agent_states: Record<string, string>;
  timestamp: string;
  version: string;
}

export interface Station {
  station_id: string;
  name: string;
  city: string;
  type: 'MAJOR' | 'INTERMEDIATE' | 'HALT';
  latitude: number;
  longitude: number;
  platform_count: number;
  timestamp: string;
}

export interface TrackSegment {
  track_id: string;
  length_km: number;
  speed_limit: number;
  status: 'ACTIVE' | 'BLOCKED' | 'MAINTENANCE' | 'LIMITED';
  risk_level: number;
  zone_id: string;
  zone_name: string;
  connected_tracks: string[];
  protected_by_signals: string[];
  current_trains: string[];
}

export interface Junction {
  junction_id: string;
  name: string;
  status: 'ACTIVE' | 'CONFLICTED' | 'MAINTENANCE';
  conflict_risk_score: number;
  connected_tracks: string[];
}
