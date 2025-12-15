'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { usePageTransition } from '@/hooks/useAnimation';
import { useState, useEffect } from 'react';
import { LixieLogo } from '@/components/icons/LixieLogo';
import { Header } from '@/components/layout/Header';
import { CategoryTabs } from '@/components/features/CategoryTabs';
import { NewsFeed } from '@/components/features/NewsFeed';
import { Sidebar } from '@/components/layout/Sidebar';
import { SplashScreen } from '@/components/common/SplashScreen';
// API scheduler will be started via API route (server-side)
import { clearAllArticleCaches } from '@/lib/cache-cleanup';
import { useAnalyticsStore } from '@/store/analytics';
import { useArticlesStore } from '@/store/articles';
import { initializeNotifications } from '@/lib/notifications';
import { useHotNewsNotifications } from '@/hooks/useHotNewsNotifications';
import { verifyEnvironmentVariables } from '@/lib/verify-env';

export default function Home() {
  const pageTransition = usePageTransition();
  const [showSplash, setShowSplash] = useState(true);
  const [activeCategory, setActiveCategory] = useState('all');
  const [mounted, setMounted] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { resetAnalytics } = useAnalyticsStore();
  const { setArticles } = useArticlesStore();

  // Initialize notifications and monitor hot news
  useHotNewsNotifications();

  useEffect(() => {
    // Reset analytics to 0 on mount
    resetAnalytics();
    // Clear ALL cached articles to force fresh data from Groq API
    clearAllArticleCaches();
    // Clear all articles from store to start fresh
    setArticles([]);
    // Initialize notification system
    initializeNotifications();
    // Start API scheduler via API route (server-side only)
    fetch('/api/scheduler/start', { method: 'POST' })
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          console.log('✅', data.message);
        } else {
          console.error('❌', data.message);
        }
      })
      .catch((error) => {
        console.error('Error starting API scheduler:', error);
      });
  }, [resetAnalytics, setArticles]);

  useEffect(() => {
    setMounted(true);
    // Show splash screen for 10 seconds to allow full animation to play
    const timer = setTimeout(() => {
      setShowSplash(false);
    }, 10000);
    return () => clearTimeout(timer);
  }, []);

  if (!mounted) {
    return (
      <div className="min-h-screen bg-cream-200 dark:bg-slate-900 flex items-center justify-center">
        <div className="animate-pulse">
          <LixieLogo size={100} />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-cream-200 dark:bg-slate-900 w-full overflow-x-hidden">
      <motion.div
        initial={pageTransition.initial}
        animate={pageTransition.animate}
        exit={pageTransition.exit}
        transition={pageTransition.transition}
        className="min-h-screen w-full"
      >
        {/* SPLASH SCREEN with Logo Animation */}
        <SplashScreen 
          show={showSplash} 
          onComplete={() => setShowSplash(false)}
        />

        {/* MAIN CONTENT - Always render but conditionally show */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: showSplash ? 0 : 1 }}
          transition={{ duration: 0.3, delay: 0.1 }}
          className={showSplash ? 'hidden' : ''}
        >
          <Header onSidebarToggle={() => setSidebarOpen(true)} />
          <CategoryTabs
            activeCategory={activeCategory}
            onCategoryChange={setActiveCategory}
          />
          <NewsFeed category={activeCategory} />
          <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        </motion.div>
      </motion.div>
    </div>
  );
}
