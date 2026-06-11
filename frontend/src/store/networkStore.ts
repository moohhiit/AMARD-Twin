import { create } from 'zustand';
import type { NetworkMetrics, NetworkState, DigitalTwinState, HealthCheck } from '@/types';

interface NetworkStore {
  networkState: NetworkState | null;
  metrics: NetworkMetrics | null;
  digitalTwin: DigitalTwinState | null;
  health: HealthCheck | null;
  loading: boolean;
  error: string | null;
  wsConnected: boolean;

  setNetworkState: (state: NetworkState | null) => void;
  setMetrics: (metrics: NetworkMetrics | null) => void;
  setDigitalTwin: (digitalTwin: DigitalTwinState | null) => void;
  setHealth: (health: HealthCheck | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setWsConnected: (connected: boolean) => void;
  updateFromMetrics: (metrics: NetworkMetrics) => void;
}

export const useNetworkStore = create<NetworkStore>((set) => ({
  networkState: null,
  metrics: null,
  digitalTwin: null,
  health: null,
  loading: false,
  error: null,
  wsConnected: false,

  setNetworkState: (networkState) => set({ networkState }),
  setMetrics: (metrics) => set({ metrics }),
  setDigitalTwin: (digitalTwin) => set({ digitalTwin }),
  setHealth: (health) => set({ health }),
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),
  setWsConnected: (wsConnected) => set({ wsConnected }),
  updateFromMetrics: (metrics) => set({ metrics }),
}));
