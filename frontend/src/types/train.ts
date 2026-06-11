export type TrainStatus = 'RUNNING' | 'DELAYED' | 'STOPPED' | 'EMERGENCY' | 'APPROACHING' | 'MAINTENANCE';

export type Direction = 'NORTH' | 'SOUTH' | 'EAST' | 'WEST' | 'UP' | 'DOWN';

export interface Train {
  train_number: string;
  name: string;
  status: TrainStatus;
  speed: number;
  direction: Direction;
  current_track: string;
  next_track: string | null;
  route_id: string | null;
  progress_on_track: number;
  train_length_m: number;
  current_platform: string | null;
  zone_id: string | null;
  delay_minutes: number;
  timestamp: string;
}

export interface TrainPosition {
  train_number: string;
  track_id: string;
  speed: number;
  progress: number;
  direction: Direction;
  timestamp: string;
}

export interface TrainGraph {
  train: Train;
  current_track: {
    track_id: string;
    length_km: number;
    speed_limit: number;
    status: string;
  } | null;
  next_track: {
    track_id: string;
    length_km: number;
    speed_limit: number;
  } | null;
  zone: {
    zone_id: string;
    name: string;
    congestion_level: number;
  } | null;
  route: {
    route_id: string;
    name: string;
    priority: number;
  } | null;
  platform: {
    platform_id: string;
    platform_number: string;
    station_name: string;
  } | null;
}

export interface TrainCreatePayload {
  train_number: string;
  name: string;
  status?: TrainStatus;
  speed?: number;
  direction?: Direction;
  current_track?: string;
  train_length_m?: number;
}

export interface TrainUpdatePayload {
  status?: TrainStatus;
  speed?: number;
  direction?: Direction;
  current_track?: string;
  route_id?: string | null;
  progress_on_track?: number;
}

export interface TrainPositionPayload {
  track_id: string;
  speed: number;
  progress: number;
}

export interface TrainSummary {
  total: number;
  running: number;
  delayed: number;
  stopped: number;
  emergency: number;
  avg_speed: number;
}
