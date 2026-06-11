import { create } from 'zustand';
import type { Platform, PlatformSummary } from '@/types';

interface PlatformStore {
  platforms: Platform[];
  selectedPlatform: Platform | null;
  summary: PlatformSummary;
  loading: boolean;
  error: string | null;

  setPlatforms: (platforms: Platform[]) => void;
  addOrUpdatePlatform: (platform: Platform) => void;
  setSelectedPlatform: (platform: Platform | null) => void;
  setSummary: (summary: PlatformSummary) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  updatePlatformStatus: (platformId: string, status: Platform['status'], trainNumber?: string | null) => void;
}

const defaultSummary: PlatformSummary = {
  total: 0,
  free: 0,
  occupied: 0,
  reserved: 0,
  maintenance: 0,
  utilization_percentage: 0,
};

export const usePlatformStore = create<PlatformStore>((set) => ({
  platforms: [],
  selectedPlatform: null,
  summary: defaultSummary,
  loading: false,
  error: null,

  setPlatforms: (platforms) => set({ platforms, summary: computeSummary(platforms) }),

  addOrUpdatePlatform: (platform) =>
    set((state) => {
      const exists = state.platforms.find((p) => p.platform_id === platform.platform_id);
      const platforms = exists
        ? state.platforms.map((p) => (p.platform_id === platform.platform_id ? { ...p, ...platform } : p))
        : [...state.platforms, platform];
      return { platforms, summary: computeSummary(platforms) };
    }),

  setSelectedPlatform: (selectedPlatform) => set({ selectedPlatform }),
  setSummary: (summary) => set({ summary }),
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),

  updatePlatformStatus: (platformId, status, trainNumber) =>
    set((state) => {
      const platforms = state.platforms.map((p) =>
        p.platform_id === platformId
          ? {
              ...p,
              status,
              current_train: trainNumber !== undefined ? trainNumber : p.current_train,
              occupancy_percentage:
                status === 'OCCUPIED' ? 100 : status === 'RESERVED' ? 50 : status === 'MAINTENANCE' ? 0 : 0,
            }
          : p
      );
      return { platforms, summary: computeSummary(platforms) };
    }),
}));

function computeSummary(platforms: Platform[]): PlatformSummary {
  const total = platforms.length;
  const free = platforms.filter((p) => p.status === 'FREE').length;
  const occupied = platforms.filter((p) => p.status === 'OCCUPIED').length;
  const reserved = platforms.filter((p) => p.status === 'RESERVED').length;
  const maintenance = platforms.filter((p) => p.status === 'MAINTENANCE').length;
  const utilization_percentage = total > 0 ? Math.round(((occupied + reserved) / total) * 100) : 0;
  return { total, free, occupied, reserved, maintenance, utilization_percentage };
}
