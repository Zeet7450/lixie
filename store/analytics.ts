import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export type TimeRange = '1d' | '7d' | '1m' | '1y' | 'all';

export interface ReadingRecord {
  articleId: number;
  category: string;
  timestamp: number;
  readDuration?: number; // in seconds
}

export interface ClickRecord {
  articleId: number;
  timestamp: number;
}

interface AnalyticsStore {
  readings: ReadingRecord[];
  clicks: ClickRecord[];
  addReading: (articleId: number, category: string, readDuration?: number) => void;
  addClick: (articleId: number) => void;
  resetAnalytics: () => void;
  getReadingsByTimeRange: (timeRange: TimeRange) => ReadingRecord[];
  getClicksByTimeRange: (timeRange: TimeRange) => ClickRecord[];
  getCategoryStats: (timeRange: TimeRange) => Record<string, { count: number; percentage: number }>;
  getTotalClicks: (timeRange: TimeRange) => number;
  getTotalReadings: (timeRange: TimeRange) => number;
}

const getTimeRangeStart = (timeRange: TimeRange): number => {
  const now = Date.now();
  switch (timeRange) {
    case '1d':
      return now - 24 * 60 * 60 * 1000;
    case '7d':
      return now - 7 * 24 * 60 * 60 * 1000;
    case '1m':
      return now - 30 * 24 * 60 * 60 * 1000;
    case '1y':
      return now - 365 * 24 * 60 * 60 * 1000;
    case 'all':
      return 0;
  }
};

export const useAnalyticsStore = create<AnalyticsStore>()(
  persist(
    (set, get) => ({
      readings: [],
      clicks: [],

      addReading: (articleId, category, readDuration) => {
        set((state) => {
          // Check if this article has already been read (unique reads only)
          const alreadyRead = state.readings.some(r => r.articleId === articleId);
          
          // Only add if not already read (unique reads)
          if (alreadyRead) {
            return state; // Don't add duplicate reads
          }
          
          return {
            readings: [
              ...state.readings,
              {
                articleId,
                category,
                timestamp: Date.now(),
                readDuration,
              },
            ],
          };
        });
      },

      addClick: (articleId) => {
        console.log(`📊 addClick called for article ID: ${articleId}`);
        set((state) => {
          const newClick = {
            articleId,
            timestamp: Date.now(),
          };
          const newClicks = [...state.clicks, newClick];
          console.log(`📊 Click added. Total clicks: ${newClicks.length}`);
          return {
            clicks: newClicks,
          };
        });
      },

      resetAnalytics: () => {
        // Clear state
        set({
          readings: [],
          clicks: [],
        });
        // Clear from localStorage
        if (typeof window !== 'undefined') {
          try {
            localStorage.removeItem('lixie-analytics');
            // Force rehydration by triggering a state update
            setTimeout(() => {
              set({ readings: [], clicks: [] });
            }, 100);
          } catch (error) {
            console.error('Error clearing analytics from localStorage:', error);
          }
        }
      },

      getReadingsByTimeRange: (timeRange) => {
        const start = getTimeRangeStart(timeRange);
        return get().readings.filter((r) => r.timestamp >= start);
      },

      getClicksByTimeRange: (timeRange) => {
        const start = getTimeRangeStart(timeRange);
        return get().clicks.filter((c) => c.timestamp >= start);
      },

      getCategoryStats: (timeRange) => {
        const readings = get().getReadingsByTimeRange(timeRange);
        const total = readings.length;
        
        if (total === 0) return {};

        const categoryCounts: Record<string, number> = {};
        readings.forEach((reading) => {
          categoryCounts[reading.category] = (categoryCounts[reading.category] || 0) + 1;
        });

        const stats: Record<string, { count: number; percentage: number }> = {};
        Object.entries(categoryCounts).forEach(([category, count]) => {
          stats[category] = {
            count,
            percentage: Math.round((count / total) * 100),
          };
        });

        return stats;
      },

      getTotalClicks: (timeRange) => {
        // Total clicks: count all clicks (even if same article clicked multiple times)
        return get().getClicksByTimeRange(timeRange).length;
      },

      getTotalReadings: (timeRange) => {
        // Unique readings: count only unique article IDs (same article = 1 read)
        const readings = get().getReadingsByTimeRange(timeRange);
        const uniqueArticleIds = new Set(readings.map(r => r.articleId));
        return uniqueArticleIds.size;
      },
    }),
    {
      name: 'lixie-analytics',
      storage: createJSONStorage(() => localStorage),
    }
  )
);

