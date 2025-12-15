'use client';

import { motion } from 'framer-motion';
import { useAnimation } from '@/hooks/useAnimation';
import { useState } from 'react';
import { Search, Moon, Sun, BarChart3 } from 'lucide-react';
import { LixieLogo } from '@/components/icons/LixieLogo';
import { useLanguage } from '@/hooks/useLanguage';
import { useDarkMode } from '@/hooks/useDarkMode';
import { useRegionStore, type AppRegion } from '@/store/region';

interface HeaderProps {
  onSidebarToggle?: () => void;
}

export function Header({ onSidebarToggle }: HeaderProps) {
  const { config } = useAnimation();
  const { t } = useLanguage();
  const { isDarkMode, toggleDarkMode } = useDarkMode();
  const { region, setRegion, getDisplayLanguage } = useRegionStore();
  const displayLanguage = getDisplayLanguage();
  const [isSearchActive, setIsSearchActive] = useState(false);

  const regions: { value: AppRegion; label: string }[] = [
    { value: 'id', label: 'ID' },
    { value: 'en', label: 'EN' },
    { value: 'cn', label: 'CN' },
    { value: 'jp', label: 'JP' },
    { value: 'kr', label: 'KR' },
  ];

  const handleRegionChange = () => {
    const currentIndex = regions.findIndex(r => r.value === region);
    const nextIndex = (currentIndex + 1) % regions.length;
    setRegion(regions[nextIndex].value);
  };

  return (
    <motion.header
      className="sticky top-0 glass backdrop-blur-md border-b border-gray-300/20 z-50 bg-cream-200/70 dark:bg-slate-900/70 mb-0"
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        ...config.Transitions.standard,
        delay: 0.15,
      } as any}
      style={{ height: '64px' }}
    >
      <div className="max-w-7xl mx-auto px-3 sm:px-4 py-2 sm:py-3 flex items-center justify-between gap-2">
        {/* LEFT SECTION - Logo */}
        <motion.div
          className="flex items-center"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          <motion.div
            animate={{
              rotate: [0, 5, 0],
            }}
            transition={{
              duration: 0.6,
              repeat: Infinity,
              repeatDelay: 3,
              ease: 'easeInOut',
            }}
            className="cursor-pointer"
          >
            <LixieLogo size={40} />
          </motion.div>
          <motion.span
            className="ml-2 font-bold text-lg text-emerald-900 dark:text-cream-200"
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
              transition={{
                ...config.Transitions.standard,
                delay: 0.2,
              } as any}
          >
            Lixie
          </motion.span>
        </motion.div>

        {/* CENTER SECTION - Search Bar */}
        <motion.div
          className="flex-1 mx-2 sm:mx-4 relative max-w-md hidden sm:block"
          animate={{
            width: isSearchActive ? '100%' : 'auto',
          }}
          transition={config.Transitions.standard as any}
        >
          <motion.div
            className="glass rounded-full px-4 py-2 flex items-center gap-2 cursor-pointer"
            onClick={() => setIsSearchActive(true)}
            animate={{
              boxShadow: isSearchActive
                ? '0 8px 32px rgba(220, 174, 150, 0.2)'
                : '0 4px 12px rgba(216, 191, 216, 0.1)',
            }}
            transition={config.Transitions.micro as any}
          >
            <Search size={18} className="text-emerald-700 dark:text-cream-300" />
            <motion.input
              type="text"
              placeholder={t('common.search')}
              className="bg-transparent flex-1 outline-none text-sm placeholder:text-emerald-500/50"
              initial={{ opacity: 0, width: 0 }}
              animate={{
                opacity: isSearchActive ? 1 : 0,
                width: isSearchActive ? 'auto' : 0,
              }}
              transition={config.Transitions.micro as any}
              onBlur={() => setIsSearchActive(false)}
            />
          </motion.div>
        </motion.div>

        {/* RIGHT SECTION - Action Buttons */}
        <motion.div
          className="flex items-center gap-1 sm:gap-3"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{
            staggerChildren: 0.08,
            delayChildren: 0.25,
          }}
        >
          {/* REGION SELECTOR */}
          <motion.button
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={config.Transitions.standard as any}
            onClick={handleRegionChange}
            className="flex items-center gap-1 px-3 py-2 rounded-full hover:bg-rose-200/30 dark:hover:bg-rose-900/30 transition-colors font-medium text-sm"
            whileTap={{ scale: 0.95 }}
            title={displayLanguage === 'id' ? 'Pilih Region Berita' : 'Select News Region'}
          >
            <span className="text-emerald-700 dark:text-cream-300">
              {regions.find(r => r.value === region)?.label || 'ID'}
            </span>
          </motion.button>

          {/* SIDEBAR TOGGLE (Desktop) */}
          {onSidebarToggle && (
            <motion.button
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={config.Transitions.standard as any}
              onClick={onSidebarToggle}
              className="hidden lg:flex p-2 rounded-full hover:bg-rose-200/30 dark:hover:bg-rose-900/30 transition-colors"
              whileTap={{ scale: 0.95 }}
              title="Analytics Dashboard"
            >
              <BarChart3 size={20} className="text-emerald-700 dark:text-cream-300" />
            </motion.button>
          )}

          {/* DARK MODE TOGGLE */}
          <motion.button
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={config.Transitions.standard as any}
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

          {/* SIDEBAR TOGGLE (Mobile) */}
          {onSidebarToggle && (
            <motion.button
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={config.Transitions.standard as any}
              onClick={onSidebarToggle}
              className="lg:hidden p-2 rounded-full hover:bg-rose-200/30 dark:hover:bg-rose-900/30 transition-colors"
              whileTap={{ scale: 0.95 }}
              title="Analytics Dashboard"
            >
              <BarChart3 size={20} className="text-emerald-700 dark:text-cream-300" />
            </motion.button>
          )}
        </motion.div>
      </div>
    </motion.header>
  );
}

