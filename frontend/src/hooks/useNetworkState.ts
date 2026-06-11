import { useQuery } from '@tanstack/react-query';
import { networkApi, healthApi, metricsApi } from '@/services/api';

export function useNetworkStateQuery(refetchInterval = 5000) {
  return useQuery({
    queryKey: ['network-state'],
    queryFn: () => networkApi.getState(),
    refetchInterval,
    staleTime: 2000,
  });
}

export function useNetworkMetricsQuery(refetchInterval = 5000) {
  return useQuery({
    queryKey: ['network-metrics'],
    queryFn: () => metricsApi.get(),
    refetchInterval,
    staleTime: 2000,
  });
}

export function useHealthCheckQuery(refetchInterval = 10000) {
  return useQuery({
    queryKey: ['health'],
    queryFn: () => healthApi.check(),
    refetchInterval,
    staleTime: 5000,
    retry: 3,
  });
}

export function useDigitalTwinQuery(refetchInterval = 5000) {
  return useQuery({
    queryKey: ['digital-twin'],
    queryFn: () => networkApi.getDigitalTwin(),
    refetchInterval,
    staleTime: 2000,
  });
}

export function useNetworkEventsQuery(refetchInterval = 5000) {
  return useQuery({
    queryKey: ['network-events'],
    queryFn: () => networkApi.getEvents(),
    refetchInterval,
    staleTime: 2000,
  });
}

export function useEventStatsQuery(refetchInterval = 10000) {
  return useQuery({
    queryKey: ['event-stats'],
    queryFn: () => networkApi.getEventStats(),
    refetchInterval,
    staleTime: 5000,
  });
}
