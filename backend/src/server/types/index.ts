// ─── CORE STATUS TYPES ────────────────────────────────────────────────────────
export type TrainStatus =
  | "RUNNING" | "STOPPED" | "WAITING" | "ARRIVED"
  | "REROUTING" | "DELAYED" | "ON_LOOP" | "BRAKING";

export type TrackStatus   = "OPEN" | "CONGESTED" | "BLOCKED";
export type SignalState   = "GREEN" | "YELLOW" | "RED";
export type WeatherType   = "CLEAR" | "RAIN" | "FOG" | "STORM";
export type TrainPriority = "SUPERFAST" | "EXPRESS" | "PASSENGER" | "FREIGHT" | "LOCAL";
export type SegmentDirection = "ONE_WAY" | "BIDIRECTIONAL";

export type EventType =
  | "DEPARTURE" | "ARRIVAL" | "REROUTE" | "PLATFORM_ASSIGNED"
  | "CONGESTION_DETECTED" | "DELAY_UPDATED" | "TRACK_BLOCKED"
  | "SPEED_CHANGE" | "WAITING" | "RESUMED" | "SIGNAL_CHANGE"
  | "WEATHER_CHANGE" | "LOOP_ENTRY" | "LOOP_EXIT" | "COLLISION_WARNING";

export type EventSource       = "ENGINE" | "REROUTING_AGENT" | "PLATFORM_AGENT" | "SYSTEM" | "WEATHER_ENGINE" | "SIGNAL_SYSTEM";
export type CongestionSeverity = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
export type AgentType         = "REROUTING" | "PLATFORM";
export type PlatformStatus    = "OCCUPIED" | "FREE" | "RESERVED";

// ─── POSITION ─────────────────────────────────────────────────────────────────
export interface Position {
  from_node: string;
  to_node:   string;
  progress_percent: number;
  lat: number;
  lng: number;
}

// ─── WEATHER ──────────────────────────────────────────────────────────────────
export interface WeatherCondition {
  type:              WeatherType;
  speed_multiplier:  number;   // 1.0 = no effect, 0.6 = 40% slower
  risk_level:        "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  delay_probability: number;   // 0–1
  braking_multiplier: number;  // 1.0 = normal, 1.5 = 50% longer braking dist
  visibility_km:     number;
  description:       string;
}

// ─── SIGNAL ───────────────────────────────────────────────────────────────────
export interface TrackSignal {
  segment_id: string;
  state:      SignalState;
  reason:     string;
  set_at:     number; // ms timestamp
}

// ─── TRACK SEGMENT ────────────────────────────────────────────────────────────
export interface TrackSegment {
  segment_id:      string;
  from:            string;
  to:              string;
  distance_km:     number;
  max_speed_kmh:   number;
  capacity:        number;
  status:          TrackStatus;
  direction:       SegmentDirection;
  current_trains:  number;
  congestion_level: number;
  // New fields
  weather:         WeatherCondition;
  signal:          SignalState;
  is_loop_line:    boolean;
}

// ─── SCHEDULE STOP ────────────────────────────────────────────────────────────
export interface ScheduleStop {
  station_id:          string;
  scheduled_arrival:   string;   // "HH:MM" 24h
  scheduled_departure: string;   // "HH:MM" 24h
  platform_preference: number | null;
  halt_minutes:        number;
  actual_arrival?:     string;
  actual_departure?:   string;
  delay_minutes?:      number;
}

// ─── TRAIN ────────────────────────────────────────────────────────────────────
export interface Train {
  train_id: string;
  name:     string;
  type:     string;
  priority: TrainPriority;
  length_meters:     number;
  max_speed_kmh:     number;
  current_speed_kmh: number;
  target_speed_kmh:  number;
  braking_distance_km: number;
  status:    TrainStatus;
  route:     string[];
  schedule:  ScheduleStop[];
  current_segment_index: number;
  position:  Position;
  scheduled_departure: Date;
  actual_departure:    Date;
  delay_minutes:       number;
  assigned_platform:   number | null;
  current_station:     string | null;
  reroute_count:       number;
  on_loop_line:        boolean;
  last_agent_decision: {
    agent:     AgentType;
    timestamp: Date;
    reason:    string;
  } | null;
  color:      string;
  created_at: Date;
  updated_at: Date;
}

