'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { useState, useMemo } from 'react';
import { X, BarChart3, TrendingUp, MousePointerClick, RotateCcw } from 'lucide-react';
import { useAnimation } from '@/hooks/useAnimation';
import { useAnalyticsStore, type TimeRange } from '@/store/analytics';
import { useDarkMode } from '@/hooks/useDarkMode';
import { useLanguage } from '@/hooks/useLanguage';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

const timeRangeOptions: { value: TimeRange; label: string }[] = [
  { value: '1d', label: '1 Hari' },
  { value: '7d', label: '7 Hari' },
  { value: '1m', label: '1 Bulan' },
  { value: '1y', label: '1 Tahun' },
  { value: 'all', label: 'All Time' },
];

export function Sidebar({ isOpen, onClose }: SidebarProps) {
  const { config } = useAnimation();
  const { isDarkMode } = useDarkMode();
  const { t, language } = useLanguage();
  const [selectedTimeRange, setSelectedTimeRange] = useState<TimeRange>('all');
  
  const {
    getCategoryStats,
    getTotalClicks,
    getTotalReadings,
    resetAnalytics,
  } = useAnalyticsStore();

  const categoryStats = useMemo(
    () => getCategoryStats(selectedTimeRange),
    [selectedTimeRange, getCategoryStats]
  );

  const totalClicks = useMemo(
    () => getTotalClicks(selectedTimeRange),
    [selectedTimeRange, getTotalClicks]
  );

  const totalReadings = useMemo(
    () => getTotalReadings(selectedTimeRange),
    [selectedTimeRange, getTotalReadings]
  );

  // Sort categories by count
  const sortedCategories = useMemo(() => {
    return Object.entries(categoryStats)
      .map(([category, stats]) => ({
        category: category.charAt(0).toUpperCase() + category.slice(1),
        ...stats,
      }))
      .sort((a, b) => b.count - a.count);
  }, [categoryStats]);

  // Calculate max count for chart scaling
  const maxCount = useMemo(() => {
    return Math.max(...sortedCategories.map((c) => c.count), 1);
  }, [sortedCategories]);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 lg:z-30"
          />

          {/* Sidebar */}
          <motion.aside
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={config.Transitions.standard as any}
            className="fixed top-0 right-0 h-full w-full sm:w-96 lg:w-[420px] bg-cream-200 dark:bg-slate-900 glass backdrop-blur-md z-50 lg:z-40 shadow-2xl overflow-y-auto"
          >
            <div className="p-4 sm:p-6">
              {/* Header */}
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl sm:text-2xl font-bold text-emerald-900 dark:text-cream-200">
                  Analytics Dashboard
                </h2>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      const confirmMessage = language === 'id' 
                        ? 'Apakah Anda yakin ingin mereset semua data analytics? Tindakan ini tidak dapat dibatalkan.'
                        : 'Are you sure you want to reset all analytics data? This action cannot be undone.';
                      if (confirm(confirmMessage)) {
                        resetAnalytics();
                      }
                    }}
                    className="p-2 rounded-full hover:bg-rose-200/30 dark:hover:bg-rose-900/30 transition-colors"
                    title={language === 'id' ? 'Reset Analytics' : 'Reset Analytics'}
                  >
                    <RotateCcw size={18} className="text-emerald-700 dark:text-cream-300" />
                  </button>
                  <button
                    onClick={onClose}
                    className="p-2 rounded-full hover:bg-rose-200/30 dark:hover:bg-rose-900/30 transition-colors"
                  >
                    <X size={20} className="text-emerald-700 dark:text-cream-300" />
                  </button>
                </div>
              </div>

              {/* Time Range Selector */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-emerald-700 dark:text-cream-300 mb-2">
                  Periode Waktu
                </label>
                <div className="flex flex-wrap gap-2">
                  {timeRangeOptions.map((option) => (
                    <button
                      key={option.value}
                      onClick={() => setSelectedTimeRange(option.value)}
                      className={`px-3 py-1.5 rounded-full text-xs sm:text-sm font-medium transition-colors ${
                        selectedTimeRange === option.value
                          ? 'bg-rose-600 text-white dark:bg-rose-500'
                          : 'bg-cream-100 dark:bg-slate-800 text-emerald-700 dark:text-cream-300 hover:bg-rose-200/30 dark:hover:bg-rose-900/30'
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Reading Statistics Chart */}
              <div className="mb-6 p-4 rounded-lg bg-cream-100/50 dark:bg-slate-800/50">
                <div className="flex items-center gap-2 mb-4">
                  <BarChart3 size={20} className="text-emerald-700 dark:text-emerald-400" />
                  <h3 className="text-lg font-semibold text-emerald-900 dark:text-cream-200">
                    Berita yang Dibaca
                  </h3>
                </div>
                <div className="mb-4">
                  <p className="text-3xl font-bold text-emerald-900 dark:text-cream-200">
                    {totalReadings}
                  </p>
                  <p className="text-sm text-emerald-700 dark:text-emerald-400">
                    Total artikel dibaca
                  </p>
                </div>
                
                {sortedCategories.length > 0 ? (
                  <div className="space-y-3">
                    {sortedCategories.map((item, index) => (
                      <div key={item.category} className="space-y-1">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-emerald-700 dark:text-cream-300 font-medium">
                            {item.category}
                          </span>
                          <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                            {item.count} ({item.percentage}%)
                          </span>
                        </div>
                        <div className="h-2 bg-emerald-200 dark:bg-emerald-900 rounded-full overflow-hidden">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${(item.count / maxCount) * 100}%` }}
                            transition={{
                              delay: index * 0.1,
                              duration: 0.5,
                            }}
                            className="h-full bg-emerald-600 dark:bg-emerald-400"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-emerald-700 dark:text-cream-300 text-center py-4">
                    Belum ada data membaca
                  </p>
                )}
              </div>

              {/* Favorite Categories Table */}
              <div className="mb-6 p-4 rounded-lg bg-cream-100/50 dark:bg-slate-800/50">
                <div className="flex items-center gap-2 mb-4">
                  <TrendingUp size={20} className="text-emerald-700 dark:text-emerald-400" />
                  <h3 className="text-lg font-semibold text-emerald-900 dark:text-cream-200">
                    Kategori Favorit
                  </h3>
                </div>
                
                {sortedCategories.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-emerald-300 dark:border-emerald-700">
                          <th className="text-left py-2 px-2 text-emerald-700 dark:text-cream-300 font-semibold">
                            Kategori
                          </th>
                          <th className="text-right py-2 px-2 text-emerald-700 dark:text-cream-300 font-semibold">
                            Jumlah
                          </th>
                          <th className="text-right py-2 px-2 text-emerald-700 dark:text-cream-300 font-semibold">
                            %
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {sortedCategories.map((item, index) => (
                          <motion.tr
                            key={item.category}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: index * 0.05 }}
                            className="border-b border-emerald-200/50 dark:border-emerald-800/50 hover:bg-rose-100/30 dark:hover:bg-rose-900/20"
                          >
                            <td className="py-2 px-2 text-emerald-700 dark:text-cream-300">
                              {item.category}
                            </td>
                            <td className="py-2 px-2 text-right text-emerald-600 dark:text-emerald-400 font-medium">
                              {item.count}
                            </td>
                            <td className="py-2 px-2 text-right text-emerald-600 dark:text-emerald-400 font-medium">
                              {item.percentage}%
                            </td>
                          </motion.tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-sm text-emerald-700 dark:text-cream-300 text-center py-4">
                    Belum ada data kategori
                  </p>
                )}
              </div>

              {/* Click Statistics */}
              <div className="p-4 rounded-lg bg-cream-100/50 dark:bg-slate-800/50">
                <div className="flex items-center gap-2 mb-4">
                  <MousePointerClick size={20} className="text-emerald-700 dark:text-emerald-400" />
                  <h3 className="text-lg font-semibold text-emerald-900 dark:text-cream-200">
                    Artikel yang Diklik
                  </h3>
                </div>
                <div>
                  <p className="text-3xl font-bold text-emerald-900 dark:text-cream-200">
                    {totalClicks}
                  </p>
                  <p className="text-sm text-emerald-700 dark:text-emerald-400">
                    Total klik artikel
                  </p>
                </div>
              </div>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}

