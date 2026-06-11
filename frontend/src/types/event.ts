export type EventType =
  | 'TRAIN_APPROACHING'
  | 'PLATFORM_ASSIGNED'
  | 'ROUTE_ASSIGNED'
  | 'ROUTE_CLEAR'
  | 'ROUTE_CONFLICT'
  | 'SIGNAL_GREEN'
  | 'SIGNAL_RED'
  | 'TRAIN_DELAYED'
  | 'MAINTENANCE_REQUIRED'
  | 'EMERGENCY_TRIGGERED'
  | 'MOVEMENT_AUTHORITY_GRANTED';

export type EventSeverity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO';

export interface RailwayEvent {
  event_id: string;
  event_type: EventType;
  severity: EventSeverity;
  timestamp: string;
  resolved: boolean;
  source_train: string | null;
  delay_minutes: number | null;
  location: string | null;
  description: string;
  data: Record<string, unknown>;
}

export interface EventSubscription {
  topics: string[];
}

export interface WebSocketMessage {
  action: 'subscribe' | 'unsubscribe' | 'ping';
  topics?: string[];
}

export interface WebSocketEventPayload {
  event_type: EventType;
  timestamp: string;
  data: Record<string, unknown>;
}

export interface EventStats {
  total_events: number;
  by_type: Record<EventType, number>;
  by_severity: Record<EventSeverity, number>;
  unresolved_count: number;
  avg_delay_minutes: number;
}

export interface DelayPrediction {
  train_number: string;
  predicted_delay_minutes: number;
  confidence: number;
  affected_tracks: string[];
  affected_stations: string[];
  cascade_risk: 'HIGH' | 'MEDIUM' | 'LOW';
}

export interface CongestionInfo {
  zone_id: string;
  zone_name: string;
  congestion_level: number;
  avg_speed: number;
  train_count: number;
  risk_score: number;
}

export interface ETAInfo {
  train_number: string;
  destination_track: string;
  estimated_arrival: string;
  remaining_distance_km: number;
  estimated_time_min: number;
}

export interface DelayReport {
  delayed_trains: Array<{
    train_number: string;
    delay_minutes: number;
    reason: string | null;
    location: string | null;
  }>;
  total_delay_minutes: number;
  affected_locations: string[];
  avg_delay_minutes: number;
  timestamp: string;
}

export interface MaintenanceBlock {
  block_id: string;
  track_ids: string[];
  reason: string;
  start_time: string;
  end_time: string | null;
  status: 'ACTIVE' | 'SCHEDULED' | 'CLEARED';
  urgency: 'CRITICAL' | 'HIGH' | 'NORMAL' | 'LOW';
}
