import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { NewsRegion } from '@/lib/api';

export type AppRegion = 'id' | 'cn' | 'kr' | 'intl';

interface RegionStore {
  region: AppRegion;
  setRegion: (region: AppRegion) => void;
  getNewsRegion: () => NewsRegion; // Map AppRegion to NewsRegion
  getDisplayLanguage: () => 'id' | 'en'; // Get display language based on region
}

export const useRegionStore = create<RegionStore>()(
  persist(
    (set, get) => ({
      region: 'id',
      
      setRegion: (region) => set({ region }),
      
      getNewsRegion: () => {
        const appRegion = get().region;
        // Map AppRegion to NewsRegion
        const mapping: Record<AppRegion, NewsRegion> = {
          'id': 'id',
          'cn': 'cn',
          'kr': 'kr',
          'intl': 'intl',
        };
        return mapping[appRegion];
      },
      
      getDisplayLanguage: () => {
        const appRegion = get().region;
        // ID uses Indonesian, others use English
        return appRegion === 'id' ? 'id' : 'en';
      },
    }),
    {
      name: 'lixie-region-storage',
      storage: createJSONStorage(() => localStorage),
    }
  )
);

