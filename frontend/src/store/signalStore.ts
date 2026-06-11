import { create } from 'zustand';
import type { Signal, SignalSummary } from '@/types';

interface SignalStore {
  signals: Signal[];
  selectedSignal: Signal | null;
  summary: SignalSummary;
  loading: boolean;
  error: string | null;

  setSignals: (signals: Signal[]) => void;
  addOrUpdateSignal: (signal: Signal) => void;
  setSelectedSignal: (signal: Signal | null) => void;
  setSummary: (summary: SignalSummary) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  updateSignalState: (signalId: string, state: Signal['state']) => void;
}

const defaultSummary: SignalSummary = {
  total: 0,
  green: 0,
  red: 0,
  yellow: 0,
  flashing: 0,
  off: 0,
};

export const useSignalStore = create<SignalStore>((set) => ({
  signals: [],
  selectedSignal: null,
  summary: defaultSummary,
  loading: false,
  error: null,

  setSignals: (signals) => set({ signals, summary: computeSummary(signals) }),

  addOrUpdateSignal: (signal) =>
    set((s) => {
      const exists = s.signals.find((sig) => sig.signal_id === signal.signal_id);
      const signals = exists
        ? s.signals.map((sig) => (sig.signal_id === signal.signal_id ? { ...sig, ...signal } : sig))
        : [...s.signals, signal];
      return { signals, summary: computeSummary(signals) };
    }),

  setSelectedSignal: (selectedSignal) => set({ selectedSignal }),
  setSummary: (summary) => set({ summary }),
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),

  updateSignalState: (signalId, newState) =>
    set((s) => {
      const signals = s.signals.map((sig) =>
        sig.signal_id === signalId ? { ...sig, state: newState, last_changed: new Date().toISOString() } : sig
      );
      return { signals, summary: computeSummary(signals) };
    }),
}));

function computeSummary(signals: Signal[]): SignalSummary {
  const total = signals.length;
  const green = signals.filter((s) => s.state === 'GREEN').length;
  const red = signals.filter((s) => s.state === 'RED').length;
  const yellow = signals.filter((s) => s.state === 'YELLOW').length;
  const flashing = signals.filter((s) => s.state === 'FLASHING').length;
  const off = signals.filter((s) => s.state === 'OFF').length;
  return { total, green, red, yellow, flashing, off };
}
