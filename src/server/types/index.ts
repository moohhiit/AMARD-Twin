export type TrainStatus = "RUNNING" | "STOPPED" | "WAITING" | "ARRIVED" | "REROUTING";
export type TrackStatus = "OPEN" | "CONGESTED" | "BLOCKED";
export type SegmentDirection = "ONE_WAY" | "BIDIRECTIONAL";
export type EventType = "DEPARTURE" | "ARRIVAL" | "REROUTE" | "PLATFORM_ASSIGNED" | "CONGESTION_DETECTED" | "DELAY_UPDATED" | "TRACK_BLOCKED" | "SPEED_CHANGE" | "WAITING" | "RESUMED";
export type EventSource = "ENGINE" | "REROUTING_AGENT" | "PLATFORM_AGENT" | "SYSTEM";
export type CongestionSeverity = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
export type AgentType = "REROUTING" | "PLATFORM";
export type PlatformStatus = "OCCUPIED" | "FREE" | "RESERVED";

export interface Position {
  from_node: string;
  to_node: string;
  progress_percent: number;
  lat: number;
  lng: number;
}

export interface Train {
  train_id: string;
  name: string;
  type: string;
  length_meters: number;
  max_speed_kmh: number;
  current_speed_kmh: number;
  status: TrainStatus;
  route: string[];
  current_segment_index: number;
  position: Position;
  scheduled_departure: Date;
  actual_departure: Date;
  delay_minutes: number;
  assigned_platform: number | null;
  current_station: string | null;
  reroute_count: number;
  last_agent_decision: {
    agent: AgentType;
    timestamp: Date;
    reason: string;
  } | null;
  color: string;
  created_at: Date;
  updated_at: Date;
}

export interface Station {
  id: string;
  name: string;
  type: "STATION" | "JUNCTION";
  lat: number;
  lng: number;
  platforms?: number;
}

export interface TrackSegment {
  segment_id: string;
  from: string;
  to: string;
  distance_km: number;
  max_speed_kmh: number;
  capacity: number;
  status: TrackStatus;
  direction: SegmentDirection;
  current_trains: number;
  congestion_level: number;
}

export interface Platform {
  number: number;
  status: PlatformStatus;
  train_id: string | null;
  length_meters: number;
  minutes_free: number;
}

export interface RerouteDecision {
  action: "REROUTE";
  new_route: string[];
  new_segments: string[];
  reason: string;
  trigger: "CONGESTION" | "BLOCKED" | "DELAY_THRESHOLD";
  estimated_savings_min: number;
}

export interface WaitDecision {
  action: "WAIT";
  station_id: string;
  reason: string;
  retry_in_seconds: number;
}

export interface PlatformDecision {
  action: "ASSIGN";
  station_id: string;
  platform_number: number;
  score_breakdown: PlatformScore;
  reason: string;
}

export interface PlatformScore {
  waiting_time_score: number;
  congestion_score: number;
  length_compatibility: number;
  proximity_score: number;
  total_score: number;
}

export interface TrainUpdateEvent {
  train_id: string;
  timestamp: string;
  position: Position;
  speed_kmh: number;
  status: TrainStatus;
  delay_minutes: number;
  current_segment: string;
  next_station: string;
  distance_to_next_km: number;
}

export interface TrainReroutedEvent {
  train_id: string;
  timestamp: string;
  old_route: string[];
  new_route: string[];
  old_segments: string[];
  new_segments: string[];
  reason: string;
  trigger: "CONGESTION" | "BLOCKED" | "DELAY_THRESHOLD";
  estimated_delay_reduction_min: number;
  agent_processing_ms: number;
}

export interface PlatformAssignedEvent {
  train_id: string;
  station_id: string;
  station_name: string;
  platform_number: number;
  assigned_by: "PLATFORM_AGENT";
  eta: string;
  score_breakdown: PlatformScore;
}

export interface CongestionAlertEvent {
  segment_id: string;
  from_node: string;
  to_node: string;
  train_count: number;
  capacity: number;
  severity: CongestionSeverity;
  affected_trains: string[];
  recommended_action: "REROUTE" | "SLOW_DOWN" | "WAIT";
}

export interface PathResult {
  path: string[];
  segments: string[];
  total_distance_km: number;
  estimated_time_min: number;
  weighted_time: number;
}

export interface ApiError {
  statusCode: number;
  code: string;
  message: string;
  details?: Record<string, unknown>;
}