// ─── PLATFORM ─────────────────────────────────────────────────────────────────
export interface Platform {
  number:        number;
  status:        PlatformStatus;
  train_id:      string | null;
  length_meters: number;
  minutes_free:  number;
  reserved_for?: string;
  free_at_time?: string; // ISO string
}

// ─── AGENT DECISIONS ─────────────────────────────────────────────────────────
export interface RerouteDecision {
  action:       "REROUTE";
  new_route:    string[];
  new_segments: string[];
  reason:       string;
  trigger:      "CONGESTION" | "BLOCKED" | "DELAY_THRESHOLD" | "WEATHER" | "SIGNAL_RED";
  estimated_savings_min: number;
}

export interface WaitDecision {
  action:           "WAIT";
  station_id:       string;
  reason:           string;
  retry_in_seconds: number;
}

export interface LoopDecision {
  action:    "DIVERT_TO_LOOP";
  loop_segment: string;
  reason:    string;
  resume_after_seconds: number;
}

export interface PlatformDecision {
  action:          "ASSIGN";
  station_id:      string;
  platform_number: number;
  score_breakdown: PlatformScore;
  reason:          string;
  dwell_seconds:   number;
}

export interface PlatformScore {
  waiting_time_score:   number;
  congestion_score:     number;
  length_compatibility: number;
  proximity_score:      number;
  priority_score:       number;
  total_score:          number;
}

// ─── SOCKET EVENTS ────────────────────────────────────────────────────────────
export interface TrainUpdateEvent {
  train_id:            string;
  timestamp:           string;
  position:            Position;
  speed_kmh:           number;
  target_speed_kmh:    number;
  status:              TrainStatus;
  delay_minutes:       number;
  current_segment:     string;
  next_station:        string;
  distance_to_next_km: number;
  signal:              SignalState;
  weather:             WeatherType;
  on_loop_line:        boolean;
}

export interface TrainReroutedEvent {
  train_id:       string;
  timestamp:      string;
  old_route:      string[];
  new_route:      string[];
  old_segments:   string[];
  new_segments:   string[];
  reason:         string;
  trigger:        "CONGESTION" | "BLOCKED" | "DELAY_THRESHOLD" | "WEATHER" | "SIGNAL_RED";
  estimated_delay_reduction_min: number;
  agent_processing_ms:           number;
}

export interface PlatformAssignedEvent {
  train_id:        string;
  station_id:      string;
  station_name:    string;
  platform_number: number;
  assigned_by:     "PLATFORM_AGENT";
  eta:             string;
  free_at:         string;
  score_breakdown: PlatformScore;
}

export interface CongestionAlertEvent {
  segment_id:         string;
  from_node:          string;
  to_node:            string;
  train_count:        number;
  capacity:           number;
  severity:           CongestionSeverity;
  affected_trains:    string[];
  recommended_action: "REROUTE" | "SLOW_DOWN" | "WAIT";
}

export interface WeatherUpdateEvent {
  segment_id: string;
  weather:    WeatherCondition;
  timestamp:  string;
}

export interface SignalChangeEvent {
  segment_id: string;
  old_state:  SignalState;
  new_state:  SignalState;
  reason:     string;
  timestamp:  string;
}

export interface CollisionWarningEvent {
  segment_id:     string;
  train_ids:      string[];
  distance_km:    number;
  severity:       "WARNING" | "CRITICAL";
  action_taken:   string;
  timestamp:      string;
}

export interface PlatformStatusEvent {
  station_id:  string;
  platforms:   {
    number:       number;
    status:       PlatformStatus;
    train_id:     string | null;
    free_at_time: string | null;
  }[];
  timestamp:   string;
}

export interface PathResult {
  path:              string[];
  segments:          string[];
  total_distance_km: number;
  estimated_time_min: number;
  weighted_time:     number;
}

export interface ApiError {
  statusCode: number;
  code:       string;
  message:    string;
  details?:   Record<string, unknown>;
}