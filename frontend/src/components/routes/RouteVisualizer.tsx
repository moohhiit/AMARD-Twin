import { useState } from 'react';
import { motion } from 'framer-motion';
import { Route, MapPin, ArrowRight, Clock, Gauge } from 'lucide-react';
import { routeApi } from '@/services/api';
import { LoadingState } from '@/components/shared/LoadingState';
import { ErrorState } from '@/components/shared/ErrorState';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface RoutePlan {
  path: string[];
  total_distance_km: number;
  estimated_time_min: number;
  speed_limits: Record<string, number>;
  blockages: string[];
}

export function RouteVisualizer() {
  const [startTrack, setStartTrack] = useState('');
  const [endTrack, setEndTrack] = useState('');
  const [plan, setPlan] = useState<RoutePlan | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handlePlan = async () => {
    if (!startTrack || !endTrack) return;
    setLoading(true);
    setError(null);
    try {
      const result = await routeApi.plan({
        start_track: startTrack,
        end_track: endTrack,
        respect_blocks: true,
      });
      setPlan(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to plan route');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="control-panel">
      <div className="control-panel-header">
        <span className="control-panel-title flex items-center gap-2">
          <Route className="w-4 h-4 text-rail-active" />
          Route Planner
        </span>
      </div>
      <div className="control-panel-body space-y-4">
        <div className="flex items-end gap-3">
          <div className="flex-1">
            <label className="text-[10px] text-rail-text-muted uppercase tracking-wider block mb-1">Start Track</label>
            <Input
              value={startTrack}
              onChange={(e) => setStartTrack(e.target.value)}
              placeholder="e.g., T-001"
              className="bg-rail-surface border-rail-border text-rail-text"
            />
          </div>
          <ArrowRight className="w-4 h-4 text-rail-text-dim mb-3" />
          <div className="flex-1">
            <label className="text-[10px] text-rail-text-muted uppercase tracking-wider block mb-1">End Track</label>
            <Input
              value={endTrack}
              onChange={(e) => setEndTrack(e.target.value)}
              placeholder="e.g., T-010"
              className="bg-rail-surface border-rail-border text-rail-text"
            />
          </div>
          <Button onClick={handlePlan} disabled={loading || !startTrack || !endTrack} className="mb-0.5">
            Plan Route
          </Button>
        </div>

        {loading && <LoadingState message="Calculating route..." />}
        {error && <ErrorState message={error} onRetry={handlePlan} />}

        {plan && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-rail-surface rounded-md p-3 text-center">
                <Gauge className="w-4 h-4 text-rail-active mx-auto mb-1" />
                <p className="text-lg font-mono font-bold text-rail-text">{plan.total_distance_km}km</p>
                <p className="text-[10px] text-rail-text-muted">Distance</p>
              </div>
              <div className="bg-rail-surface rounded-md p-3 text-center">
                <Clock className="w-4 h-4 text-rail-active mx-auto mb-1" />
                <p className="text-lg font-mono font-bold text-rail-text">{plan.estimated_time_min}m</p>
                <p className="text-[10px] text-rail-text-muted">Est. Time</p>
              </div>
              <div className="bg-rail-surface rounded-md p-3 text-center">
                <MapPin className="w-4 h-4 text-rail-active mx-auto mb-1" />
                <p className="text-lg font-mono font-bold text-rail-text">{plan.path.length}</p>
                <p className="text-[10px] text-rail-text-muted">Segments</p>
              </div>
            </div>

            <div>
              <h4 className="text-xs font-semibold text-rail-text mb-2">Route Path</h4>
              <div className="flex items-center gap-1 flex-wrap">
                {plan.path.map((track, i) => (
                  <div key={track} className="flex items-center gap-1">
                    <span className={`px-2 py-1 rounded text-[10px] font-mono font-medium ${
                      plan.blockages.includes(track) ? 'bg-red-400/10 text-red-400' : 'bg-rail-active/10 text-rail-active'
                    }`}>
                      {track}
                    </span>
                    {i < plan.path.length - 1 && <ArrowRight className="w-3 h-3 text-rail-text-dim" />}
                  </div>
                ))}
              </div>
            </div>

            {plan.blockages.length > 0 && (
              <div className="bg-red-400/5 border border-red-400/20 rounded-md p-3">
                <h4 className="text-xs font-semibold text-red-400 mb-1">Blocked Tracks</h4>
                <div className="flex gap-1 flex-wrap">
                  {plan.blockages.map((b) => (
                    <span key={b} className="text-[10px] font-mono text-red-400 bg-red-400/10 px-1.5 py-0.5 rounded">
                      {b}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        )}
      </div>
    </div>
  );
}
