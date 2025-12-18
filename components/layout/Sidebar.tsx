'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { useState, useMemo, useEffect } from 'react';
import { LayoutDashboard, TrendingUp, RotateCcw, Trash2, Database, Moon, Sun } from 'lucide-react';
import { useAnimation } from '@/hooks/useAnimation';
import { useAnalyticsStore, type TimeRange } from '@/store/analytics';
import { useDarkMode } from '@/hooks/useDarkMode';
import { useLanguage } from '@/hooks/useLanguage';
import type { NewsRegion } from '@/lib/api';
import { useRegionStore } from '@/store/region';
import { useArticlesStore } from '@/store/articles';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  showDeleteMenu?: boolean;
  onDeleteMenuToggle?: () => void;
}

const timeRangeOptions: { value: TimeRange; label: string }[] = [
  { value: '1d', label: '1 Hari' },
  { value: '7d', label: '7 Hari' },
  { value: '1m', label: '1 Bulan' },
  { value: '1y', label: '1 Tahun' },
  { value: 'all', label: 'All Time' },
];

export function Sidebar({ isOpen, onClose, showDeleteMenu: externalShowDeleteMenu, onDeleteMenuToggle }: SidebarProps) {
  const { config } = useAnimation();
  const { isDarkMode, toggleDarkMode } = useDarkMode();
  const { t, language } = useLanguage();
  const [selectedTimeRange, setSelectedTimeRange] = useState<TimeRange>('all');
  const [internalShowDeleteMenu, setInternalShowDeleteMenu] = useState(false);
  
  // Use external showDeleteMenu if provided, otherwise use internal state
  const showDeleteMenu = externalShowDeleteMenu !== undefined ? externalShowDeleteMenu : internalShowDeleteMenu;
  const setShowDeleteMenu = onDeleteMenuToggle || setInternalShowDeleteMenu;
  const [deleteRegion, setDeleteRegion] = useState<NewsRegion | 'all'>('all');
  const [deleteDateRange, setDeleteDateRange] = useState<'1d' | '7d' | '1m' | '1y' | 'all'>('all');
  const [isDeleting, setIsDeleting] = useState(false);
  const { getNewsRegion } = useRegionStore();
  
  const {
    getCategoryStats,
    getTotalReadings,
    resetAnalytics,
    readings, // Get readings array to ensure reactivity
  } = useAnalyticsStore();
  
  const { bookmarks, articles } = useArticlesStore();

  const handleDeleteArticles = async () => {
    const regionLabel = deleteRegion === 'all' 
      ? (language === 'id' ? 'semua region' : 'all regions')
      : deleteRegion.toUpperCase();
    const dateLabel = deleteDateRange === 'all'
      ? (language === 'id' ? 'semua artikel' : 'all articles')
      : timeRangeOptions.find(opt => opt.value === deleteDateRange)?.label || deleteDateRange;
    
    const confirmMessage = language === 'id'
      ? `Apakah Anda yakin ingin menghapus artikel dari ${regionLabel} (${dateLabel})? Tindakan ini tidak dapat dibatalkan.`
      : `Are you sure you want to delete articles from ${regionLabel} (${dateLabel})? This action cannot be undone.`;
    
    if (!confirm(confirmMessage)) return;
    
    setIsDeleting(true);
    try {
      const response = await fetch('/api/articles/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          region: deleteRegion === 'all' ? null : deleteRegion,
          dateRange: deleteDateRange,
          deleteAll: deleteRegion === 'all' && deleteDateRange === 'all',
        }),
      });
      
      const data = await response.json();
      
      if (data.success) {
        alert(language === 'id' 
          ? `Berhasil menghapus ${data.deleted} artikel.`
          : `Successfully deleted ${data.deleted} articles.`);
        // Close delete menu
        if (onDeleteMenuToggle) {
          onDeleteMenuToggle();
        } else if (setInternalShowDeleteMenu) {
          setInternalShowDeleteMenu(false);
        }
        // Refresh page to show updated articles
        window.location.reload();
      } else {
        alert(language === 'id'
          ? `Gagal menghapus artikel: ${data.error}`
          : `Failed to delete articles: ${data.error}`);
      }
    } catch (error: any) {
      console.error('Error deleting articles:', error);
      alert(language === 'id'
        ? `Error: ${error.message || 'Gagal menghapus artikel'}`
        : `Error: ${error.message || 'Failed to delete articles'}`);
    } finally {
      setIsDeleting(false);
    }
  };

  const categoryStats = useMemo(
    () => getCategoryStats(selectedTimeRange),
    [selectedTimeRange, getCategoryStats]
  );

  const totalReadings = useMemo(() => {
    const count = getTotalReadings(selectedTimeRange);
    console.log(`📊 Sidebar: Total readings calculated: ${count} (timeRange: ${selectedTimeRange}, all readings: ${readings.length})`);
    return count;
  }, [selectedTimeRange, getTotalReadings, readings]);

  // Fetch database analytics
  const [dbAnalytics, setDbAnalytics] = useState<{
    totalArticles: number;
    articlesByRegion: Record<string, number>;
    articlesByCategory: Record<string, number>;
  } | null>(null);

  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        const response = await fetch(`/api/analytics?timeRange=${selectedTimeRange}`);
        const data = await response.json();
        if (data.success) {
          setDbAnalytics(data.data);
        }
      } catch (error) {
        console.error('Error fetching database analytics:', error);
      }
    };
    fetchAnalytics();
  }, [selectedTimeRange]);

  // Get favorite categories from bookmarks (not from readings)
  const favoriteCategoryStats = useMemo(() => {
    if (bookmarks.length === 0) return {};
    
    // Get categories from bookmarked articles
    const categoryCounts: Record<string, number> = {};
    bookmarks.forEach((articleId) => {
      const article = articles.find(a => a.id === articleId);
      if (article && article.category) {
        categoryCounts[article.category] = (categoryCounts[article.category] || 0) + 1;
      }
    });
    
    const total = bookmarks.length;
    const stats: Record<string, { count: number; percentage: number }> = {};
    Object.entries(categoryCounts).forEach(([category, count]) => {
      stats[category] = {
        count,
        percentage: Math.round((count / total) * 100),
      };
    });
    
    return stats;
  }, [bookmarks, articles]);

  // Sort categories by count (for reading statistics)
  const sortedCategories = useMemo(() => {
    return Object.entries(categoryStats)
      .map(([category, stats]) => ({
        category: category.charAt(0).toUpperCase() + category.slice(1),
        ...stats,
      }))
      .sort((a, b) => b.count - a.count);
  }, [categoryStats]);

  // Sort favorite categories by count
  const sortedFavoriteCategories = useMemo(() => {
    return Object.entries(favoriteCategoryStats)
      .map(([category, stats]) => ({
        category: category.charAt(0).toUpperCase() + category.slice(1),
        ...stats,
      }))
      .sort((a, b) => b.count - a.count);
  }, [favoriteCategoryStats]);

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
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40"
          />

          {/* Sidebar - Desktop & Mobile */}
          <motion.aside
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={config.Transitions.standard as any}
            className="fixed top-[64px] right-0 h-[calc(100vh-64px)] w-full sm:w-96 lg:w-[420px] bg-cream-200 dark:bg-slate-900 glass backdrop-blur-md z-50 shadow-2xl overflow-y-auto border-l border-gray-300/20 dark:border-slate-700/20"
          >
            <div className="p-4 sm:p-6">
              {/* Header */}
              <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <LayoutDashboard size={24} className="text-emerald-700 dark:text-cream-300" />
                <h2 className="text-xl sm:text-2xl font-bold text-emerald-900 dark:text-cream-200">
                  Dashboard
                </h2>
              </div>
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
              </div>
              </div>

              {/* Delete Articles Button */}
              <div className="mb-6">
            <button
              onClick={() => {
                if (onDeleteMenuToggle) {
                  onDeleteMenuToggle();
                } else {
                  setInternalShowDeleteMenu(!internalShowDeleteMenu);
                }
              }}
              className="w-full flex items-center gap-2 px-4 py-3 rounded-lg bg-rose-100/50 dark:bg-rose-900/20 border border-rose-300 dark:border-rose-800 hover:bg-rose-200/50 dark:hover:bg-rose-900/30 transition-colors"
            >
              <Trash2 size={20} className="text-rose-600 dark:text-rose-400" />
              <span className="text-sm font-medium text-rose-900 dark:text-rose-200">
                {language === 'id' ? 'Hapus Artikel' : 'Delete Articles'}
              </span>
              </button>
              </div>

              {/* Rest of sidebar content */}
              {renderSidebarContent()}
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );

  function renderSidebarContent() {
    return (
      <>
              {/* Dark/Light Theme Toggle */}
              <div className="mb-6 p-4 rounded-lg bg-cream-100/50 dark:bg-slate-800/50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {isDarkMode ? (
                      <Moon size={20} className="text-emerald-700 dark:text-cream-300" />
                    ) : (
                      <Sun size={20} className="text-emerald-700 dark:text-cream-300" />
                    )}
                    <span className="text-sm font-medium text-emerald-700 dark:text-cream-300">
                      {language === 'id' ? 'Tema' : 'Theme'}
                    </span>
                  </div>
                  <motion.button
                    onClick={toggleDarkMode}
                    className="p-2 rounded-full hover:bg-rose-200/30 dark:hover:bg-rose-900/30 transition-colors"
                    whileTap={{ scale: 0.95 }}
                  >
                    <motion.div
                      animate={{
                        rotate: isDarkMode ? 0 : 180,
                      }}
                      transition={{
                        duration: 0.5,
                        ease: config.Easings.standard as any,
                      }}
                    >
                      {isDarkMode ? (
                        <Moon size={20} className="text-emerald-700 dark:text-cream-300" />
                      ) : (
                        <Sun size={20} className="text-emerald-700 dark:text-cream-300" />
                      )}
                    </motion.div>
                  </motion.button>
                </div>
              </div>

              {/* Delete Articles Menu */}
              {showDeleteMenu && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="mb-6 p-4 rounded-lg bg-rose-100/50 dark:bg-rose-900/20 border border-rose-300 dark:border-rose-800"
                >
                  <div className="flex items-center gap-2 mb-4">
                    <Trash2 size={18} className="text-rose-600 dark:text-rose-400" />
                    <h3 className="text-lg font-semibold text-rose-900 dark:text-rose-200">
                      {language === 'id' ? 'Hapus Artikel' : 'Delete Articles'}
                    </h3>
                  </div>
                  
                  <div className="space-y-4">
                    {/* Region Selector */}
                    <div>
                      <label className="block text-sm font-medium text-rose-700 dark:text-rose-300 mb-2">
                        {language === 'id' ? 'Region' : 'Region'}
                      </label>
                      <div className="flex flex-wrap gap-2">
                        {[
                          { value: 'all', label: language === 'id' ? 'Semua' : 'All' },
                          { value: 'id', label: 'Indonesia' },
                          { value: 'cn', label: 'China' },
                          { value: 'intl', label: 'International' },
                        ].map((option) => (
                          <button
                            key={option.value}
                            onClick={() => setDeleteRegion(option.value as NewsRegion | 'all')}
                            className={`px-3 py-1.5 rounded-full text-xs sm:text-sm font-medium transition-colors ${
                              deleteRegion === option.value
                                ? 'bg-rose-600 text-white dark:bg-rose-500'
                                : 'bg-white dark:bg-slate-800 text-rose-700 dark:text-rose-300 hover:bg-rose-200/30 dark:hover:bg-rose-900/30'
                            }`}
                          >
                            {option.label}
                          </button>
                        ))}
                      </div>
                    </div>
                    
                    {/* Date Range Selector */}
                    <div>
                      <label className="block text-sm font-medium text-rose-700 dark:text-rose-300 mb-2">
                        {language === 'id' ? 'Rentang Waktu' : 'Date Range'}
                      </label>
                      <div className="flex flex-wrap gap-2">
                        {timeRangeOptions.map((option) => (
                          <button
                            key={option.value}
                            onClick={() => setDeleteDateRange(option.value as '1d' | '7d' | '1m' | '1y' | 'all')}
                            className={`px-3 py-1.5 rounded-full text-xs sm:text-sm font-medium transition-colors ${
                              deleteDateRange === option.value
                                ? 'bg-rose-600 text-white dark:bg-rose-500'
                                : 'bg-white dark:bg-slate-800 text-rose-700 dark:text-rose-300 hover:bg-rose-200/30 dark:hover:bg-rose-900/30'
                            }`}
                          >
                            {option.label}
                          </button>
                        ))}
                      </div>
                    </div>
                    
                    {/* Delete Button */}
                    <button
                      onClick={handleDeleteArticles}
                      disabled={isDeleting}
                      className="w-full px-4 py-2 bg-rose-600 hover:bg-rose-700 dark:bg-rose-500 dark:hover:bg-rose-600 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      {isDeleting ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                          {language === 'id' ? 'Menghapus...' : 'Deleting...'}
                        </>
                      ) : (
                        <>
                          <Trash2 size={16} />
                          {language === 'id' ? 'Hapus Artikel' : 'Delete Articles'}
                        </>
                      )}
                    </button>
                  </div>
                </motion.div>
              )}

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

              {/* Database Statistics */}
              {dbAnalytics && (
                <div className="mb-6 p-4 rounded-lg bg-emerald-100/50 dark:bg-emerald-900/20 border border-emerald-300 dark:border-emerald-800">
                  <div className="flex items-center gap-2 mb-4">
                    <Database size={20} className="text-emerald-700 dark:text-emerald-400" />
                    <h3 className="text-lg font-semibold text-emerald-900 dark:text-cream-200">
                      {language === 'id' ? 'Statistik Database' : 'Database Statistics'}
                    </h3>
                  </div>
                  <div className="mb-4">
                    <p className="text-3xl font-bold text-emerald-900 dark:text-cream-200">
                      {dbAnalytics.totalArticles}
                    </p>
                    <p className="text-sm text-emerald-700 dark:text-emerald-400">
                      {language === 'id' ? 'Total artikel di database' : 'Total articles in database'}
                    </p>
                  </div>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-emerald-700 dark:text-cream-300">Indonesia:</span>
                      <span className="text-emerald-600 dark:text-emerald-400 font-semibold">{dbAnalytics.articlesByRegion.id || 0}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-emerald-700 dark:text-cream-300">China:</span>
                      <span className="text-emerald-600 dark:text-emerald-400 font-semibold">{dbAnalytics.articlesByRegion.cn || 0}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-emerald-700 dark:text-cream-300">International:</span>
                      <span className="text-emerald-600 dark:text-emerald-400 font-semibold">{dbAnalytics.articlesByRegion.intl || 0}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Reading Statistics Chart */}
              <div className="mb-6 p-4 rounded-lg bg-cream-100/50 dark:bg-slate-800/50">
                <div className="flex items-center gap-2 mb-4">
                  <LayoutDashboard size={20} className="text-emerald-700 dark:text-emerald-400" />
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
                
                {sortedCategories.length > 0 && (
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
                )}
              </div>

              {/* Favorite Categories Table - Based on Bookmarks */}
              <div className="mb-6 p-4 rounded-lg bg-cream-100/50 dark:bg-slate-800/50">
                <div className="flex items-center gap-2 mb-4">
                  <TrendingUp size={20} className="text-emerald-700 dark:text-emerald-400" />
                  <h3 className="text-lg font-semibold text-emerald-900 dark:text-cream-200">
                    {language === 'id' ? 'Kategori Favorit' : 'Favorite Categories'}
                  </h3>
                </div>
                
                {sortedFavoriteCategories.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-emerald-300 dark:border-emerald-700">
                          <th className="text-left py-2 px-2 text-emerald-700 dark:text-cream-300 font-semibold">
                            {language === 'id' ? 'Kategori' : 'Category'}
                          </th>
                          <th className="text-right py-2 px-2 text-emerald-700 dark:text-cream-300 font-semibold">
                            {language === 'id' ? 'Jumlah' : 'Count'}
                          </th>
                          <th className="text-right py-2 px-2 text-emerald-700 dark:text-cream-300 font-semibold">
                            %
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {sortedFavoriteCategories.map((item, index) => (
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
                    {language === 'id' ? 'Belum ada artikel favorit' : 'No favorite articles yet'}
                  </p>
                )}
              </div>

      </>
    );
  }
}

