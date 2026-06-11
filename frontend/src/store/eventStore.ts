import { create } from 'zustand';
import type { RailwayEvent, EventStats, RouteConflict } from '@/types';

interface EventStore {
  events: RailwayEvent[];
  conflicts: RouteConflict[];
  stats: EventStats;
  unreadCount: number;
  loading: boolean;
  error: string | null;

  setEvents: (events: RailwayEvent[]) => void;
  addEvent: (event: RailwayEvent) => void;
  markAllRead: () => void;
  setConflicts: (conflicts: RouteConflict[]) => void;
  addConflict: (conflict: RouteConflict) => void;
  resolveConflict: (conflictKey: string) => void;
  setStats: (stats: EventStats) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  useConflictStore: () => { conflicts: RouteConflict[] };
}

const defaultStats: EventStats = {
  total_events: 0,
  by_type: {} as Record<string, number>,
  by_severity: {} as Record<string, number>,
  unresolved_count: 0,
  avg_delay_minutes: 0,
};

export const useEventStore = create<EventStore>((set, get) => ({
  events: [],
  conflicts: [],
  stats: defaultStats,
  unreadCount: 0,
  loading: false,
  error: null,

  setEvents: (events) => set({ events }),

  addEvent: (event) =>
    set((state) => ({
      events: [event, ...state.events].slice(0, 500),
      unreadCount: state.unreadCount + 1,
    })),

  markAllRead: () => set({ unreadCount: 0 }),

  setConflicts: (conflicts) => set({ conflicts }),

  addConflict: (conflict) =>
    set((state) => ({
      conflicts: [conflict, ...state.conflicts],
    })),

  resolveConflict: (conflictKey) =>
    set((state) => ({
      conflicts: state.conflicts.filter((c) => `${c.track_id}-${c.train_a}-${c.train_b}` !== conflictKey),
    })),

  setStats: (stats) => set({ stats }),
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),
  useConflictStore: () => ({ conflicts: get().conflicts }),
}));

export function useConflictStore() {
  return useEventStore((s) => ({ conflicts: s.conflicts, setConflicts: s.setConflicts }));
}
