const API_BASE = '';

async function fetcher<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${url}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: response.statusText }));
    throw new Error(error.detail || `HTTP ${response.status}: ${response.statusText}`);
  }
  return response.json();
}

export const healthApi = {
  check: () => fetcher<import('@/types').HealthCheck>('/health'),
};

export const metricsApi = {
  get: () => fetcher<import('@/types').NetworkMetrics>('/metrics'),
};

export const trainApi = {
  list: () => fetcher<{ trains: import('@/types').Train[] }>('/api/v1/trains').then(r => r.trains),
  get: (trainNumber: string) => fetcher<import('@/types').Train>(`/api/v1/trains/${trainNumber}`),
  getGraph: (trainNumber: string) => fetcher<import('@/types').TrainGraph>(`/api/v1/trains/${trainNumber}/graph`),
  create: (payload: import('@/types').TrainCreatePayload) =>
    fetcher<import('@/types').Train>('/api/v1/trains', { method: 'POST', body: JSON.stringify(payload) }),
  update: (trainNumber: string, payload: import('@/types').TrainUpdatePayload) =>
    fetcher<import('@/types').Train>(`/api/v1/trains/${trainNumber}`, { method: 'PATCH', body: JSON.stringify(payload) }),
  updatePosition: (trainNumber: string, payload: import('@/types').TrainPositionPayload) =>
    fetcher<import('@/types').TrainPosition>(`/api/v1/trains/${trainNumber}/position`, { method: 'POST', body: JSON.stringify(payload) }),
  remove: (trainNumber: string) =>
    fetcher<void>(`/api/v1/trains/${trainNumber}`, { method: 'DELETE' }),
};

export const routeApi = {
  get: (routeId: string) => fetcher<import('@/types').Route>(`/api/v1/routes/${routeId}`),
  create: (payload: import('@/types').RouteCreatePayload) =>
    fetcher<import('@/types').Route>('/api/v1/routes', { method: 'POST', body: JSON.stringify(payload) }),
  plan: (payload: import('@/types').RoutePlanPayload) =>
    fetcher<import('@/types').RoutePlan>('/api/v1/routes/plan', { method: 'POST', body: JSON.stringify(payload) }),
  reserve: (payload: import('@/types').RouteReservePayload) =>
    fetcher<import('@/types').RouteReservation>('/api/v1/routes/reserve', { method: 'POST', body: JSON.stringify(payload) }),
  clear: (routeId: string, payload: import('@/types').RouteClearPayload) =>
    fetcher<void>(`/api/v1/routes/${routeId}/clear`, { method: 'POST', body: JSON.stringify(payload) }),
  getConflicts: (routeId: string) =>
    fetcher<import('@/types').RouteConflict[]>(`/api/v1/routes/${routeId}/conflicts`),
};

export const platformApi = {
  list: (stationId?: string) =>
    fetcher<import('@/types').Platform[]>(`/api/v1/platforms${stationId ? `?station_id=${stationId}` : ''}`),
  get: (platformId: string) => fetcher<import('@/types').Platform>(`/api/v1/platforms/${platformId}`),
  create: (payload: import('@/types').PlatformCreatePayload) =>
    fetcher<import('@/types').Platform>('/api/v1/platforms', { method: 'POST', body: JSON.stringify(payload) }),
  allocate: (payload: import('@/types').PlatformAllocatePayload) =>
    fetcher<import('@/types').PlatformAllocation>('/api/v1/platforms/allocate', { method: 'POST', body: JSON.stringify(payload) }),
  release: (platformId: string) =>
    fetcher<void>('/api/v1/platforms/release', { method: 'POST', body: JSON.stringify({ platform_id: platformId }) }),
};

export const signalApi = {
  list: () => fetcher<import('@/types').Signal[]>('/api/v1/signals'),
  get: (signalId: string) => fetcher<import('@/types').Signal>(`/api/v1/signals/${signalId}`),
  create: (payload: import('@/types').SignalCreatePayload) =>
    fetcher<import('@/types').Signal>('/api/v1/signals', { method: 'POST', body: JSON.stringify(payload) }),
  updateState: (signalId: string, payload: import('@/types').SignalStatePayload) =>
    fetcher<import('@/types').Signal>(`/api/v1/signals/${signalId}`, { method: 'PATCH', body: JSON.stringify(payload) }),
  safetyCheck: (signalId: string) =>
    fetcher<import('@/types').SignalSafetyCheck>(`/api/v1/signals/safety-check`, { method: 'POST', body: JSON.stringify({ signal_id: signalId }) }),
};

export const conflictApi = {
  getActive: () => fetcher<import('@/types').RouteConflict[]>('/api/v1/conflicts/active'),
  getTrackOccupancy: () => fetcher<import('@/types').RouteConflict[]>('/api/v1/conflicts/track-occupancy'),
  getRouteOverlap: () => fetcher<import('@/types').RouteConflict[]>('/api/v1/conflicts/route-overlap'),
  getJunction: () => fetcher<import('@/types').RouteConflict[]>('/api/v1/conflicts/junction'),
  getHeadway: () => fetcher<import('@/types').RouteConflict[]>('/api/v1/conflicts/headway'),
  getHistory: (trainNumber: string) => fetcher<import('@/types').RouteConflict[]>(`/api/v1/conflicts/history/${trainNumber}`),
};

export const delayApi = {
  predict: (trainNumber: string) =>
    fetcher<import('@/types').DelayPrediction>(`/api/v1/delays/predict/${trainNumber}`),
  getCongestion: (zoneId?: string) =>
    fetcher<import('@/types').CongestionInfo[]>(`/api/v1/delays/congestion${zoneId ? `?zone_id=${zoneId}` : ''}`),
  getETA: (trainNumber: string) =>
    fetcher<import('@/types').ETAInfo>(`/api/v1/delays/eta/${trainNumber}`),
  getReport: () => fetcher<import('@/types').DelayReport>('/api/v1/delays/report'),
  holdTrain: (trainNumber: string) =>
    fetcher<void>(`/api/v1/delays/hold/${trainNumber}`, { method: 'POST' }),
};

export const networkApi = {
  getState: () => fetcher<import('@/types').NetworkState>('/api/v1/network-state'),
  getTrains: () => fetcher<import('@/types').NetworkState['trains']>('/api/v1/network-state/trains'),
  getMetrics: () => fetcher<import('@/types').NetworkMetrics>('/api/v1/network-state/metrics'),
  getDigitalTwin: () => fetcher<import('@/types').DigitalTwinState>('/api/v1/network-state/digital-twin'),
  getEvents: () => fetcher<import('@/types').RailwayEvent[]>('/api/v1/network-state/events'),
  getEventStats: () => fetcher<import('@/types').EventStats>('/api/v1/network-state/events/stats'),
};
