'use client';

import { motion } from 'framer-motion';
import { useLanguage } from '@/hooks/useLanguage';
import { useDarkMode } from '@/hooks/useDarkMode';

interface EmptyStateProps {
  message?: string;
  statusMessage?: string;
}

export function EmptyState({ message, statusMessage }: EmptyStateProps) {
  const { t, language } = useLanguage();
  const { isDarkMode } = useDarkMode();

  // Animation variants for the news icon
  const iconVariants = {
    animate: {
      y: [0, -10, 0],
      rotate: [0, 5, -5, 0],
      scale: [1, 1.1, 1],
    },
    transition: {
      duration: 2,
      repeat: Infinity,
      ease: [0.4, 0, 0.2, 1] as const,
    },
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5 }}
      className="text-center py-16 px-4 min-h-[400px] flex flex-col items-center justify-center"
    >
      {/* Animated News Icon */}
      <div className="relative mb-8">
        <motion.div
          variants={iconVariants}
          animate="animate"
          transition={iconVariants.transition}
          className="text-8xl mb-4"
        >
          📰
        </motion.div>
      </div>

      {/* Main Message */}
      <motion.p
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2, duration: 0.5 }}
        className="text-emerald-700 dark:text-cream-300 text-xl font-semibold mb-3"
      >
        {message || t('common.no_articles')}
      </motion.p>

      {/* Status Message */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4, duration: 0.5 }}
        className="max-w-md mx-auto"
      >
        {statusMessage ? (
          <p className="text-emerald-600 dark:text-cream-400 text-sm">
            {statusMessage}
          </p>
        ) : (
          <p className="text-emerald-600 dark:text-cream-400 text-sm">
            {language === 'id'
              ? 'API scheduler sedang memproses berita dari Groq API. Tunggu beberapa saat...'
              : 'API scheduler is processing news from Groq API. Please wait...'}
          </p>
        )}
      </motion.div>

      {/* Loading Animation */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.6, duration: 0.5 }}
        className="mt-8 flex gap-2 justify-center"
      >
        {[...Array(3)].map((_, i) => (
          <motion.div
            key={i}
            initial={{ scale: 0.8, opacity: 0.5 }}
            animate={{
              scale: [0.8, 1.2, 0.8],
              opacity: [0.5, 1, 0.5],
            }}
            transition={{
              duration: 1.5,
              repeat: Infinity,
              delay: i * 0.2,
              ease: [0.4, 0, 0.2, 1] as const,
            }}
            className="w-3 h-3 rounded-full"
            style={{
              backgroundColor: isDarkMode ? '#9DC183' : '#6B8E6F',
            }}
          />
        ))}
      </motion.div>
    </motion.div>
  );
}
