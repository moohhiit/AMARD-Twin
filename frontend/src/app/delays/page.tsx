import { motion } from 'framer-motion';
import { ClockAlert } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { delayApi } from '@/services/api';
import { DelayTimeline } from '@/components/delays/DelayTimeline';
import { LoadingState } from '@/components/shared/LoadingState';
import { ErrorState } from '@/components/shared/ErrorState';

export default function DelaysPage() {
  const { data: report, isLoading, error, refetch } = useQuery({
    queryKey: ['delay-report'],
    queryFn: () => delayApi.getReport(),
    refetchInterval: 10000,
  });

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
      <div className="flex items-center gap-3">
        <ClockAlert className="w-5 h-5 text-signal-yellow" />
        <div>
          <h1 className="text-lg font-bold text-rail-text">Delay Center</h1>
          <p className="text-xs text-rail-text-muted">Delay reports and propagation analysis</p>
        </div>
      </div>

      {isLoading ? (
        <LoadingState fullPage />
      ) : error ? (
        <ErrorState message="Failed to load delay data" onRetry={refetch} fullPage />
      ) : (
        <DelayTimeline report={report || null} />
      )}
    </motion.div>
  );
}
