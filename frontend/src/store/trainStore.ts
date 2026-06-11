import { create } from 'zustand';
import type { Train, TrainGraph, TrainSummary } from '@/types';

interface TrainStore {
  trains: Train[];
  selectedTrain: Train | null;
  trainGraph: TrainGraph | null;
  summary: TrainSummary;
  loading: boolean;
  error: string | null;

  setTrains: (trains: Train[]) => void;
  addOrUpdateTrain: (train: Train) => void;
  removeTrain: (trainNumber: string) => void;
  setSelectedTrain: (train: Train | null) => void;
  setTrainGraph: (graph: TrainGraph | null) => void;
  setSummary: (summary: TrainSummary) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  updateTrainPosition: (trainNumber: string, trackId: string, speed: number, progress: number) => void;
  updateTrainStatus: (trainNumber: string, status: Train['status'], delayMinutes?: number) => void;
}

const defaultSummary: TrainSummary = {
  total: 0,
  running: 0,
  delayed: 0,
  stopped: 0,
  emergency: 0,
  avg_speed: 0,
};

export const useTrainStore = create<TrainStore>((set) => ({
  trains: [],
  selectedTrain: null,
  trainGraph: null,
  summary: defaultSummary,
  loading: false,
  error: null,

  setTrains: (data) => {
  const trains = Array.isArray(data) ? data : [];
  set({ trains, summary: computeSummary(trains) });
},
  addOrUpdateTrain: (train) =>
    set((state) => {
      const exists = state.trains.find((t) => t.train_number === train.train_number);
      const trains = exists
        ? state.trains.map((t) => (t.train_number === train.train_number ? { ...t, ...train } : t))
        : [...state.trains, train];
      return { trains, summary: computeSummary(trains) };
    }),

  removeTrain: (trainNumber) =>
    set((state) => {
      const trains = state.trains.filter((t) => t.train_number !== trainNumber);
      return { trains, summary: computeSummary(trains) };
    }),

  setSelectedTrain: (selectedTrain) => set({ selectedTrain }),
  setTrainGraph: (trainGraph) => set({ trainGraph }),
  setSummary: (summary) => set({ summary }),
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),

  updateTrainPosition: (trainNumber, trackId, speed, progress) =>
    set((state) => {
      const trains = state.trains.map((t) =>
        t.train_number === trainNumber
          ? { ...t, current_track: trackId, speed, progress_on_track: progress }
          : t
      );
      return { trains, summary: computeSummary(trains) };
    }),

  updateTrainStatus: (trainNumber, status, delayMinutes) =>
    set((state) => {
      const trains = state.trains.map((t) =>
        t.train_number === trainNumber
          ? { ...t, status, ...(delayMinutes !== undefined ? { delay_minutes: delayMinutes } : {}) }
          : t
      );
      return { trains, summary: computeSummary(trains) };
    }),
}));

function computeSummary(trains: Train[]): TrainSummary {
  const total = trains.length;
  const running = trains.filter((t) => t.status === 'RUNNING').length;
  const delayed = trains.filter((t) => t.status === 'DELAYED').length;
  const stopped = trains.filter((t) => t.status === 'STOPPED' || t.status === 'MAINTENANCE').length;
  const emergency = trains.filter((t) => t.status === 'EMERGENCY').length;
  const avg_speed = total > 0 ? trains.reduce((sum, t) => sum + t.speed, 0) / total : 0;
  return { total, running, delayed, stopped, emergency, avg_speed };
}
