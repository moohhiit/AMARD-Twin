import { useState } from 'react';
import { motion } from 'framer-motion';
import { TrafficCone } from 'lucide-react';
import { useNetworkStateQuery } from '@/hooks/useNetworkState';
import { SignalPanel } from '@/components/signals/SignalPanel';
import { LoadingState } from '@/components/shared/LoadingState';
import { ErrorState } from '@/components/shared/ErrorState';
import { Input } from '@/components/ui/input';
import type { Signal } from '@/types';

export default function SignalsPage() {
  const { data: networkState, isLoading, error, refetch } = useNetworkStateQuery(5000);
  const [searchQuery, setSearchQuery] = useState('');

  const signals: Signal[] = (networkState?.signals || []).map((s) => ({
    signal_id: s.signal_id,
    state: s.state as Signal['state'],
    type: 'HOME' as Signal['type'],
    controlled_track: s.controlled_track,
    next_track: null,
    position_km: 0,
    station_id: null,
    auto_mode: true,
    last_changed: new Date().toISOString(),
    timestamp: new Date().toISOString(),
  }));

  const filteredSignals = signals.filter(
    (s) =>
      searchQuery === '' ||
      s.signal_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.controlled_track.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <TrafficCone className="w-5 h-5 text-rail-active" />
          <div>
            <h1 className="text-lg font-bold text-rail-text">Signals</h1>
            <p className="text-xs text-rail-text-muted">Signal control and monitoring</p>
          </div>
        </div>
        <Input
          placeholder="Search signals..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-56 bg-rail-surface border-rail-border text-rail-text placeholder:text-rail-text-dim"
        />
      </div>

      {isLoading ? (
        <LoadingState fullPage />
      ) : error ? (
        <ErrorState message="Failed to load signals" onRetry={refetch} fullPage />
      ) : (
        <SignalPanel signals={filteredSignals} />
      )}
    </motion.div>
  );
}
