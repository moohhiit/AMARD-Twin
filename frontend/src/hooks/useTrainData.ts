import { useQuery } from '@tanstack/react-query';
import { trainApi } from '@/services/api';

export function useTrainsQuery(refetchInterval = 5000) {
  return useQuery({
    queryKey: ['trains'],
    queryFn: () => trainApi.list(),
    refetchInterval,
    staleTime: 2000,
  });
}

export function useTrainQuery(trainNumber: string, enabled = true) {
  return useQuery({
    queryKey: ['train', trainNumber],
    queryFn: () => trainApi.get(trainNumber),
    enabled: enabled && !!trainNumber,
    staleTime: 2000,
  });
}

export function useTrainGraphQuery(trainNumber: string, enabled = true) {
  return useQuery({
    queryKey: ['train-graph', trainNumber],
    queryFn: () => trainApi.getGraph(trainNumber),
    enabled: enabled && !!trainNumber,
    staleTime: 2000,
  });
}
