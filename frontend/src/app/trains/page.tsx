import { useState } from 'react';
import { motion } from 'framer-motion';
import { TrainFront } from 'lucide-react';
import { useTrainsQuery } from '@/hooks/useTrainData';
import { TrainTable } from '@/components/trains/TrainTable';
import { TrainDetailsDrawer } from '@/components/trains/TrainDetailsDrawer';
import { LoadingState } from '@/components/shared/LoadingState';
import { ErrorState } from '@/components/shared/ErrorState';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import type { Train } from '@/types';

export default function TrainsPage() {
  const { data: trains, isLoading, error, refetch } = useTrainsQuery(5000);
  const [selectedTrain, setSelectedTrain] = useState<Train | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  const filteredTrains = (trains || []).filter((train) => {
    const matchesSearch =
      searchQuery === '' ||
      train.train_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      train.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      train.current_track.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'ALL' || train.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const statuses = ['ALL', 'RUNNING', 'DELAYED', 'STOPPED', 'EMERGENCY', 'APPROACHING'];

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <TrainFront className="w-5 h-5 text-rail-active" />
          <div>
            <h1 className="text-lg font-bold text-rail-text">Trains</h1>
            <p className="text-xs text-rail-text-muted">All trains in the network</p>
          </div>
        </div>
        <Button size="sm" variant="outline" onClick={() => refetch()}>
          Refresh
        </Button>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <Input
          placeholder="Search trains..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-64 bg-rail-surface border-rail-border text-rail-text placeholder:text-rail-text-dim"
        />
        <div className="flex items-center gap-1">
          {statuses.map((status) => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors ${
                statusFilter === status
                  ? 'bg-rail-active text-white'
                  : 'bg-rail-surface text-rail-text-muted hover:text-rail-text'
              }`}
            >
              {status}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <LoadingState fullPage />
      ) : error ? (
        <ErrorState message="Failed to load trains" onRetry={refetch} fullPage />
      ) : (
        <TrainTable
          trains={filteredTrains}
          onSelect={setSelectedTrain}
          selectedTrainNumber={selectedTrain?.train_number}
        />
      )}

      {selectedTrain && (
        <TrainDetailsDrawer train={selectedTrain} onClose={() => setSelectedTrain(null)} />
      )}
    </motion.div>
  );
}
