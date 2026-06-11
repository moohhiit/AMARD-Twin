export type SignalState = 'GREEN' | 'RED' | 'YELLOW' | 'FLASHING' | 'OFF';
export type SignalType = 'HOME' | 'DISTANT' | 'STARTER' | 'ADVANCED' | 'SHUNTING';

export interface Signal {
  signal_id: string;
  state: SignalState;
  type: SignalType;
  controlled_track: string;
  next_track: string | null;
  position_km: number;
  station_id: string | null;
  auto_mode: boolean;
  last_changed: string;
  timestamp: string;
}

export interface SignalUpdate {
  signal_id: string;
  new_state: SignalState;
  reason?: string;
}

export interface SignalSafetyCheck {
  signal_id: string;
  track_occupied: boolean;
  maintenance_active: boolean;
  downstream_blocked: boolean;
  junction_fault: boolean;
  safe_to_proceed: boolean;
  warnings: string[];
}

export interface SignalSummary {
  total: number;
  green: number;
  red: number;
  yellow: number;
  flashing: number;
  off: number;
}

export interface SignalCreatePayload {
  signal_id: string;
  type: SignalType;
  controlled_track: string;
  next_track?: string;
  position_km: number;
  station_id?: string;
  auto_mode?: boolean;
}

export interface SignalStatePayload {
  state: SignalState;
  reason?: string;
}
