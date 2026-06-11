export type PlatformStatus = 'FREE' | 'OCCUPIED' | 'RESERVED' | 'MAINTENANCE';

export interface Platform {
  platform_id: string;
  platform_number: string;
  name: string;
  status: PlatformStatus;
  length_m: number;
  station_id: string;
  station_name: string;
  connected_track: string | null;
  current_train: string | null;
  occupancy_percentage: number;
  timestamp: string;
}

export interface PlatformAllocation {
  platform_id: string;
  train_number: string;
  station_id: string;
  allocation_time: string;
}

export interface PlatformSummary {
  total: number;
  free: number;
  occupied: number;
  reserved: number;
  maintenance: number;
  utilization_percentage: number;
}

export interface PlatformCreatePayload {
  platform_id: string;
  platform_number: string;
  name: string;
  length_m: number;
  station_id: string;
  connected_track?: string;
}

export interface PlatformAllocatePayload {
  train_number: string;
  station_id: string;
  preferred_platform?: string;
}
