import { useState } from 'react';
import { motion } from 'framer-motion';
import { SquareStack } from 'lucide-react';
import { useNetworkStateQuery } from '@/hooks/useNetworkState';
import { PlatformBoard } from '@/components/platforms/PlatformBoard';
import { LoadingState } from '@/components/shared/LoadingState';
import { ErrorState } from '@/components/shared/ErrorState';
import { Input } from '@/components/ui/input';
import type { Platform } from '@/types';

export default function PlatformsPage() {
  const { data: networkState, isLoading, error, refetch } = useNetworkStateQuery(5000);
  const [searchQuery, setSearchQuery] = useState('');

  const platforms: Platform[] = (networkState?.platforms || []).map((p) => ({
    platform_id: p.platform_id,
    platform_number: p.platform_number,
    name: `Platform ${p.platform_number}`,
    status: p.status as Platform['status'],
    length_m: 0,
    station_id: p.station_id,
    station_name: '',
    connected_track: p.connected_track || null,
    current_train: null,
    occupancy_percentage: p.status === 'OCCUPIED' ? 100 : p.status === 'RESERVED' ? 50 : 0,
    timestamp: new Date().toISOString(),
  }));

  const filteredPlatforms = platforms.filter(
    (p) =>
      searchQuery === '' ||
      p.platform_number.includes(searchQuery) ||
      p.station_id.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <SquareStack className="w-5 h-5 text-rail-active" />
          <div>
            <h1 className="text-lg font-bold text-rail-text">Platforms</h1>
            <p className="text-xs text-rail-text-muted">Platform occupancy status</p>
          </div>
        </div>
        <Input
          placeholder="Search platforms..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-56 bg-rail-surface border-rail-border text-rail-text placeholder:text-rail-text-dim"
        />
      </div>

      {isLoading ? (
        <LoadingState fullPage />
      ) : error ? (
        <ErrorState message="Failed to load platforms" onRetry={refetch} fullPage />
      ) : (
        <PlatformBoard platforms={filteredPlatforms} />
      )}
    </motion.div>
  );
}
