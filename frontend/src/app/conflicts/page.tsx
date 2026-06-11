import { useEffect } from 'react';
import { motion } from 'framer-motion';
import { AlertTriangle } from 'lucide-react';
import { useEventStore } from '@/store';
import { useNetworkStateQuery } from '@/hooks/useNetworkState';
import { ConflictCenter } from '@/components/conflicts/ConflictCenter';
import { LoadingState } from '@/components/shared/LoadingState';
import { ErrorState } from '@/components/shared/ErrorState';
import type { RouteConflict } from '@/types';

export default function ConflictsPage() {
  const { data: networkState, isLoading, error, refetch } = useNetworkStateQuery(5000);
  const conflicts = useEventStore((s) => s.conflicts);
  const setConflicts = useEventStore((s) => s.setConflicts);

  // Extract conflicts from network state events
  useEffect(() => {
    if (networkState?.events) {
      const conflictEvents = networkState.events
        .filter((e) => e.event_type === 'ROUTE_CONFLICT')
        .map((e): RouteConflict => ({
          conflict_type: 'TRACK_OCCUPANCY',
          track_id: e.location || 'unknown',
          severity: (e.severity as RouteConflict['severity']) || 'MEDIUM',
          train_a: e.source_train || null,
          train_b: null,
          description: e.description || 'Route conflict detected',
          timestamp: e.timestamp,
        }));
      setConflicts(conflictEvents);
    }
  }, [networkState, setConflicts]);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
      <div className="flex items-center gap-3">
        <AlertTriangle className="w-5 h-5 text-red-400" />
        <div>
          <h1 className="text-lg font-bold text-rail-text">Conflict Center</h1>
          <p className="text-xs text-rail-text-muted">Route, track, and junction conflicts</p>
        </div>
      </div>

      {isLoading ? (
        <LoadingState fullPage />
      ) : error ? (
        <ErrorState message="Failed to load conflicts" onRetry={refetch} fullPage />
      ) : (
        <ConflictCenter conflicts={conflicts} />
      )}
    </motion.div>
  );
}
