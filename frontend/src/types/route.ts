export type RouteType = 'MAIN' | 'DIVERSION' | 'LOOP' | 'SHUNTING' | 'EMERGENCY';
export type RoutePriority = 'CRITICAL' | 'HIGH' | 'NORMAL' | 'LOW';

export interface Route {
  route_id: string;
  name: string;
  type: RouteType;
  priority: RoutePriority;
  track_sequence: string[];
  total_distance_km: number;
  estimated_time_min: number;
  active: boolean;
  timestamp: string;
}

export interface RoutePlan {
  start_track: string;
  end_track: string;
  path: string[];
  alternatives: string[][];
  total_distance_km: number;
  estimated_time_min: number;
  speed_limits: Record<string, number>;
  blockages: string[];
}

export interface RouteReservation {
  route_id: string;
  train_number: string;
  reserved_tracks: string[];
  reservation_time: string;
  expires_at: string;
}

export interface RouteClearPayload {
  reason: string;
}

export interface RouteConflict {
  conflict_type: 'TRACK_OCCUPANCY' | 'ROUTE_OVERLAP' | 'JUNCTION' | 'HEADWAY';
  track_id: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  train_a: string | null;
  train_b: string | null;
  description: string;
  timestamp: string;
}

export interface RouteCreatePayload {
  route_id: string;
  name: string;
  type: RouteType;
  priority: RoutePriority;
  track_sequence: string[];
}

export interface RoutePlanPayload {
  start_track: string;
  end_track: string;
  respect_blocks?: boolean;
  train_length_m?: number;
}

export interface RouteReservePayload {
  route_id: string;
  train_number: string;
}
