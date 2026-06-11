import { useEffect } from 'react';
import { useNetworkMetricsQuery } from '@/hooks/useNetworkState';
import { useTrainsQuery } from '@/hooks/useTrainData';
import { useNetworkStateQuery } from '@/hooks/useNetworkState';
import { useTrainStore, usePlatformStore, useSignalStore, useNetworkStore, useEventStore } from '@/store';
import { useRealtimeEvent } from '@/hooks/useRealtimeUpdates';
import { trainApi, platformApi } from '@/services/api';
import { RailwayMap } from '@/components/control-center/RailwayMap';
import { KPIGrid } from '@/components/dashboard/KPIGrid';
import { RealtimeFeed } from '@/components/dashboard/RealtimeFeed';
import { NetworkHealth } from '@/components/dashboard/NetworkHealth';
import { SystemOverview } from '@/components/dashboard/SystemOverview';
import { motion } from 'framer-motion';
import { LoadingState } from '@/components/shared/LoadingState';
import { ErrorState } from '@/components/shared/ErrorState';
import type { Train, NetworkMetrics } from '@/types';

export default function DashboardPage() {
  const { data: metrics, isLoading: metricsLoading, error: metricsError, refetch: refetchMetrics } = useNetworkMetricsQuery(5000);
  const { data: trainsData } = useTrainsQuery(10000);
  const { data: networkState } = useNetworkStateQuery(10000);

  const setTrains = useTrainStore((s) => s.setTrains);
  const setPlatforms = usePlatformStore((s) => s.setPlatforms);
  const setSignals = useSignalStore((s) => s.setSignals);
  const setMetrics = useNetworkStore((s) => s.setMetrics);
  const addEvent = useEventStore((s) => s.addEvent);

  // Sync TanStack Query data to Zustand stores
  useEffect(() => {
    if (trainsData) setTrains(trainsData);
  }, [trainsData, setTrains]);

  useEffect(() => {
    if (networkState?.platforms) {
      const mapped = networkState.platforms.map((p) => ({
        platform_id: p.platform_id,
        platform_number: p.platform_number,
        name: `Platform ${p.platform_number}`,
        status: p.status as import('@/types').Platform['status'],
        length_m: 0,
        station_id: p.station_id,
        station_name: '',
        connected_track: p.connected_track || null,
        current_train: null,
        occupancy_percentage: p.status === 'OCCUPIED' ? 100 : p.status === 'RESERVED' ? 50 : 0,
        timestamp: new Date().toISOString(),
      }));
      setPlatforms(mapped);
    }
  }, [networkState, setPlatforms]);

  useEffect(() => {
    if (networkState?.signals) {
      const mapped = networkState.signals.map((s) => ({
        signal_id: s.signal_id,
        state: s.state as import('@/types').Signal['state'],
        type: 'HOME' as import('@/types').Signal['type'],
        controlled_track: s.controlled_track,
        next_track: null as string | null,
        position_km: 0,
        station_id: null as string | null,
        auto_mode: true,
        last_changed: new Date().toISOString(),
        timestamp: new Date().toISOString(),
      }));
      setSignals(mapped);
    }
  }, [networkState, setSignals]);

  useEffect(() => {
    if (metrics) setMetrics(metrics);
  }, [metrics, setMetrics]);

  // WebSocket event handling
  useRealtimeEvent('TRAIN_APPROACHING', (data) => {
    if (data.train_number) {
      trainApi.get(data.train_number as string).then((train) => {
        useTrainStore.getState().addOrUpdateTrain(train as Train);
      }).catch(() => {});
    }
  });

  useRealtimeEvent('TRAIN_DELAYED', (data) => {
    if (data.train_number) {
      useTrainStore.getState().updateTrainStatus(
        data.train_number as string,
        'DELAYED',
        (data.delay_minutes as number) || 0
      );
    }
  });

  useRealtimeEvent('PLATFORM_ASSIGNED', (data) => {
    if (data.platform_id) {
      platformApi.get(data.platform_id as string).then((platform) => {
        usePlatformStore.getState().addOrUpdatePlatform(platform);
      }).catch(() => {});
    }
  });

  useRealtimeEvent('SIGNAL_GREEN', (data) => {
    if (data.signal_id) {
      useSignalStore.getState().updateSignalState(data.signal_id as string, 'GREEN');
    }
  });

  useRealtimeEvent('SIGNAL_RED', (data) => {
    if (data.signal_id) {
      useSignalStore.getState().updateSignalState(data.signal_id as string, 'RED');
    }
  });

  useRealtimeEvent('ROUTE_CONFLICT', (data) => {
    addEvent({
      event_id: `conflict-${Date.now()}`,
      event_type: 'ROUTE_CONFLICT',
      severity: (data.severity as string) === 'CRITICAL' ? 'CRITICAL' : 'HIGH',
      timestamp: new Date().toISOString(),
      resolved: false,
      source_train: (data.train_a as string) || null,
      delay_minutes: null,
      location: (data.track_id as string) || null,
      description: `Route conflict on ${data.track_id}: ${data.train_a} vs ${data.train_b}`,
      data: data as Record<string, unknown>,
    });
  });

  useRealtimeEvent('EMERGENCY_TRIGGERED', (data) => {
    addEvent({
      event_id: `emergency-${Date.now()}`,
      event_type: 'EMERGENCY_TRIGGERED',
      severity: 'CRITICAL',
      timestamp: new Date().toISOString(),
      resolved: false,
      source_train: null,
      delay_minutes: null,
      location: (data.location as string) || null,
      description: `Emergency: ${data.emergency_type} at ${data.location}`,
      data: data as Record<string, unknown>,
    });
  });

  if (metricsLoading) {
    return (
      <div className="space-y-4">
        <h1 className="text-xl font-bold text-rail-text">Control Center</h1>
        <LoadingState fullPage />
      </div>
    );
  }

  if (metricsError) {
    return (
      <div className="space-y-4">
        <h1 className="text-xl font-bold text-rail-text">Control Center</h1>
        <ErrorState message="Failed to load metrics" onRetry={refetchMetrics} fullPage />
      </div>
    );
  }

  const safeMetrics: NetworkMetrics | null = metrics ?? null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-4"
    >
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-rail-text">Railway Control Center</h1>
          <p className="text-xs text-rail-text-muted mt-0.5">Real-time digital twin monitoring</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1.5 text-[10px] text-rail-text-muted">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            Live
          </span>
        </div>
      </div>

      <KPIGrid metrics={safeMetrics} />

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        <div className="lg:col-span-3">
          <RailwayMap className="h-[600px]" />
        </div>
        <div className="space-y-4">
          <RealtimeFeed />
          <NetworkHealth />
          <SystemOverview metrics={safeMetrics} />
        </div>
      </div>
    </motion.div>
  );
}
