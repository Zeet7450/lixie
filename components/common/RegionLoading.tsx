'use client';

import { motion } from 'framer-motion';
import { useDarkMode } from '@/hooks/useDarkMode';
import { useRegionStore } from '@/store/region';
import { Newspaper } from 'lucide-react';

export function RegionLoading() {
  const { isDarkMode } = useDarkMode();
  const { getDisplayLanguage } = useRegionStore();
  const language = getDisplayLanguage();
  const isIndonesian = language === 'id';

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      className="flex flex-col items-center justify-center min-h-[400px] py-12 px-4"
    >
      {/* Animated Newspaper Icon */}
      <motion.div
        className="relative mb-6"
        animate={{
          y: [0, -10, 0],
          rotate: [0, 5, -5, 0],
        }}
        transition={{
          duration: 2,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      >
        <motion.div
          className={`p-6 rounded-full ${
            isDarkMode
              ? 'bg-gradient-to-br from-rose-900/30 to-slate-800/50'
              : 'bg-gradient-to-br from-rose-200/50 to-cream-100'
          } backdrop-blur-sm shadow-lg`}
          animate={{
            scale: [1, 1.1, 1],
          }}
          transition={{
            duration: 1.5,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        >
          <Newspaper
            size={48}
            className={`${
              isDarkMode ? 'text-rose-300' : 'text-rose-600'
            } drop-shadow-lg`}
          />
        </motion.div>
      </motion.div>

      {/* Loading Text */}
      <motion.div
        className="text-center space-y-2"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
      >
        <motion.h3
          className={`text-lg font-semibold ${
            isDarkMode ? 'text-cream-200' : 'text-emerald-800'
          }`}
          animate={{
            opacity: [0.5, 1, 0.5],
          }}
          transition={{
            duration: 1.5,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        >
          {isIndonesian ? '📰 Mengambil Berita...' : '📰 Fetching News...'}
        </motion.h3>
        <motion.p
          className={`text-sm ${
            isDarkMode ? 'text-slate-400' : 'text-emerald-600'
          }`}
        >
          {isIndonesian
            ? 'Sedang memuat berita terbaru untuk Anda'
            : 'Loading the latest news for you'}
        </motion.p>
      </motion.div>

      {/* Animated Dots */}
      <motion.div
        className="flex gap-2 mt-6"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4 }}
      >
        {[0, 1, 2].map((index) => (
          <motion.div
            key={index}
            className={`w-3 h-3 rounded-full ${
              isDarkMode
                ? 'bg-rose-400'
                : 'bg-rose-500'
            }`}
            animate={{
              y: [0, -10, 0],
              scale: [1, 1.2, 1],
              opacity: [0.5, 1, 0.5],
            }}
            transition={{
              duration: 1,
              repeat: Infinity,
              delay: index * 0.2,
              ease: 'easeInOut',
            }}
          />
        ))}
      </motion.div>

      {/* Floating News Icons */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {[0, 1, 2].map((index) => {
          const positions = [
            { startX: '20%', endX: '80%' },
            { startX: '50%', endX: '10%' },
            { startX: '80%', endX: '40%' },
          ];
          const pos = positions[index];
          
          return (
            <motion.div
              key={index}
              className="absolute text-2xl opacity-10"
              style={{
                left: pos.startX,
                top: '100%',
              }}
              animate={{
                y: ['-100%', '-20%'],
                x: [0, `calc(${pos.endX} - ${pos.startX})`],
                rotate: [0, 360],
                opacity: [0.1, 0.2, 0.1],
              }}
              transition={{
                duration: 6 + index * 1.5,
                repeat: Infinity,
                delay: index * 1.5,
                ease: 'linear',
              }}
            >
              📰
            </motion.div>
          );
        })}
      </div>
    </motion.div>
  );
}

